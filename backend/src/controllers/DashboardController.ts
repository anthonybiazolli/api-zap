import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { getSession, sessionStats, serverInfo } from '../wabot';

const prisma = new PrismaClient();

export class DashboardController {
  
  async getSummary(req: Request, res: Response) {
    try {
        // 1. Dados do Banco
        const totalEmpresas = await prisma.empresa.count();
        const campanhasAtivas = await prisma.campanha.count({ where: { status: 'RODANDO' } });
        
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        const enviosHojeDB = await prisma.mensagemLog.count({
            where: { dataEnvio: { gte: hoje } }
        });

        // 2. Dados da Sessão WhatsApp
        const session = getSession('teste2') || getSession('default'); 
        const statusWpp = session?.status || 'disconnected';
        
        // Pega o QR Code se estiver aguardando leitura
        const qrCode = (statusWpp === 'qrcode' || statusWpp === 'initializing') ? session?.qrCode : null;

        res.json({
            cards: {
                empresas: totalEmpresas,
                campanhas: campanhasAtivas,
                enviosHoje: enviosHojeDB,
                statusConexao: statusWpp,
                ipServidor: serverInfo?.ip || 'Local',
                qrCode: qrCode // <--- Envia o QR para o front
            },
            grafico: {
                enviadas: sessionStats.envios,
                lidas: sessionStats.lidos,
                respostas: sessionStats.respostas
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao gerar dashboard' });
    }
  }
}