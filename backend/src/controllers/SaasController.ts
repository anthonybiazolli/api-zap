import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export class SaasController {

  // Criar Novo Cliente (Empresa) + Usuário Admin
  async createClient(req: Request, res: Response) {
      const { companyName, planName, maxUsers, maxInstances, adminName, adminEmail, adminPassword } = req.body;

      try {
          const exists = await prisma.user.findUnique({ where: { email: adminEmail } });
          if (exists) return res.status(400).json({ error: 'Email já cadastrado.' });

          const hash = await bcrypt.hash(adminPassword, 10);

          const result = await prisma.$transaction(async (tx) => {
              const client = await tx.client.create({
                  data: {
                      name: companyName,
                      planName: planName || 'Standard',
                      maxUsers: Number(maxUsers) || 1,
                      maxInstances: Number(maxInstances) || 1,
                      status: 'ACTIVE'
                  }
              });

              const user = await tx.user.create({
                  data: {
                      name: adminName,
                      email: adminEmail,
                      password: hash,
                      role: 'ADMIN',
                      clientId: client.id
                  }
              });

              return { client, user };
          });

          return res.json({ status: 'sucesso', data: result });

      } catch (e) {
          console.error(e);
          return res.status(500).json({ error: 'Erro ao criar cliente SaaS.' });
      }
  }

  // Listar Clientes
  async listClients(req: Request, res: Response) {
      try {
          const clients = await prisma.client.findMany({
              orderBy: { createdAt: 'desc' },
              include: { 
                  _count: { select: { users: true, instances: true } } 
              }
          });
          return res.json(clients);
      } catch (e) { return res.status(500).json({ error: 'Erro ao listar.' }); }
  }

  // Atualizar Cliente (Editar Plano/Limites)
  async updateClient(req: Request, res: Response) {
      const { id } = req.params;
      const { name, planName, maxUsers, maxInstances } = req.body;
      try {
          const updated = await prisma.client.update({
              where: { id },
              data: { 
                  name, 
                  planName, 
                  maxUsers: Number(maxUsers), 
                  maxInstances: Number(maxInstances) 
              }
          });
          return res.json(updated);
      } catch (e) { return res.status(500).json({ error: 'Erro ao atualizar.' }); }
  }

  // Bloquear/Desbloquear Cliente
  async toggleStatus(req: Request, res: Response) {
      const { id } = req.params;
      try {
          const client = await prisma.client.findUnique({ where: { id } });
          if (!client) return res.status(404).json({ error: 'Cliente não encontrado' });

          const newStatus = client.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
          
          await prisma.client.update({ where: { id }, data: { status: newStatus } });
          return res.json({ status: newStatus });
      } catch (e) { return res.status(500).json({ error: 'Erro ao alterar status.' }); }
  }

  // === NOVO: EXCLUIR CLIENTE ===
  async deleteClient(req: Request, res: Response) {
      const { id } = req.params;
      try {
          // O "Cascade" do banco (configurado no schema.prisma) vai apagar users e instances automaticamente
          await prisma.client.delete({ where: { id } });
          return res.json({ message: 'Cliente e todos os seus dados foram removidos com sucesso.' });
      } catch (e) {
          console.error("Erro Delete Client:", e);
          return res.status(500).json({ error: 'Erro ao excluir cliente. Verifique dependências ou tente novamente.' });
      }
  }

  // Rota de Emergência para criar VOCÊ (Super Admin)
  async setupSuperAdmin(req: Request, res: Response) {
      const count = await prisma.user.count();
      if (count > 0) return res.status(403).json({ error: 'Sistema já possui usuários.' });

      const hash = await bcrypt.hash('admin123', 10);
      
      const client = await prisma.client.create({
          data: { name: 'Matriz SaaS', planName: 'ILIMITADO', maxUsers: 999, maxInstances: 999 }
      });

      await prisma.user.create({
          data: {
              name: 'Super Admin',
              email: 'admin@dispia.com',
              password: hash,
              role: 'SUPER_ADMIN',
              clientId: client.id
          }
      });

      return res.json({ msg: 'Super Admin criado.' });
  }
}