import express, { Request, Response } from 'express';
import { startSession, getSession, deleteSession, sendMediaBuffer, formatNumberBR, globalLogs, serverInfo, sessionStats, initSessions } from './wabot';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import cors from 'cors';
import { routes } from './routes';
import { CampaignDispatcher } from './services/CampaignDispatcher';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } }); // Limite aumentado para 50MB
const publicPath = path.resolve(__dirname, '../public');
app.use(express.static(publicPath));

// === ROTAS DO SISTEMA ===
app.use('/api', routes);

app.get('/', (req: Request, res: Response) => {
    const painelV3 = path.join(publicPath, 'painel_v3.html');
    res.sendFile(fs.existsSync(painelV3) ? painelV3 : path.join(publicPath, 'index.html'));
});

const PORT = Number(process.env.PORT) || 3000;

// === ROTAS DE SESSÃO WHATSAPP ===

app.post('/api/session/start', async (req: Request, res: Response) => {
    let { sessionId, phoneNumber, webhookUrl } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'sessionId obrigatório' });
    sessionId = sessionId.trim();
    
    const session = getSession(sessionId);
    if (session && (session.status === 'connected' || session.status === 'reconnecting')) {
        return res.json({ status: session.status, message: 'Sessão já ativa.' });
    }
    
    await startSession(sessionId, phoneNumber, webhookUrl);
    
    // Aguarda um pouco para dar tempo do QR Code ser gerado
    setTimeout(() => {
        const currentSession = getSession(sessionId);
        res.json({ 
            status: currentSession?.status || 'initializing', 
            qrCode: currentSession?.qrCode || null, 
            pairingCode: currentSession?.pairingCode || null 
        });
    }, 4000); 
});

app.get('/api/session/status', (req: Request, res: Response) => {
    const sessionId = (req.query.sessionId as string)?.trim();
    if (!sessionId) return res.status(400).json({ error: 'ID obrigatório' });
    const session = getSession(sessionId);
    if (!session) return res.json({ status: 'not_found' });
    res.json({ 
        status: session.status, 
        qrCode: session.qrCode, 
        pairingCode: session.pairingCode, 
        phoneNumber: session.phoneNumber, 
        serverInfo: serverInfo 
    });
});

app.post('/api/session/logout', (req: Request, res: Response) => {
    deleteSession(req.body.sessionId?.trim());
    res.json({ message: `Sessão removida.` });
});

// LOGS & STATS
app.get('/api/admin/logs', (req: Request, res: Response) => { res.json({ logs: globalLogs }); });
app.get('/api/admin/stats', (req: Request, res: Response) => { res.json(sessionStats); });

// ENVIO DE MENSAGEM AVULSA
app.post('/api/message/text', async (req: Request, res: Response) => {
    let { sessionId, number, message } = req.body;
    if(!sessionId) return res.status(400).json({error: 'Sem ID'});
    
    const session = getSession(sessionId.trim());
    if (!session || session.status !== 'connected') { return res.status(400).json({ error: 'Sessão instável ou off' }); }
    
    try {
        const jid = `${formatNumberBR(number)}@s.whatsapp.net`;
        await session.socket.sendMessage(jid, { text: message });
        res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/api/message/upload', (req: any, res: any) => {
    upload.single('file')(req, res, async (err: any) => {
        if (err) return res.status(500).json({ error: err.message });
        let { sessionId, number, type, caption } = req.body;
        if (!req.file) return res.status(400).json({ error: 'Sem arquivo.' });
        try {
            await sendMediaBuffer(sessionId?.trim(), number, type, req.file.buffer, req.file.mimetype, caption, req.file.originalname);
            res.json({ success: true });
        } catch (error: any) { res.status(500).json({ error: error.message }); }
    });
});

app.post('/api/webhook/test', (req, res) => { res.status(200).send('OK'); });

// === INICIALIZAÇÃO DO SERVIDOR ===

app.listen(PORT, '0.0.0.0', async () => { 
    console.log(`\n🚀 DispIA Backend rodando na porta ${PORT}\n`); 
    
    // 1. Inicia o Motor de Campanhas
    CampaignDispatcher.startLoop();

    // 2. Restaura sessões salvas no disco
    await initSessions();
});