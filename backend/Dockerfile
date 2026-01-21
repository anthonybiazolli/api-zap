FROM node:20-alpine

WORKDIR /app

# Instala dependências do sistema e openssl (Essencial para o Prisma funcionar)
RUN apk add --no-cache python3 make g++ git openssl

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências do Node
RUN npm install

# Copia todo o resto do projeto
COPY . .

# Garante a geração do Prisma durante o build da imagem
RUN npx prisma generate

# Expõe a porta 3000
EXPOSE 3000

# COMANDO DE INICIALIZAÇÃO BLINDADO:
# 1. Gera o cliente do banco (npx prisma generate)
# 2. SÓ DEPOIS inicia o servidor (npx ts-node src/index.ts)
CMD ["sh", "-c", "npx prisma generate && npx ts-node src/index.ts"]