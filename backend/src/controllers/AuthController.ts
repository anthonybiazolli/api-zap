import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = 'segredo_super_secreto_mudar_em_prod';

export class AuthController {

  async login(req: Request, res: Response) {
    const { email, password } = req.body;

    // Busca usuário e dados do Cliente (Plano)
    const user = await prisma.user.findUnique({ 
        where: { email },
        include: { client: true } 
    });

    if (!user || !user.client) return res.status(400).json({ error: 'Credenciais inválidas.' });
    if (user.client.status !== 'ACTIVE') return res.status(403).json({ error: 'Empresa bloqueada.' });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(400).json({ error: 'Credenciais inválidas.' });

    const token = jwt.sign({ id: user.id, role: user.role, clientId: user.clientId }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({ 
        token, 
        user: { 
            id: user.id, 
            name: user.name, 
            role: user.role,
            clientName: user.client.name,
            limits: {
                users: user.client.maxUsers,
                instances: user.client.maxInstances
            }
        }
    });
  }
}