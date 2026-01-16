import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    proto 
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// --- ESTRUTURAS DE DADOS ---
export interface LogItem {
    timestamp: string;
    message: string;
}

// Estatísticas Globais da Sessão Atual
export let sessionStats = {
    envios: 0,
    entregues: 0, // Status 3
    lidos: 0,     // Status 4
    respostas: 0, // Mensagens recebidas
    ultimosEventos: [] as string[] // Log rápido para o front
};

export const globalLogs: LogItem[] = [];

const addGlobalLog = (msg: string) => {
    globalLogs.unshift({ timestamp: new Date().toISOString(), message: msg }); 
    if (globalLogs.length > 50) globalLogs.pop();
};

export let serverInfo: { ip: string; local: string } | null = null;
const sessions = new Map<string, any>();
const CONFIG_FILE = path.resolve(process.cwd(), 'sessions_config.json');

// Rastreamento de números que receberam campanhas (para calcular taxa de resposta)
const campaignTargets = new Set<string>();

const fetchServerInfo = async () => {
    try {
        const res = await axios.get('http://ip-api.com/json/?fields=query,city,region,status');
        if (res.data?.status === 'success') {
            serverInfo = { ip: res.data.query, local: `${res.data.city}/${res.data.region}` };
        }
    } catch (error) { serverInfo = { ip: 'IP Oculto', local: 'Servidor Local' }; }
};
fetchServerInfo();

// --- PERSISTÊNCIA ---
const loadConfig = () => {
    if (fs.existsSync(CONFIG_FILE)) {
        try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch { return {}; }
    }
    return {};
};

const saveConfig = (sessionId: string, webhookUrl: string) => {
    const configs = loadConfig();
    if (!configs[sessionId] || configs[sessionId].webhookUrl !== webhookUrl) {
        configs[sessionId] = { webhookUrl };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
    }
};

const removeConfig = (sessionId: string) => {
    const configs = loadConfig();
    if (configs[sessionId]) {
        delete configs[sessionId];
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
    }
};

// --- LOG INTERNO ---
const logEvent = (tipo: string, session: string, foneDestino: string, msg: string) => {
    const sessaoData = sessions.get(session);
    let botNumber = sessaoData?.phoneNumber || '?';
    console.log(`[${tipo}] ${session} | Bot: ${botNumber} -> ${foneDestino}: ${msg}`);

    if (tipo === 'ENVIO' || tipo === 'UPLOAD') {
        addGlobalLog(`📤 Enviando para ${foneDestino}`);
        sessionStats.envios++;
        campaignTargets.add(foneDestino); // Marca como alvo de campanha
    }
    if (tipo === 'ERRO') addGlobalLog(`❌ Erro: ${msg}`);
};

// --- START SESSION ---
export const startSession = async (sessionId: string, phoneNumber?: string, webhookUrl?: string): Promise<any> => {
    if (!webhookUrl) {
        const saved = loadConfig();
        if (saved[sessionId]) webhookUrl = saved[sessionId].webhookUrl;
    } else { saveConfig(sessionId, webhookUrl); }

    const authPath = `auth_info_baileys/${sessionId}`;
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })) },
        browser: Browsers.ubuntu('Chrome'),
        markOnlineOnConnect: true,
        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 60_000,
        keepAliveIntervalMs: 10_000,
        retryRequestDelayMs: 2000,
        getMessage: async (key) => {
            if (sessions.get(sessionId)?.store) {
                const msg = await sessions.get(sessionId).store.loadMessage(key.remoteJid, key.id);
                return msg?.message || undefined;
            }
            return proto.Message.fromObject({});
        }
    });

    if (phoneNumber && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const cleanNumber = formatNumberBR(phoneNumber);
                const code = await sock.requestPairingCode(cleanNumber);
                addGlobalLog(`🔐 Código Pareamento: ${code}`);
                const current = sessions.get(sessionId) || {};
                sessions.set(sessionId, { ...current, pairingCode: code, status: 'pairing', webhookUrl, phoneNumber });
            } catch (error) { console.error('Erro code:', error); }
        }, 4000);
    }

    // LISTENER: MENSAGENS (RESPOSTAS)
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return; // Ignora minhas próprias

            const remoteJid = msg.key.remoteJid || '';
            const fone = remoteJid.split('@')[0];

            // Se for resposta de alguém que enviamos campanha
            if (campaignTargets.has(fone)) {
                sessionStats.respostas++;
                addGlobalLog(`💬 RESPOSTA DETECTADA: ${fone}`);
                // Opcional: Remover do Set para não contar duplas respostas? 
                // campaignTargets.delete(fone); 
            }
        } catch (error) { console.error("Erro upsert:", error); }
    });

    // LISTENER: STATUS (ENTREGA/LEITURA)
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update.update.status) {
                const status = update.update.status;
                // 3 = Entregue, 4 = Lido, 5 = Reproduzido
                if (status === 3) sessionStats.entregues++;
                if (status === 4 || status === 5) {
                    // Se leu, também foi entregue, mas evitamos duplicar no contador simples
                    sessionStats.lidos++;
                }
            }
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            const current = sessions.get(sessionId) || {};
            sessions.set(sessionId, { ...current, qrCode: qr, status: 'qrcode', webhookUrl });
        }
        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                const current = sessions.get(sessionId) || {};
                sessions.set(sessionId, { ...current, status: 'reconnecting' });
                addGlobalLog(`Reconectando...`);
                setTimeout(() => { startSession(sessionId, undefined, webhookUrl); }, 3000);
            } else {
                if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
                removeConfig(sessionId);
                sessions.delete(sessionId);
                addGlobalLog(`Desconectado.`);
            }
        } else if (connection === 'open') {
            const botId = sock.user?.id?.split(':')[0]?.split('@')[0] || '';
            const current = sessions.get(sessionId) || {};
            sessions.set(sessionId, { ...current, socket: sock, status: 'connected', webhookUrl, phoneNumber: botId });
            addGlobalLog(`✅ Bot Conectado: ${botId}`);
        }
    });

    sock.ev.on('creds.update', saveCreds);
    const current = sessions.get(sessionId) || {};
    sessions.set(sessionId, { ...current, socket: sock, status: 'connecting', webhookUrl, phoneNumber: phoneNumber || current.phoneNumber });
    return { socket: sock, status: 'connecting', webhookUrl };
};

export const getSession = (sessionId: string) => sessions.get(sessionId);

export const deleteSession = (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (session?.socket) session.socket.end(undefined);
    sessions.delete(sessionId);
    const authPath = `auth_info_baileys/${sessionId}`;
    if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
    removeConfig(sessionId);
    // Limpar stats ao desconectar
    sessionStats = { envios: 0, entregues: 0, lidos: 0, respostas: 0, ultimosEventos: [] };
    campaignTargets.clear();
    return true;
};

// HELPERS DE ENVIO
export const sendMediaBuffer = async (sessionId: string, number: string, type: 'image' | 'video' | 'document', buffer: Buffer, mimetype: string, caption?: string, fileName?: string) => {
    const session = sessions.get(sessionId);
    if (!session || session.status !== 'connected') throw new Error(`Sessão offline.`);
    const jid = `${formatNumberBR(number)}@s.whatsapp.net`;
    let messagePayload: any = {};
    if (type === 'image') messagePayload = { image: buffer, caption, mimetype };
    else if (type === 'video') messagePayload = { video: buffer, caption, mimetype };
    else if (type === 'document') messagePayload = { document: buffer, mimetype, fileName: fileName || 'file', caption };
    logEvent('UPLOAD', sessionId, formatNumberBR(number), `Arquivo: ${type}`);
    return await session.socket.sendMessage(jid, messagePayload);
};

export const sendMedia = async (sessionId: string, number: string, type: 'image' | 'video' | 'document', url: string, caption?: string, fileName?: string) => {
    const session = sessions.get(sessionId);
    if (!session || session.status !== 'connected') throw new Error("Sessão off.");
    const jid = `${formatNumberBR(number)}@s.whatsapp.net`;
    let msg: any = {};
    if (type === 'image') msg = { image: { url }, caption };
    else if (type === 'video') msg = { video: { url }, caption };
    else if (type === 'document') msg = { document: { url }, mimetype: 'application/octet-stream', fileName, caption };
    logEvent('URL', sessionId, formatNumberBR(number), `Mídia URL`);
    return await session.socket.sendMessage(jid, msg);
};

export const getAllSessions = () => {
    const activeSessions: any[] = [];
    sessions.forEach((value, key) => activeSessions.push({ sessionId: key, status: value.status, phoneNumber: value.phoneNumber || '', webhookUrl: value.webhookUrl }));
    return activeSessions;
};

export const formatNumberBR = (number: string): string => {
    if(!number) return '';
    let clean = number.replace(/[^0-9]/g, '');
    if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') return clean.substring(0, 4) + clean.substring(5);
    return clean;
};