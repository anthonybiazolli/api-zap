"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendMedia = exports.deleteSession = exports.getSession = exports.startSession = void 0;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const pino_1 = __importDefault(require("pino"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// --- PERSISTÊNCIA OTIMIZADA ---
const CONFIG_FILE = path_1.default.resolve(process.cwd(), 'sessions_config.json');
const loadConfig = () => {
    if (fs_1.default.existsSync(CONFIG_FILE)) {
        try {
            return JSON.parse(fs_1.default.readFileSync(CONFIG_FILE, 'utf-8'));
        }
        catch {
            return {};
        }
    }
    return {};
};
const saveConfig = (sessionId, webhookUrl) => {
    const configs = loadConfig();
    // SÓ SALVA SE MUDOU (EVITA LOOP)
    if (!configs[sessionId] || configs[sessionId].webhookUrl !== webhookUrl) {
        configs[sessionId] = { webhookUrl };
        fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
        console.log(`[Config] 💾 URL do Webhook atualizada para: ${webhookUrl}`);
    }
};
const removeConfig = (sessionId) => {
    const configs = loadConfig();
    if (configs[sessionId]) {
        delete configs[sessionId];
        fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2));
    }
};
// --- MAPA DE SESSÕES ---
const sessions = new Map();
const startSession = async (sessionId, phoneNumber, webhookUrl) => {
    // Recupera URL do arquivo se não veio no parametro
    if (!webhookUrl) {
        const saved = loadConfig();
        if (saved[sessionId])
            webhookUrl = saved[sessionId].webhookUrl;
    }
    else {
        saveConfig(sessionId, webhookUrl);
    }
    const authPath = `auth_info_baileys/${sessionId}`;
    if (!fs_1.default.existsSync(authPath))
        fs_1.default.mkdirSync(authPath, { recursive: true });
    const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(authPath);
    const sock = (0, baileys_1.default)({
        logger: (0, pino_1.default)({ level: 'silent' }), // Silencia logs internos do Baileys
        printQRInTerminal: !phoneNumber,
        auth: state,
        browser: baileys_1.Browsers.macOS("Chrome"),
        syncFullHistory: false,
    });
    // Lógica do Código de Pareamento
    if (phoneNumber && !sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
                const code = await sock.requestPairingCode(cleanNumber);
                console.log(`\n================================`);
                console.log(`🔐 CÓDIGO DE PAREAMENTO: ${code}`);
                console.log(`================================\n`);
                const current = sessions.get(sessionId) || {};
                sessions.set(sessionId, { ...current, pairingCode: code, status: 'pairing', webhookUrl });
            }
            catch (error) {
                console.error('Erro code:', error);
            }
        }, 3000);
    }
    // --- ESCUTAR MENSAGENS (COM LOG GIGANTE) ---
    sock.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe)
                return;
            // Busca URL
            let targetUrl = webhookUrl;
            if (!targetUrl) {
                const current = sessions.get(sessionId);
                targetUrl = current?.webhookUrl;
            }
            if (!targetUrl) {
                const saved = loadConfig();
                targetUrl = saved[sessionId]?.webhookUrl;
            }
            // EXTRAI O TEXTO
            const texto = msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                msg.message.imageMessage?.caption ||
                '[Mídia/Outros]';
            const remetente = msg.pushName || 'Desconhecido';
            const telefone = msg.key.remoteJid?.split('@')[0];
            // LOG VISUAL PARA VOCÊ VER NO TERMINAL
            console.log('\n🟢 ==================================================');
            console.log(`📩 MENSAGEM RECEBIDA DE: ${remetente} (${telefone})`);
            console.log(`📝 CONTEÚDO: "${texto}"`);
            if (targetUrl) {
                console.log(`🚀 ENVIANDO PARA WEBHOOK: ${targetUrl}`);
                const payload = {
                    event: 'message.received',
                    session: sessionId,
                    phone: telefone,
                    name: remetente,
                    message: texto,
                    timestamp: new Date().toISOString()
                };
                fetch(targetUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                    .then(res => console.log(`✅ WEBHOOK STATUS: ${res.status}`))
                    .catch(err => console.error(`❌ WEBHOOK FALHOU: ${err.message}`));
            }
            else {
                console.log(`⚠️ SEM WEBHOOK CONFIGURADO!`);
            }
            console.log('================================================== 🟢\n');
        }
        catch (error) {
            console.error("Erro msg:", error);
        }
    });
    // Gerenciamento de Conexão
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            const current = sessions.get(sessionId) || {};
            sessions.set(sessionId, { ...current, qrCode: qr, status: 'qrcode', webhookUrl });
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== baileys_1.DisconnectReason.loggedOut;
            console.log(`[Status] Conexão caiu. Reconectar? ${shouldReconnect}`);
            if (shouldReconnect) {
                // DELAY DE 5 SEGUNDOS PARA EVITAR LOOP
                setTimeout(() => {
                    (0, exports.startSession)(sessionId, undefined, webhookUrl);
                }, 5000);
            }
            else {
                if (fs_1.default.existsSync(authPath))
                    fs_1.default.rmSync(authPath, { recursive: true, force: true });
                removeConfig(sessionId);
                sessions.delete(sessionId);
            }
        }
        else if (connection === 'open') {
            console.log(`[Status] ✅ Sessão ${sessionId} CONECTADA!`);
            const current = sessions.get(sessionId) || {};
            sessions.set(sessionId, { ...current, socket: sock, status: 'connected', webhookUrl });
        }
    });
    sock.ev.on('creds.update', saveCreds);
    const current = sessions.get(sessionId) || {};
    sessions.set(sessionId, { ...current, socket: sock, status: 'connecting', webhookUrl });
    return { socket: sock, status: 'connecting', webhookUrl };
};
exports.startSession = startSession;
// ... Funções auxiliares (getSession, deleteSession, sendMedia) ...
const getSession = (sessionId) => sessions.get(sessionId);
exports.getSession = getSession;
const deleteSession = (sessionId) => {
    const session = sessions.get(sessionId);
    if (session?.socket)
        session.socket.end(undefined);
    sessions.delete(sessionId);
    const authPath = `auth_info_baileys/${sessionId}`;
    if (fs_1.default.existsSync(authPath))
        fs_1.default.rmSync(authPath, { recursive: true, force: true });
    removeConfig(sessionId);
    return true;
};
exports.deleteSession = deleteSession;
const sendMedia = async (sessionId, number, type, url, caption, fileName) => {
    const session = sessions.get(sessionId);
    if (!session || session.status !== 'connected')
        throw new Error("Sessão off.");
    const jid = `${number.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    let msg = {};
    if (type === 'image')
        msg = { image: { url }, caption };
    else if (type === 'video')
        msg = { video: { url }, caption };
    else if (type === 'document')
        msg = { document: { url }, mimetype: 'application/octet-stream', fileName, caption };
    return await session.socket.sendMessage(jid, msg);
};
exports.sendMedia = sendMedia;
