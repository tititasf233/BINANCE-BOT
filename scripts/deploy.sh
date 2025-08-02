#!/bin/bash

# Script de deployment para o Sistema AURA
set -e

# Configurações
DEPLOY_ENV=${DEPLOY_ENV:-production}
DEPLOY_DIR=${DEPLOY_DIR:-/opt/aura}
SERVICE_NAME=${SERVICE_NAME:-aura}
BACKUP_RETENTION=${BACKUP_RETENTION:-5}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-60}

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Verificar se está executando como root ou com sudo
if [ "$EUID" -ne 0 ]; then
    error "Este script deve ser executado como root ou com sudo"
    exit 1
fi

# Verificar se o diretório de build existe
BUILD_DIR=${BUILD_DIR:-$(pwd)}
if [ ! -f "$BUILD_DIR/version.json" ]; then
    error "Diretório de build inválido. Execute o script de build primeiro."
    exit 1
fi

# Ler informações da versão
VERSION=$(cat "$BUILD_DIR/version.json" | grep -o '"version":"[^"]*' | cut -d'"' -f4)
BUILD_DATE=$(cat "$BUILD_DIR/version.json" | grep -o '"buildDate":"[^"]*' | cut -d'"' -f4)

log "🚀 Iniciando deployment do Sistema AURA"
log "Versão: $VERSION"
log "Build: $BUILD_DATE"
log "Ambiente: $DEPLOY_ENV"

# Função para fazer backup
backup_current_version() {
    if [ -d "$DEPLOY_DIR" ]; then
        BACKUP_NAME="${DEPLOY_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
        log "📦 Fazendo backup da versão atual para: $BACKUP_NAME"
        mv "$DEPLOY_DIR" "$BACKUP_NAME"
        
        # Limpar backups antigos
        log "🧹 Limpando backups antigos (mantendo $BACKUP_RETENTION)..."
        ls -td ${DEPLOY_DIR}.backup.* 2>/dev/null | tail -n +$((BACKUP_RETENTION + 1)) | xargs rm -rf
    fi
}

# Função para verificar saúde do sistema
health_check() {
    log "🔍 Verificando saúde do sistema..."
    
    local timeout=$HEALTH_CHECK_TIMEOUT
    local api_url="http://localhost:8000"
    
    # Aguardar o serviço iniciar
    sleep 10
    
    for i in $(seq 1 $timeout); do
        if curl -f -s --max-time 5 "$api_url/api/v1/health" > /dev/null 2>&1; then
            success "Sistema está respondendo"
            return 0
        fi
        
        if [ $i -eq $timeout ]; then
            error "Sistema não respondeu dentro do timeout ($timeout segundos)"
            return 1
        fi
        
        echo -n "."
        sleep 1
    done
}

# Função para rollback
rollback() {
    error "Deployment falhou. Iniciando rollback..."
    
    # Parar serviços
    systemctl stop $SERVICE_NAME || true
    
    # Encontrar backup mais recente
    BACKUP_DIR=$(ls -td ${DEPLOY_DIR}.backup.* 2>/dev/null | head -1)
    
    if [ -n "$BACKUP_DIR" ]; then
        log "🔄 Restaurando backup: $BACKUP_DIR"
        
        # Mover versão falha
        if [ -d "$DEPLOY_DIR" ]; then
            mv "$DEPLOY_DIR" "${DEPLOY_DIR}.failed.$(date +%Y%m%d_%H%M%S)"
        fi
        
        # Restaurar backup
        mv "$BACKUP_DIR" "$DEPLOY_DIR"
        
        # Iniciar serviços
        systemctl start $SERVICE_NAME
        
        success "Rollback concluído"
    else
        error "Nenhum backup encontrado para rollback"
    fi
    
    exit 1
}

# Configurar trap para rollback em caso de erro
trap rollback ERR

# Verificar dependências
log "🔧 Verificando dependências..."

if ! command -v node &> /dev/null; then
    error "Node.js não está instalado"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    error "npm não está instalado"
    exit 1
fi

if ! command -v systemctl &> /dev/null; then
    error "systemctl não está disponível"
    exit 1
fi

# Parar serviços
log "⏹️  Parando serviços..."
systemctl stop $SERVICE_NAME || true

# Fazer backup da versão atual
backup_current_version

# Criar diretório de deployment
log "📁 Criando diretório de deployment..."
mkdir -p "$DEPLOY_DIR"

# Copiar arquivos
log "📋 Copiando arquivos..."
cp -r "$BUILD_DIR"/* "$DEPLOY_DIR/"

# Instalar dependências do backend
log "📦 Instalando dependências do backend..."
cd "$DEPLOY_DIR/backend"
npm ci --only=production --silent

# Configurar variáveis de ambiente
log "⚙️  Configurando variáveis de ambiente..."
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    if [ -f "/etc/aura/env" ]; then
        cp "/etc/aura/env" "$DEPLOY_DIR/.env"
    else
        warning "Arquivo .env não encontrado. Usando configuração padrão."
        echo "NODE_ENV=$DEPLOY_ENV" > "$DEPLOY_DIR/.env"
    fi
fi

# Configurar permissões
log "🔐 Configurando permissões..."
useradd -r -s /bin/false aura 2>/dev/null || true
chown -R aura:aura "$DEPLOY_DIR"
chmod +x "$DEPLOY_DIR/scripts/"*.sh

# Executar migrações
log "🗄️  Executando migrações de banco de dados..."
cd "$DEPLOY_DIR"
sudo -u aura NODE_ENV=$DEPLOY_ENV node backend/scripts/migrate.js || true

# Criar arquivo de serviço systemd
log "🔧 Configurando serviço systemd..."
cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=Sistema AURA - Automated Trading System
After=network.target postgresql.service redis.service
Wants=postgresql.service redis.service

[Service]
Type=simple
User=aura
Group=aura
WorkingDirectory=$DEPLOY_DIR
Environment=NODE_ENV=$DEPLOY_ENV
ExecStart=/usr/bin/node backend/index.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Limites de recursos
LimitNOFILE=65536
LimitNPROC=4096

# Segurança
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DEPLOY_DIR /tmp /var/log

[Install]
WantedBy=multi-user.target
EOF

# Recarregar systemd
systemctl daemon-reload

# Configurar nginx (se disponível)
if command -v nginx &> /dev/null; then
    log "🌐 Configurando nginx..."
    
    cat > "/etc/nginx/sites-available/$SERVICE_NAME" << EOF
server {
    listen 80;
    server_name _;
    
    # Frontend
    location / {
        root $DEPLOY_DIR/frontend;
        try_files \$uri \$uri/ /index.html;
        
        # Cache para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API Backend
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # WebSocket
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Logs
    access_log /var/log/nginx/${SERVICE_NAME}_access.log;
    error_log /var/log/nginx/${SERVICE_NAME}_error.log;
}
EOF
    
    # Ativar site
    ln -sf "/etc/nginx/sites-available/$SERVICE_NAME" "/etc/nginx/sites-enabled/"
    
    # Testar configuração
    nginx -t && systemctl reload nginx
fi

# Configurar logrotate
log "📝 Configurando rotação de logs..."
cat > "/etc/logrotate.d/$SERVICE_NAME" << EOF
/var/log/$SERVICE_NAME/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 aura aura
    postrotate
        systemctl reload $SERVICE_NAME
    endscript
}
EOF

# Criar diretório de logs
mkdir -p "/var/log/$SERVICE_NAME"
chown aura:aura "/var/log/$SERVICE_NAME"

# Iniciar serviços
log "▶️  Iniciando serviços..."
systemctl enable $SERVICE_NAME
systemctl start $SERVICE_NAME

# Verificar saúde do sistema
if health_check; then
    success "✅ Deployment concluído com sucesso!"
    
    # Informações finais
    log "📊 Informações do deployment:"
    echo "  • Versão: $VERSION"
    echo "  • Ambiente: $DEPLOY_ENV"
    echo "  • Diretório: $DEPLOY_DIR"
    echo "  • Serviço: $SERVICE_NAME"
    echo "  • Status: $(systemctl is-active $SERVICE_NAME)"
    echo ""
    echo "🔗 URLs:"
    echo "  • Frontend: http://localhost/"
    echo "  • API: http://localhost/api/v1/health"
    echo "  • Logs: journalctl -u $SERVICE_NAME -f"
    echo ""
    echo "🛠️  Comandos úteis:"
    echo "  • Status: systemctl status $SERVICE_NAME"
    echo "  • Logs: journalctl -u $SERVICE_NAME -f"
    echo "  • Restart: systemctl restart $SERVICE_NAME"
    echo "  • Rollback: $DEPLOY_DIR/rollback.sh"
    
else
    error "❌ Deployment falhou no health check"
    exit 1
fi

# Desabilitar trap de rollback (deployment bem-sucedido)
trap - ERR

log "🎉 Sistema AURA deployado com sucesso!"