import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    proto,
    downloadContentFromMessage
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { GoogleDriveService } from './services/GoogleDriveService';

const prisma = new PrismaClient();

// === MEMÓRIA GLOBAL ===
declare global {
    var sessions: Map<string, any>;
}
if (!global.sessions) global.sessions = new Map();
const sessions = global.sessions;

// === ESTRUTURAS AUXILIARES ===
export interface LogItem {
    timestamp: string;
    type: 'sent' | 'received' | 'info' | 'error';
    message: string;
}

export let sessionStats = {
    envios: 0, entregues: 0, lidos: 0, respostas: 0, ultimosEventos: [] as string[]
};
export const globalLogs: LogItem[] = [];

const addGlobalLog = (type: LogItem['type'], msg: string) => {
    globalLogs.unshift({ timestamp: new Date().toISOString(), type, message: msg }); 
    if (globalLogs.length > 100) globalLogs.pop();
};

// Caminho correto da pasta de sessões (Baseado na sua informação)
const SESSIONS_DIR = path.resolve(__dirname, '..', 'auth_info_baileys');
const CONFIG_FILE = path.resolve(__dirname, '..', 'sessions_config.json');

export let serverInfo: { ip: string; local: string } | null = null;
const campaignTargets = new Set<string>();

// ... (fetchServerInfo mantido igual) ...
const fetchServerInfo = async () => { try { const res = await axios.get('http://ip-api.com/json/?fields=query,city,region,status'); if (res.data?.status === 'success') serverInfo = { ip: res.data.query, local: `${res.data.city}/${res.data.region}` }; } catch { serverInfo = { ip: 'IP Oculto', local: 'Local' }; } };
fetchServerInfo();

// ... (loadConfig/saveConfig mantidos iguais) ...
const loadConfig = () => { if (fs.existsSync(CONFIG_FILE)) { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')); } catch { return {}; } } return {}; };
const saveConfig = (sessionId: string, webhookUrl: string) => { const configs = loadConfig(); if (!configs[sessionId] || configs[sessionId].webhookUrl !== webhookUrl) { configs[sessionId] = { webhookUrl }; fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2)); } };
const removeConfig = (sessionId: string) => { const configs = loadConfig(); if (configs[sessionId]) { delete configs[sessionId]; fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2)); } };
const extractMessageContent = (msg: proto.IMessage | null | undefined): string => { if (!msg) return ''; return msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || (msg.imageMessage ? '[Imagem]' : '') || (msg.videoMessage ? '[Vídeo]' : '') || (msg.documentMessage ? '[Documento]' : '') || (msg.audioMessage ? '[Áudio]' : '') || ''; };

// === RESTAURAÇÃO DE SESSÃO ===
export const initSessions = async () => {
    // Verifica se a pasta existe
    if (!fs.existsSync(SESSIONS_DIR)) {
        fs.mkdirSync(SESSIONS_DIR, { recursive: true });
        console.log(`[INIT] Pasta criada: ${SESSIONS_DIR}`);
        return;
    }

    const files = fs.readdirSync(SESSIONS_DIR);
    console.log(`[INIT] Varrendo pasta correta: ${SESSIONS_DIR}`);

    for (const file of files) {
        // Verifica se é uma pasta de sessão válida
        const fullPath = path.join(SESSIONS_DIR, file);
        if (fs.statSync(fullPath).isDirectory()) {
            const sessionId = file; 
            console.log(`[INIT] 🔄 Restaurando sessão encontrada: ${sessionId}`);
            // Inicia sem aguardar para não travar o boot
            startSession(sessionId).catch(e => console.error(`Erro ao restaurar ${sessionId}:`, e));
        }
    }
};

// === START SESSION ===
export const startSession = async (sessionId: string, phoneNumber?: string, webhookUrl?: string): Promise<any> => {
    if (!webhookUrl) {
        const saved = loadConfig();
        if (saved[sessionId]) webhookUrl = saved[sessionId].webhookUrl;
    } else { saveConfig(sessionId, webhookUrl); }

    // Define o caminho específico desta sessão
    const authPath = path.join(SESSIONS_DIR, sessionId);
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

    // Registra na memória GLOBAL
    const currentData = sessions.get(sessionId) || {};
    sessions.set(sessionId, { ...currentData, socket: sock, status: 'connecting', webhookUrl, phoneNumber });

    // Pareamento (Código)
    if (phoneNumber && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const cleanNumber = formatNumberBR(phoneNumber);
                const code = await sock.requestPairingCode(cleanNumber);
                addGlobalLog('info', `🔐 Código Pareamento: ${code}`);
                const current = sessions.get(sessionId) || {};
                sessions.set(sessionId, { ...current, pairingCode: code, status: 'pairing' });
            } catch (error) { console.error('Erro code:', error); }
        }, 4000);
    }

    // Eventos
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return;
            const remoteJid = msg.key.remoteJid || '';
            if (remoteJid.includes('@g.us')) return;

            const fone = remoteJid.split('@')[0];
            const isFromMe = msg.key.fromMe || false;
            const content = extractMessageContent(msg.message);

            if (!content && !msg.message.imageMessage && !msg.message.documentMessage && !msg.message.audioMessage) return;

            const logCampanha = await prisma.mensagemLog.findFirst({ 
                where: { destinatario: { contains: fone.slice(-8) } }, 
                orderBy: { dataEnvio: 'desc' }
            });

            const shouldSave = isFromMe || logCampanha || campaignTargets.has(fone);

            if (shouldSave) {
                let mediaUrl: string | null = null;
                try {
                    let stream, fileName = `file_${Date.now()}`, mimetype = '';
                    if (msg.message.imageMessage) {
                        stream = await downloadContentFromMessage(msg.message.imageMessage, 'image');
                        fileName = `img_${Date.now()}.jpeg`; mimetype = msg.message.imageMessage.mimetype || 'image/jpeg';
                    } else if (msg.message.audioMessage) {
                        stream = await downloadContentFromMessage(msg.message.audioMessage, 'audio');
                        fileName = `aud_${Date.now()}.mp3`; mimetype = msg.message.audioMessage.mimetype || 'audio/mp4';
                    } else if (msg.message.documentMessage) {
                        stream = await downloadContentFromMessage(msg.message.documentMessage, 'document');
                        fileName = msg.message.documentMessage.fileName || `doc_${Date.now()}`; mimetype = msg.message.documentMessage.mimetype || 'application/octet-stream';
                    }
                    if (stream && mimetype) mediaUrl = await GoogleDriveService.uploadBaileysMedia(stream, fileName, mimetype);
                } catch (e) { console.error("Erro Drive Auto:", e); }

                await prisma.chatMessage.create({
                    data: { instanceId: sessionId, remoteJid: remoteJid, fromMe: isFromMe, content: content || (mediaUrl ? "📎 Arquivo" : ""), mediaUrl: mediaUrl }
                });

                if (!isFromMe && logCampanha && !logCampanha.respondida) {
                    await prisma.mensagemLog.update({ where: { id: logCampanha.id }, data: { respondida: true, dataResposta: new Date() } });
                    sessionStats.respostas++;
                }
            }
            if (isFromMe) addGlobalLog('sent', `📤 ${fone}: ${content}`);
            else addGlobalLog('received', `📩 ${fone}: ${content}`);
        } catch (error) { console.error("Upsert erro:", error); }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            const current = sessions.get(sessionId) || {};
            sessions.set(sessionId, { ...current, qrCode: qr, status: 'qrcode' });
        }
        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`[WABOT] Conexão caiu (${sessionId}). Reconectar? ${shouldReconnect}`);

            if (shouldReconnect) {
                const current = sessions.get(sessionId) || {};
                sessions.set(sessionId, { ...current, status: 'reconnecting' });
                setTimeout(() => { startSession(sessionId, undefined, webhookUrl); }, 3000);
            } else {
                if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
                removeConfig(sessionId);
                sessions.delete(sessionId);
                addGlobalLog('error', `🚫 Sessão ${sessionId} desconectada.`);
            }
        } else if (connection === 'open') {
            const botId = sock.user?.id?.split(':')[0]?.split('@')[0] || '';
            const current = sessions.get(sessionId) || {};
            sessions.set(sessionId, { ...current, socket: sock, status: 'connected', phoneNumber: botId });
            addGlobalLog('info', `✅ Bot Conectado: ${botId}`);
        }
    });

    sock.ev.on('creds.update', saveCreds);
    return { socket: sock, status: 'connecting' };
};

export const getSession = (sessionId: string) => sessions.get(sessionId);

export const deleteSession = (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (session?.socket) session.socket.end(undefined);
    sessions.delete(sessionId);
    
    // Deleta a pasta correta
    const authPath = path.join(SESSIONS_DIR, sessionId);
    if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
    
    removeConfig(sessionId);
    return true;
};

// ... (helpers sendMediaBuffer e formatNumberBR iguais) ...
export const sendMediaBuffer = async (sessionId: string, number: string, type: 'image' | 'video' | 'document', buffer: Buffer, mimetype: string, caption?: string, fileName?: string) => {
    const session = sessions.get(sessionId);
    if (!session || session.status !== 'connected') throw new Error(`Sessão offline.`);
    const jid = `${formatNumberBR(number)}@s.whatsapp.net`;
    let msg: any = {};
    if (type === 'image') msg = { image: buffer, caption, mimetype };
    else if (type === 'video') msg = { video: buffer, caption, mimetype };
    else if (type === 'document') msg = { document: buffer, mimetype, fileName: fileName || 'file', caption };
    return await session.socket.sendMessage(jid, msg);
};

export const formatNumberBR = (number: string): string => {
    if(!number) return '';
    let clean = number.replace(/[^0-9]/g, '');
    if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') return clean.substring(0, 4) + clean.substring(5);
    return clean;
};