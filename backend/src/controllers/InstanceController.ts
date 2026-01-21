import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { startSession, getSession, deleteSession } from '../wabot';

const prisma = new PrismaClient();

// Gera ID curto (Ex: 9X2A1B)
const generateShortId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

export class InstanceController {

  // Criar Instância (CORRIGIDO O ERRO DE NOME)
  async create(req: Request, res: Response) {
      const { userId } = req.body;
      
      try {
          const user = await prisma.user.findUnique({ 
              where: { id: userId },
              include: { client: true }
          });

          if (!user || !user.client) {
              return res.status(400).json({ error: 'Usuário sem empresa vinculada.' });
          }

          // Checa limite da EMPRESA
          const count = await prisma.instance.count({ where: { clientId: user.client.id } });
          
          if (count >= user.client.maxInstances) {
              return res.status(403).json({ error: `Limite de ${user.client.maxInstances} sessões atingido para sua empresa.` });
          }

          // Gera o nome automático
          const autoName = `ID-${generateShortId()}`;

          const instance = await prisma.instance.create({
              data: {
                  name: autoName, // <--- O ERRO ESTAVA AQUI (GARANTINDO QUE VAI)
                  clientId: user.client.id,
                  ownerId: user.id, 
                  status: 'disconnected'
              }
          });
          return res.json(instance);

      } catch (e: any) { 
          console.error("Erro Create Instance:", e);
          return res.status(500).json({ error: 'Erro interno ao criar sessão.' }); 
      }
  }

  async listByUser(req: Request, res: Response) {
      const { userId } = req.params;
      try {
        const user = await prisma.user.findUnique({ where: { id: userId }, include: { client: true } });
        if (!user || !user.client) return res.json([]);

        let whereCondition: any = { clientId: user.client.id };
        
        // Vendedor vê só o dele. Admin vê tudo.
        if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
            whereCondition.ownerId = user.id;
        }

        const instances = await prisma.instance.findMany({ 
            where: whereCondition,
            orderBy: { createdAt: 'desc' },
            include: { owner: { select: { name: true } } }
        });
        
        const result = instances.map(inst => {
            const session = getSession(inst.id);
            return { 
                ...inst, 
                statusReal: session?.status || 'disconnected', 
                qrCode: session?.qrCode 
            };
        });
        return res.json(result);
      } catch (e) { return res.status(500).json({ error: 'Erro ao listar' }); }
  }
  
  async connect(req: Request, res: Response) {
      const { id } = req.params;
      try {
        const instance = await prisma.instance.findUnique({ where: { id } });
        if(!instance) return res.status(404).json({ error: '404' });
        await startSession(instance.id);
        return res.json({ message: 'Iniciando...', instanceId: instance.id });
      } catch (e) { return res.status(500).json({ error: 'Erro' }); }
  }

  async logout(req: Request, res: Response) {
      const { id } = req.params;
      try {
        deleteSession(id);
        await prisma.instance.update({ where: { id }, data: { status: 'disconnected' } });
        return res.json({ message: 'Desconectado' });
      } catch (e) { return res.status(500).json({ error: 'Erro' }); }
  }

  // === NOVA FUNÇÃO: DELETAR INSTÂNCIA ===
  async delete(req: Request, res: Response) {
      const { id } = req.params;
      try {
          // 1. Derruba a sessão no Baileys
          deleteSession(id);
          
          // 2. Remove do Banco de Dados
          await prisma.instance.delete({ where: { id } });
          
          return res.json({ message: 'Instância removida com sucesso.' });
      } catch (e) {
          console.error(e);
          return res.status(500).json({ error: 'Erro ao excluir instância.' });
      }
  }
}