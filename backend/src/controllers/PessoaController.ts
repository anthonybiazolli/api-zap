import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class PessoaController {
  async upsert(req: Request, res: Response) {
    const { cpf, nomeCompleto, email, telefone, endereco } = req.body;

    try {
      if (cpf) {
        const pessoa = await prisma.pessoaFisica.upsert({
          where: { cpf },
          update: { nomeCompleto, email, telefone, endereco },
          create: { cpf, nomeCompleto, email, telefone, endereco }
        });
        return res.json(pessoa);
      } else {
        const pessoa = await prisma.pessoaFisica.create({
          data: { nomeCompleto, email, telefone, endereco }
        });
        return res.json(pessoa);
      }
    } catch (error: any) {
      return res.status(500).json({ error: 'Erro ao salvar pessoa', details: error.message });
    }
  }
}