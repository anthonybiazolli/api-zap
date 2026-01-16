# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Instala dependências do sistema necessárias para compilação
RUN apk add --no-cache python3 make g++ git

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia todo o resto do projeto
COPY . .

# Expõe a porta 3000
EXPOSE 3000

# Comando para iniciar (usando ts-node direto é mais seguro em produção que nodemon)
# Certifique-se que no seu package.json tenha um script "start": "ts-node src/index.ts"
# Se não tiver, o comando abaixo garante a execução:
CMD ["npx", "ts-node", "src/index.ts"]