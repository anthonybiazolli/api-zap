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

// --- PERSISTÊNCIA ---
const CONFIG_FILE = path.resolve(process.cwd(), 'sessions_config.json');

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

const sessions = new Map<string, any>();

interface SessionData {
    socket: any;
    qrCode?: string;
    pairingCode?: string;
    status: string;
    webhookUrl?: string;
}

// --- LOGGER BONITO ---
const logEvent = (tipo: string, session: string, fone: string, msg: string) => {
    console.log(`\n╭─── [${tipo}] ──────────────────────────────────────`);
    console.log(`│ 👤 Sessão: ${session}`);
    console.log(`│ 📱 Fone:   ${fone}`);
    console.log(`│ 📝 Info:   ${msg}`);
    console.log(`╰─────────────────────────────────────────────────────\n`);
};

export const startSession = async (sessionId: string, phoneNumber?: string, webhookUrl?: string): Promise<SessionData> => {
    
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
                console.log(`\n🔐 CÓDIGO DE PAREAMENTO: ${code}\n`);
                const current = sessions.get(sessionId) || {};
                sessions.set(sessionId, { ...current, pairingCode: code, status: 'pairing', webhookUrl });
            } catch (error) { console.error('Erro code:', error); }
        }, 4000);
    }

    // --- ESCUTAR MENSAGENS (ENVIADAS E RECEBIDAS) ---
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return;

            // Determina se é Enviada ou Recebida
            const tipoLog = msg.key.fromMe ? '📤 ENVIADA' : '📥 RECEBIDA';
            const texto = msg.message.conversation || 
                          msg.message.extendedTextMessage?.text || 
                          msg.message.imageMessage?.caption || 
                          (msg.key.fromMe ? '[Mídia Enviada]' : '[Mídia Recebida]');
            
            const remetente = msg.pushName || 'Desconhecido';
            const telefone = msg.key.remoteJid?.split('@')[0];

            // LOG NO TERMINAL
            logEvent(tipoLog, sessionId, `${remetente} (${telefone})`, texto);

            // Webhook (Apenas para recebidas)
            if (!msg.key.fromMe) {
                let targetUrl = webhookUrl;
                if (!targetUrl) {
                    const saved = loadConfig();
                    targetUrl = saved[sessionId]?.webhookUrl;
                }

                if (targetUrl) {
                    const payload = {
                        event: 'message.received',
                        session: sessionId,
                        phone: telefone,
                        name: remetente,
                        message: texto,
                        id: msg.key.id,
                        timestamp: new Date().toISOString()
                    };
                    fetch(targetUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }).catch(() => {});
                }
            }
        } catch (error) { console.error("Erro msg:", error); }
    });

    // --- ATUALIZAÇÃO DE STATUS (LIDO/ENTREGUE) ---
    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update.update.status) {
                let statusText = '';
                if (update.update.status === 3) statusText = 'delivered'; // Entregue
                if (update.update.status === 4) statusText = 'read';      // Lido
                if (update.update.status === 5) statusText = 'played';    // Ouvido

                if (statusText) {
                    const fone = update.key.remoteJid?.split('@')[0];
                    console.log(`👀 STATUS: ${statusText.toUpperCase()} -> Para: ${fone}`);

                    let targetUrl = webhookUrl;
                    if (!targetUrl) {
                        const saved = loadConfig();
                        targetUrl = saved[sessionId]?.webhookUrl;
                    }

                    if (targetUrl) {
                        fetch(targetUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                event: 'message.status',
                                session: sessionId,
                                id: update.key.id,
                                status: statusText,
                                phone: fone,
                                timestamp: new Date().toISOString()
                            })
                        }).catch(() => {});
                    }
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
            
            console.log(`[Status] Queda (${statusCode}). Reconectando...`);

            if (shouldReconnect) {
                const current = sessions.get(sessionId) || {};
                sessions.set(sessionId, { ...current, status: 'reconnecting' });
                setTimeout(() => { startSession(sessionId, undefined, webhookUrl); }, 3000);
            } else {
                if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
                removeConfig(sessionId);
                sessions.delete(sessionId);
            }
        } else if (connection === 'open') {
            console.log(`\n✅ [CONECTADO] Sessão: ${sessionId}\n`);
            const current = sessions.get(sessionId) || {};
            sessions.set(sessionId, { ...current, socket: sock, status: 'connected', webhookUrl });
        }
    });

    sock.ev.on('creds.update', saveCreds);

    const current = sessions.get(sessionId) || {};
    sessions.set(sessionId, { ...current, socket: sock, status: 'connecting', webhookUrl });

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

export const sendMediaBuffer = async (sessionId: string, number: string, type: 'image' | 'video' | 'document', buffer: Buffer, mimetype: string, caption?: string, fileName?: string) => {
    const session = sessions.get(sessionId);
    if (!session) throw new Error(`Sessão não encontrada.`);
    if (session.status !== 'connected' && session.status !== 'reconnecting') throw new Error(`Sessão instável.`);
    if (session.status === 'reconnecting') await new Promise(r => setTimeout(r, 2000));

    const formattedNumber = formatNumberBR(number);
    const jid = `${formattedNumber}@s.whatsapp.net`;

    let messagePayload: any = {};
    if (type === 'image') messagePayload = { image: buffer, caption, mimetype };
    else if (type === 'video') messagePayload = { video: buffer, caption, mimetype };
    else if (type === 'document') messagePayload = { document: buffer, mimetype, fileName: fileName || 'file', caption };

    // Log de Envio Manual
    logEvent('📤 UPLOAD', sessionId, formattedNumber, `Arquivo: ${type}`);

    return await session.socket.sendMessage(jid, messagePayload);
};

export const sendMedia = async (sessionId: string, number: string, type: 'image' | 'video' | 'document', url: string, caption?: string, fileName?: string) => {
    const session = sessions.get(sessionId);
    if (!session || session.status !== 'connected') throw new Error("Sessão off.");
    const jid = `${formatNumberBR(number)}@s.whatsapp.net`;
    let msg: any = {};
    if (type === 'image') msg = { image: { url }, caption };
    else if (type === 'video') msg = { video: { url }, caption };
    else if (type === 'document') msg = { document: { url }, mimetype: getMimeType(url), fileName, caption };
    return await session.socket.sendMessage(jid, msg);
};

function getMimeType(url: string): string {
    if (url.endsWith('.pdf')) return 'application/pdf';
    return 'application/octet-stream';
}

export const formatNumberBR = (number: string): string => {
    let clean = number.replace(/[^0-9]/g, '');
    if (clean.startsWith('55') && clean.length === 13 && clean[4] === '9') {
        return clean.substring(0, 4) + clean.substring(5);
    }
    return clean;
};