import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Função auxiliar para gerar ID curto (6 caracteres)
const generateShortId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export class UserController {

  // Listar Equipe
  async listMyTeam(req: Request, res: Response) {
      const { clientId } = req.params;
      try {
          // Garante que clientId não é 'null' ou 'undefined' na busca
          if (!clientId || clientId === 'null') return res.json([]);

          const users = await prisma.user.findMany({
              where: { clientId },
              select: { id: true, name: true, email: true, role: true, createdAt: true }
          });
          return res.json(users);
      } catch (e) { return res.status(500).json({ error: 'Erro ao listar equipe.' }); }
  }

  // Criar Novo Membro + Instância Automática
  async createMember(req: Request, res: Response) {
      const { name, email, password, role, creatorId } = req.body;

      try {
          // 1. Identificar criador e empresa
          const creator = await prisma.user.findUnique({ 
              where: { id: creatorId },
              include: { client: true } 
          });

          // Validação de Segurança
          if (!creator || !creator.client) {
              return res.status(403).json({ error: 'Permissão negada ou empresa não encontrada.' });
          }

          // === CORREÇÃO DO ERRO TYPESCRIPT ===
          // Usamos 'creator.client.id' (que sabemos que existe) em vez de 'creator.clientId' (que pode ser null)
          const empresaId = creator.client.id; 
          const maxUsers = creator.client.maxUsers;
          const maxInstances = creator.client.maxInstances;

          // 2. Verificar Limites de Usuários
          const currentUsers = await prisma.user.count({ where: { clientId: empresaId } });
          if (currentUsers >= maxUsers) {
              return res.status(403).json({ error: `Limite de ${maxUsers} usuários atingido.` });
          }

          // 3. Verificar Limites de Instâncias
          const currentInstances = await prisma.instance.count({ where: { clientId: empresaId } });
          if (currentInstances >= maxInstances) {
              return res.status(403).json({ error: `Limite de WhatsApps atingido. Faça upgrade do plano.` });
          }

          // 4. Verificar Email
          const exists = await prisma.user.findUnique({ where: { email } });
          if (exists) return res.status(400).json({ error: 'Email já cadastrado.' });

          const hash = await bcrypt.hash(password, 10);
          const instanceName = `ID-${generateShortId()}`; 

          // 5. Transação: Cria Usuário E Instância juntos
          const result = await prisma.$transaction(async (tx) => {
              // Cria o Usuário
              const newUser = await tx.user.create({
                  data: {
                      name, 
                      email, 
                      password: hash, 
                      role: role || 'AGENT', 
                      clientId: empresaId // <--- Correção aqui (Usa a string validada)
                  }
              });

              // Cria a Instância AUTOMATICAMENTE vinculada ao novo usuário
              await tx.instance.create({
                  data: {
                      name: instanceName,
                      status: 'disconnected',
                      clientId: empresaId, // <--- Correção aqui
                      ownerId: newUser.id 
                  }
              });

              return newUser;
          });

          return res.json(result);

      } catch (e: any) { 
          console.error(e);
          return res.status(500).json({ error: 'Erro ao criar usuário e sessão.' }); 
      }
  }

  // Remover Membro
  async deleteMember(req: Request, res: Response) {
      const { id } = req.params;
      try {
          await prisma.user.delete({ where: { id } });
          return res.json({ message: 'Removido.' });
      } catch (e) { return res.status(500).json({ error: 'Erro ao remover.' }); }
  }
}