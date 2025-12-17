"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const wabot_1 = require("./wabot");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// --- LÓGICA DE DETETIVE ---
// Vamos tentar achar a pasta public e imprimir no terminal
let publicPath = path_1.default.resolve(__dirname, '../public');
// Se não achar na dist, tenta na raiz
if (!fs_1.default.existsSync(publicPath)) {
    publicPath = path_1.default.resolve(process.cwd(), 'public');
}
console.log('\n==================================================');
console.log('🕵️‍♂️ DETETIVE DE ARQUIVOS INICIADO');
console.log(`📂 O servidor está servindo arquivos desta pasta:`);
console.log(`👉 ${publicPath}`);
console.log('==================================================\n');
app.use(express_1.default.static(publicPath));
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(publicPath, 'painel_v3.html'));
});
// ... O RESTO DO CÓDIGO CONTINUA IGUAL ...
const PORT = Number(process.env.PORT) || 3000;
app.use((req, res, next) => {
    if (!req.path.includes('.'))
        console.log(`[Request] ${req.method} ${req.path}`);
    next();
});
app.post('/session/start', async (req, res) => {
    const { sessionId, phoneNumber, webhookUrl } = req.body; // <--- GARANTINDO QUE WEBHOOK ESTÁ AQUI
    if (!sessionId) {
        res.status(400).json({ error: 'sessionId obrigatório' });
        return;
    }
    const session = (0, wabot_1.getSession)(sessionId);
    if (session && session.status === 'connected') {
        res.json({ status: 'connected', message: 'Sessão já ativa.' });
        return;
    }
    await (0, wabot_1.startSession)(sessionId, phoneNumber, webhookUrl);
    setTimeout(() => {
        const currentSession = (0, wabot_1.getSession)(sessionId);
        res.json({
            status: currentSession?.status || 'initializing',
            qrCode: currentSession?.qrCode || null,
            pairingCode: currentSession?.pairingCode || null
        });
    }, 4000);
});
// ... MANTENHA AS OUTRAS ROTAS IGUAIS ...
app.get('/session/status', (req, res) => {
    const sessionId = req.query.sessionId;
    if (!sessionId) {
        res.status(400).json({ error: 'sessionId obrigatório' });
        return;
    }
    const session = (0, wabot_1.getSession)(sessionId);
    if (!session) {
        res.json({ status: 'not_found' });
        return;
    }
    res.json({ status: session.status, qrCode: session.qrCode, pairingCode: session.pairingCode });
});
app.post('/session/logout', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
        res.status(400).json({ error: 'sessionId obrigatório' });
        return;
    }
    (0, wabot_1.deleteSession)(sessionId);
    res.json({ message: `Sessão ${sessionId} removida.` });
});
app.post('/message/text', async (req, res) => {
    const { sessionId, number, message } = req.body;
    const session = (0, wabot_1.getSession)(sessionId);
    if (!session || session.status !== 'connected') {
        res.status(400).json({ error: 'Sessão desconectada' });
        return;
    }
    try {
        const jid = number.includes('@s.whatsapp.net') ? number : `${number}@s.whatsapp.net`;
        await session.socket.sendMessage(jid, { text: message });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Falha ao enviar', details: error });
    }
});
app.post('/message/media', async (req, res) => {
    const { sessionId, number, type, url, caption, fileName } = req.body;
    if (!sessionId || !number || !type || !url) {
        res.status(400).json({ error: 'Dados incompletos' });
        return;
    }
    try {
        await (0, wabot_1.sendMedia)(sessionId, number, type, url, caption, fileName);
        res.json({ success: true, message: 'Mídia enviada' });
    }
    catch (error) {
        res.status(500).json({ error: 'Erro ao enviar mídia' });
    }
});
// Rota de teste webhook
app.post('/webhook/test', (req, res) => {
    console.log('\n========= 🔔 WEBHOOK RECEBIDO =========');
    console.log(JSON.stringify(req.body, null, 2));
    console.log('=======================================\n');
    res.status(200).send('OK');
});
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Zap Fácil] API rodando na porta ${PORT}`);
});
