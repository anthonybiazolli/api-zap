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

// --- SISTEMA DE LOGS GLOBAL (BUFFER) ---
// Agora guardamos o timestamp bruto e a mensagem separada
export interface LogItem {
    timestamp: string;
    message: string;
}

export const globalLogs: LogItem[] = [];

// Função que o usuário vê (apenas processamento de fila)
const addGlobalLog = (msg: string) => {
    // Salva o momento exato em formato ISO (UTC)
    // O Frontend converterá isso para o horário do navegador
    globalLogs.unshift({
        timestamp: new Date().toISOString(),
        message: msg
    }); 
    if (globalLogs.length > 50) globalLogs.pop(); // Limita a 50 linhas
};

export let serverInfo: { ip: string; local: string } | null = null;
const sessions = new Map<string, any>();
const CONFIG_FILE = path.resolve(process.cwd(), 'sessions_config.json');

const fetchServerInfo = async () => {
    try {
        const res = await fetch('http://ip-api.com/json/?fields=query,city,region,status');
        const data: any = await res.json();
        if (data.status === 'success') {
            serverInfo = { ip: data.query, local: `${data.city}/${data.region}` };
        }
    } catch (error) {
        serverInfo = { ip: 'IP Oculto', local: 'Localhost' };
    }
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

// --- LOG INTERNO (FILTRADO) ---
const logEvent = (tipo: string, session: string, foneDestino: string, msg: string) => {
    const sessaoData = sessions.get(session);
    let botNumber = sessaoData?.phoneNumber || '?';
    
    // Log Completo no Terminal do Servidor (Node)
    console.log(`[${tipo}] ${session} | Bot: ${botNumber} -> ${foneDestino}: ${msg}`);

    // FILTRO: Só mostra para o usuário logs de ENVIO ou UPLOAD (ignora 'RECEBIDO')
    if (tipo === 'ENVIO' || tipo === 'UPLOAD' || tipo === 'URL') {
        addGlobalLog(`📤 Enviando para ${foneDestino}: ${msg}`);
    }
    // Se quiser mostrar erros explicitamente
    if (tipo === 'ERRO') {
        addGlobalLog(`❌ Erro: ${msg}`);
    }
};

// --- START SESSION ---
export const startSession = async (sessionId: string, phoneNumber?: string, webhookUrl?: string): Promise<any> => {
    
    if (!webhookUrl) {
        const saved = loadConfig();
        if (saved[sessionId]) webhookUrl = saved[sessionId].webhookUrl;
    } else {
        saveConfig(sessionId, webhookUrl);
    }

    const authPath = `auth_info_baileys/${sessionId}`;
    if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
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

    // LISTENER DE MENSAGENS
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return;

            const isFromMe = msg.key.fromMe;
            const tipoLog = isFromMe ? 'ENVIO' : 'RECEBIDO';
            
            const texto = msg.message.conversation || 
                          msg.message.extendedTextMessage?.text || 
                          msg.message.imageMessage?.caption || 
                          (isFromMe ? '[Mídia]' : '[Mídia]');
            
            const telefoneRemoto = msg.key.remoteJid?.split('@')[0] || 'Desconhecido';

            logEvent(tipoLog, sessionId, telefoneRemoto, texto.substring(0, 30));

        } catch (error) { console.error("Erro msg:", error); }
    });

    // STATUS CONEXÃO
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
                addGlobalLog(`Reconectando sessão...`);
                setTimeout(() => { startSession(sessionId, undefined, webhookUrl); }, 3000);
            } else {
                if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
                removeConfig(sessionId);
                sessions.delete(sessionId);
                addGlobalLog(`Sessão desconectada.`);
            }
        } 
        else if (connection === 'open') {
            const botId = sock.user?.id?.split(':')[0]?.split('@')[0] || '';
            const current = sessions.get(sessionId) || {};
            
            sessions.set(sessionId, { 
                ...current, 
                socket: sock, 
                status: 'connected', 
                webhookUrl,
                phoneNumber: botId 
            });

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

    // Log para o usuário
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
    
    // Log para o usuário
    logEvent('URL', sessionId, formatNumberBR(number), `Mídia URL`);
    
    return await session.socket.sendMessage(jid, msg);
};

export const getAllSessions = () => {
    const activeSessions: any[] = [];
    sessions.forEach((value, key) => {
        activeSessions.push({
            sessionId: key,
            status: value.status,
            phoneNumber: value.phoneNumber || '',
            webhookUrl: value.webhookUrl
        });
    });
    return activeSessions;
};

export const formatNumberBR = (number: string): string => {
    if(!number) return '';
    let clean = number.replace(/[^0-9]/g, '');
    if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') {
        return clean.substring(0, 4) + clean.substring(5);
    }
    return clean;
};