import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@dispia.com';
  const password = 'admin'; // Senha simples para entrar agora

  console.log(`🔨 Iniciando criação do Super Admin...`);

  // 1. Cria a Empresa Matriz se não existir
  let client = await prisma.client.findFirst({ where: { name: 'Matriz SaaS' } });

  if (!client) {
      client = await prisma.client.create({
          data: {
              name: 'Matriz SaaS',
              planName: 'ILIMITADO',
              maxUsers: 9999,
              maxInstances: 9999,
              status: 'ACTIVE'
          }
      });
      console.log('✅ Empresa Matriz criada.');
  }

  // 2. Cria ou Atualiza o Usuário
  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
      where: { email },
      update: {
          password: hash,
          role: 'SUPER_ADMIN',
          clientId: client.id
      },
      create: {
          email,
          name: 'Super Admin',
          password: hash,
          role: 'SUPER_ADMIN',
          clientId: client.id
      }
  });

  console.log(`\n🎉 SUCESSO! USUÁRIO CRIADO/ATUALIZADO.`);
  console.log(`Email: ${user.email}`);
  console.log(`Senha: ${password}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });