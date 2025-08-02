#!/bin/bash

# Script de build para o Sistema AURA
set -e

echo "🚀 Iniciando build do Sistema AURA..."

# Definir variáveis
PROJECT_ROOT=$(pwd)
BUILD_DIR="$PROJECT_ROOT/dist"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUILD_VERSION=${BUILD_VERSION:-$TIMESTAMP}

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para log
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    error "Node.js não está instalado"
    exit 1
fi

# Verificar se npm está instalado
if ! command -v npm &> /dev/null; then
    error "npm não está instalado"
    exit 1
fi

log "Node.js version: $(node --version)"
log "npm version: $(npm --version)"

# Limpar build anterior
log "Limpando builds anteriores..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Build do Backend
log "📦 Fazendo build do backend..."
cd "$BACKEND_DIR"

# Instalar dependências
log "Instalando dependências do backend..."
npm ci --only=production

# Executar testes
if [ "${SKIP_TESTS:-false}" != "true" ]; then
    log "Executando testes do backend..."
    npm run test
    success "Testes do backend passaram"
else
    warning "Testes do backend foram pulados"
fi

# Build TypeScript
log "Compilando TypeScript..."
npm run build

# Verificar se o build foi bem-sucedido
if [ ! -d "dist" ]; then
    error "Build do backend falhou - diretório dist não encontrado"
    exit 1
fi

success "Build do backend concluído"

# Build do Frontend
log "🎨 Fazendo build do frontend..."
cd "$FRONTEND_DIR"

# Instalar dependências
log "Instalando dependências do frontend..."
npm ci

# Executar testes
if [ "${SKIP_TESTS:-false}" != "true" ]; then
    log "Executando testes do frontend..."
    npm run test -- --coverage --watchAll=false
    success "Testes do frontend passaram"
else
    warning "Testes do frontend foram pulados"
fi

# Build React
log "Compilando React..."
npm run build

# Verificar se o build foi bem-sucedido
if [ ! -d "build" ]; then
    error "Build do frontend falhou - diretório build não encontrado"
    exit 1
fi

success "Build do frontend concluído"

# Copiar arquivos para diretório de distribuição
log "📁 Organizando arquivos de distribuição..."
cd "$PROJECT_ROOT"

# Criar estrutura de diretórios
mkdir -p "$BUILD_DIR/backend"
mkdir -p "$BUILD_DIR/frontend"
mkdir -p "$BUILD_DIR/config"
mkdir -p "$BUILD_DIR/scripts"
mkdir -p "$BUILD_DIR/docs"

# Copiar backend
cp -r "$BACKEND_DIR/dist/"* "$BUILD_DIR/backend/"
cp "$BACKEND_DIR/package.json" "$BUILD_DIR/backend/"
cp "$BACKEND_DIR/package-lock.json" "$BUILD_DIR/backend/"

# Copiar frontend
cp -r "$FRONTEND_DIR/build/"* "$BUILD_DIR/frontend/"

# Copiar configurações
cp -r config/ "$BUILD_DIR/config/"

# Copiar scripts
cp -r scripts/ "$BUILD_DIR/scripts/"
chmod +x "$BUILD_DIR/scripts/"*.sh

# Copiar documentação
cp README.md "$BUILD_DIR/docs/"
cp -r docs/ "$BUILD_DIR/docs/" 2>/dev/null || true

# Copiar arquivos de configuração do projeto
cp docker-compose.yml "$BUILD_DIR/" 2>/dev/null || true
cp docker-compose.prod.yml "$BUILD_DIR/" 2>/dev/null || true

# Criar arquivo de versão
echo "{
  \"version\": \"$BUILD_VERSION\",
  \"buildDate\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"gitCommit\": \"$(git rev-parse HEAD 2>/dev/null || echo 'unknown')\",
  \"gitBranch\": \"$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')\",
  \"nodeVersion\": \"$(node --version)\",
  \"environment\": \"${NODE_ENV:-production}\"
}" > "$BUILD_DIR/version.json"

# Criar arquivo de manifesto
log "Criando manifesto de build..."
find "$BUILD_DIR" -type f -exec sha256sum {} \; | sed "s|$BUILD_DIR/||" > "$BUILD_DIR/MANIFEST"

# Calcular tamanho do build
BUILD_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)

# Criar arquivo de deployment
cat > "$BUILD_DIR/deploy.sh" << 'EOF'
#!/bin/bash
# Script de deployment gerado automaticamente

set -e

DEPLOY_DIR=${DEPLOY_DIR:-/opt/aura}
SERVICE_NAME=${SERVICE_NAME:-aura}

echo "🚀 Iniciando deployment do Sistema AURA..."

# Parar serviços
sudo systemctl stop $SERVICE_NAME || true

# Backup da versão anterior
if [ -d "$DEPLOY_DIR" ]; then
    sudo mv "$DEPLOY_DIR" "${DEPLOY_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Copiar nova versão
sudo mkdir -p "$DEPLOY_DIR"
sudo cp -r * "$DEPLOY_DIR/"

# Instalar dependências do backend
cd "$DEPLOY_DIR/backend"
sudo npm ci --only=production

# Configurar permissões
sudo chown -R aura:aura "$DEPLOY_DIR"
sudo chmod +x "$DEPLOY_DIR/scripts/"*.sh

# Executar migrações
cd "$DEPLOY_DIR"
sudo -u aura ./scripts/migrate.sh

# Iniciar serviços
sudo systemctl start $SERVICE_NAME
sudo systemctl enable $SERVICE_NAME

echo "✅ Deployment concluído com sucesso!"
EOF

chmod +x "$BUILD_DIR/deploy.sh"

# Criar arquivo de health check
cat > "$BUILD_DIR/health-check.sh" << 'EOF'
#!/bin/bash
# Health check script

API_URL=${API_URL:-http://localhost:8000}
TIMEOUT=${TIMEOUT:-30}

echo "🔍 Verificando saúde do sistema..."

# Verificar API
if curl -f -s --max-time $TIMEOUT "$API_URL/api/v1/health" > /dev/null; then
    echo "✅ API está respondendo"
else
    echo "❌ API não está respondendo"
    exit 1
fi

# Verificar banco de dados
if curl -f -s --max-time $TIMEOUT "$API_URL/api/v1/health/database" > /dev/null; then
    echo "✅ Banco de dados está conectado"
else
    echo "❌ Banco de dados não está conectado"
    exit 1
fi

# Verificar Redis
if curl -f -s --max-time $TIMEOUT "$API_URL/api/v1/health/redis" > /dev/null; then
    echo "✅ Redis está conectado"
else
    echo "❌ Redis não está conectado"
    exit 1
fi

echo "✅ Sistema está saudável!"
EOF

chmod +x "$BUILD_DIR/health-check.sh"

# Criar arquivo de rollback
cat > "$BUILD_DIR/rollback.sh" << 'EOF'
#!/bin/bash
# Script de rollback

set -e

DEPLOY_DIR=${DEPLOY_DIR:-/opt/aura}
SERVICE_NAME=${SERVICE_NAME:-aura}

echo "🔄 Iniciando rollback..."

# Encontrar backup mais recente
BACKUP_DIR=$(ls -td ${DEPLOY_DIR}.backup.* 2>/dev/null | head -1)

if [ -z "$BACKUP_DIR" ]; then
    echo "❌ Nenhum backup encontrado"
    exit 1
fi

echo "📦 Restaurando backup: $BACKUP_DIR"

# Parar serviços
sudo systemctl stop $SERVICE_NAME || true

# Mover versão atual para backup temporário
sudo mv "$DEPLOY_DIR" "${DEPLOY_DIR}.failed.$(date +%Y%m%d_%H%M%S)"

# Restaurar backup
sudo mv "$BACKUP_DIR" "$DEPLOY_DIR"

# Iniciar serviços
sudo systemctl start $SERVICE_NAME

echo "✅ Rollback concluído com sucesso!"
EOF

chmod +x "$BUILD_DIR/rollback.sh"

# Resumo do build
log "📊 Resumo do build:"
echo "  • Versão: $BUILD_VERSION"
echo "  • Tamanho: $BUILD_SIZE"
echo "  • Localização: $BUILD_DIR"
echo "  • Backend: $(find "$BUILD_DIR/backend" -name "*.js" | wc -l) arquivos JS"
echo "  • Frontend: $(find "$BUILD_DIR/frontend" -name "*.html" -o -name "*.js" -o -name "*.css" | wc -l) arquivos web"

# Verificar integridade
log "🔍 Verificando integridade do build..."
if [ -f "$BUILD_DIR/backend/index.js" ] && [ -f "$BUILD_DIR/frontend/index.html" ]; then
    success "Build concluído com sucesso! 🎉"
    echo ""
    echo "Para fazer deploy:"
    echo "  cd $BUILD_DIR && ./deploy.sh"
    echo ""
    echo "Para verificar saúde:"
    echo "  ./health-check.sh"
    echo ""
    echo "Para rollback:"
    echo "  ./rollback.sh"
else
    error "Build falhou - arquivos essenciais não encontrados"
    exit 1
fi