#!/bin/bash

# Cores para o output do Robô
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║             INICIANDO PROTOCOLO DE RESET TOTAL               ║"
echo "║             ROBÔ: SYSTEM-CLEANER-V1                          ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 1. Solicitar Super-Privilégios imediatamente
echo -e "${YELLOW}[ROBO] Verificando permissões de Super-Usuário (ROOT)...${NC}"
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}[ERRO] Por favor, execute como root ou use sudo.${NC}"
  echo "Exemplo: sudo ./reset-robot.sh"
  exit
fi
echo -e "${GREEN}[OK] Permissão de Admin concedida.${NC}"

# 2. Derrubar Containers e limpar Docker
echo -e "\n${YELLOW}[ROBO] Passo 1: Derrubando containers e limpando Docker...${NC}"
docker-compose down --volumes --remove-orphans --rmi all
# Forçar limpeza de containers parados e redes órfãs
docker system prune -f

# 3. Limpeza Profunda de Arquivos Locais (Node Modules e Builds)
# Isso é crucial porque seus volumes locais ./backend e ./frontend montam esses arquivos
# Se não apagar aqui, o Docker vai puxar o lixo da instalação local anterior.
echo -e "\n${YELLOW}[ROBO] Passo 2: Exterminando arquivos locais (node_modules, builds, caches)...${NC}"

echo " - Limpando Backend..."
rm -rf backend/node_modules
rm -rf backend/dist
rm -rf backend/package-lock.json
# Apaga a migração antiga se quiser recriar o banco do zero absoluto (Opcional, removi o comentário por segurança, mas descomente se quiser limpar as migrações também)
# rm -rf backend/prisma/migrations 

echo " - Limpando Frontend..."
rm -rf dispia-frontend/node_modules
rm -rf dispia-frontend/.next
rm -rf dispia-frontend/out
rm -rf dispia-frontend/package-lock.json

echo -e "${GREEN}[OK] Sistema de arquivos limpo.${NC}"

# 4. Reconstrução e Inicialização
echo -e "\n${YELLOW}[ROBO] Passo 3: Reconstruindo a infraestrutura do zero...${NC}"
echo -e "${CYAN}[INFO] Isso pode demorar alguns minutos dependendo da internet.${NC}"

# O comando 'up' sem o '-d' prende o terminal e mostra os logs (o que você pediu)
# O '--build' força a recriação das imagens
docker-compose up --build