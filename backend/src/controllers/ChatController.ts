import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ChatController {

    // Lista contatos para a barra lateral do chat
    async getContacts(req: Request, res: Response) {
        try {
            // 1. Busca contatos que já têm mensagens na tabela ChatMessage
            const chatContacts = await prisma.chatMessage.findMany({
                distinct: ['remoteJid'],
                select: {
                    remoteJid: true,
                    timestamp: true,
                    content: true
                },
                orderBy: { timestamp: 'desc' }
            });

            // 2. Busca alvos recentes de campanhas (MensagemLog)
            // Isso garante que o contato apareça na lista assim que enviamos uma campanha, 
            // mesmo antes dele responder (status "ENVIADO/ENTREGUE")
            const campaignTargets = await prisma.mensagemLog.findMany({
                take: 50, // Limita para performance
                orderBy: { dataEnvio: 'desc' },
                select: { destinatario: true, status: true, dataEnvio: true }
            });

            // 3. Mescla as duas listas (Priorizando Chat Real)
            const contactMap = new Map();

            // Adiciona alvos de campanha primeiro
            campaignTargets.forEach(c => {
                // Normaliza o JID (adiciona @s.whatsapp.net se faltar)
                const jid = c.destinatario.includes('@') ? c.destinatario : `${c.destinatario}@s.whatsapp.net`;
                
                contactMap.set(jid, {
                    jid,
                    name: c.destinatario.replace('@s.whatsapp.net', ''), 
                    lastMessage: `Campanha: ${c.status}`,
                    time: c.dataEnvio,
                    source: 'campanha'
                });
            });

            // Adiciona/Sobrescreve com conversas reais (ChatMessage tem prioridade de "atualidade")
            chatContacts.forEach(c => {
                contactMap.set(c.remoteJid, {
                    jid: c.remoteJid,
                    name: c.remoteJid.split('@')[0],
                    lastMessage: c.content.substring(0, 40) + (c.content.length > 40 ? '...' : ''),
                    time: c.timestamp,
                    source: 'chat'
                });
            });

            // Converte o mapa para array e ordena pela data mais recente
            const sortedContacts = Array.from(contactMap.values()).sort((a: any, b: any) => 
                new Date(b.time).getTime() - new Date(a.time).getTime()
            );

            return res.json(sortedContacts);

        } catch (error) {
            console.error("Erro ChatController:", error);
            return res.status(500).json({ error: 'Erro ao listar contatos' });
        }
    }

    // Busca o histórico de mensagens de um contato específico
    async getMessages(req: Request, res: Response) {
        const { jid } = req.params;
        try {
            const messages = await prisma.chatMessage.findMany({
                where: { remoteJid: jid },
                orderBy: { timestamp: 'asc' } // Ordem cronológica para o chat
            });
            return res.json(messages);
        } catch (error) {
            return res.status(500).json({ error: 'Erro ao buscar mensagens' });
        }
    }
}