# dispia-frontend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Instala dependências (incluindo --legacy-peer-deps se der erro de versão)
RUN npm install --legacy-peer-deps

COPY . .

# Expõe a porta do frontend
EXPOSE 3001

# Define variável de ambiente para porta customizada
ENV PORT 3001

CMD ["npm", "run", "dev"]