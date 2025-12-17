# 1. Usa uma imagem leve e segura do Node.js 20 (Alpine Linux)
FROM node:20-alpine

# 2. Instala dependências de sistema necessárias (para bibliotecas de imagem como Sharp)
RUN apk add --no-cache \
    python3 \
    make \
    g++

# 3. Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# 4. Copia os arquivos de definição de dependências
COPY package*.json ./
COPY tsconfig.json ./

# 5. Instala as dependências do projeto (Modo Produção)
RUN npm install

# 6. Copia todo o código fonte do projeto
COPY . .

# 7. Compila o TypeScript para JavaScript
RUN npm run build

# 8. Expõe a porta 3000 (que definimos no código)
EXPOSE 3000

# 9. Comando que inicia o servidor quando o container ligar
CMD ["npm", "start"]