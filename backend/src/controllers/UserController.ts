import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Readable } from 'stream';
import { GoogleDriveService } from '../services/GoogleDriveService';

const prisma = new PrismaClient();

// Helper para gerar ID curto para o nome da instância
const generateShortId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export class UserController {

  // 1. LISTAR EQUIPE
  // Retorna os usuários vinculados ao mesmo Client (Empresa SaaS)
  async listMyTeam(req: Request, res: Response) {
      const { clientId } = req.params;
      try {
          if (!clientId || clientId === 'null' || clientId === 'undefined') {
              return res.json([]);
          }

          const users = await prisma.user.findMany({
              where: { clientId },
              select: { 
                  id: true, 
                  name: true, 
                  email: true, 
                  role: true, 
                  profilePicUrl: true, 
                  createdAt: true 
              },
              orderBy: { createdAt: 'desc' }
          });
          return res.json(users);
      } catch (e) { 
          console.error("Erro listMyTeam:", e);
          return res.status(500).json({ error: 'Erro ao listar equipe.' }); 
      }
  }

  // 2. CRIAR MEMBRO DA EQUIPE
  // Cria o usuário e já cria uma instância (WhatsApp) vinculada a ele
  async createMember(req: Request, res: Response) {
      const { name, email, password, role, creatorId } = req.body;
      
      try {
          // Verifica quem está criando (para saber qual é a empresa/client)
          const creator = await prisma.user.findUnique({ 
              where: { id: creatorId }, 
              include: { client: true } 
          });

          if (!creator || !creator.client) {
              return res.status(403).json({ error: 'Permissão negada. Criador não identificado.' });
          }

          const empresaId = creator.client.id; 
          
          // Verifica Limite de Usuários do Plano
          const count = await prisma.user.count({ where: { clientId: empresaId } });
          if (count >= creator.client.maxUsers) {
              return res.status(403).json({ error: `Limite de usuários do plano atingido (${creator.client.maxUsers}).` });
          }

          // Verifica se email já existe
          const exists = await prisma.user.findUnique({ where: { email } });
          if (exists) return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });

          const hash = await bcrypt.hash(password, 10);
          const instanceName = `ID-${generateShortId()}`; 

          // Transação: Cria Usuário + Cria Instância para ele
          const result = await prisma.$transaction(async (tx) => {
              const newUser = await tx.user.create({
                  data: { 
                      name, 
                      email, 
                      password: hash, 
                      role: role || 'AGENT', 
                      clientId: empresaId 
                  }
              });

              // Cria a instância desconectada automaticamente
              await tx.instance.create({
                  data: { 
                      name: instanceName, 
                      status: 'disconnected', 
                      clientId: empresaId, 
                      ownerId: newUser.id 
                  }
              });

              return newUser;
          });

          return res.json(result);

      } catch (e: any) { 
          console.error("Erro createMember:", e);
          return res.status(500).json({ error: 'Erro ao criar usuário.' }); 
      }
  }

  // 3. DELETAR MEMBRO
  async deleteMember(req: Request, res: Response) {
      const { id } = req.params;
      try {
          // Ao deletar o usuário, o Prisma (Cascade) deleta as instâncias dele
          await prisma.user.delete({ where: { id } });
          return res.json({ message: 'Usuário removido com sucesso.' });
      } catch (e) { 
          return res.status(500).json({ error: 'Erro ao remover usuário.' }); 
      }
  }

  // 4. ATUALIZAR PERFIL (COM FOTO)
  async updateProfile(req: Request, res: Response) {
      const { id } = req.params;
      const { password, name } = req.body;
      const file = req.file; // Vem do Multer

      try {
          const updateData: any = {};
          
          if (name) updateData.name = name;
          if (password && password.trim() !== '') {
              updateData.password = await bcrypt.hash(password, 10);
          }

          // Upload de Foto para o Google Drive
          if (file) {
              console.log(`[PROFILE] Iniciando upload de foto para user ${id}...`);
              const stream = new Readable();
              stream.push(file.buffer);
              stream.push(null);
              
              const fileName = `profile_${id}_${Date.now()}.jpg`;
              
              // Usa o serviço que já configuramos e corrigimos
              const driveLink = await GoogleDriveService.uploadBaileysMedia(stream, fileName, file.mimetype);
              
              if (driveLink) {
                  updateData.profilePicUrl = driveLink;
                  console.log(`[PROFILE] Foto atualizada: ${driveLink}`);
              } else {
                  console.error(`[PROFILE] Falha ao subir foto no Drive.`);
              }
          }

          const user = await prisma.user.update({
              where: { id },
              data: updateData,
              select: { id: true, name: true, email: true, role: true, profilePicUrl: true }
          });

          return res.json(user);

      } catch (e) {
          console.error("Erro updateProfile:", e);
          return res.status(500).json({ error: 'Erro ao atualizar perfil.' });
      }
  }
}