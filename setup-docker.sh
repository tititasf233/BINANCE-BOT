#!/bin/bash

# AURA Trading System - Docker Setup Script
# Este script configura o ambiente Docker automaticamente

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções auxiliares
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar se Docker está instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker não está instalado. Por favor, instale o Docker primeiro."
        echo "Visite: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose não está instalado. Por favor, instale o Docker Compose primeiro."
        echo "Visite: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    log_success "Docker e Docker Compose estão instalados"
}

# Verificar se Docker está rodando
check_docker_running() {
    if ! docker info &> /dev/null; then
        log_error "Docker não está rodando. Por favor, inicie o Docker primeiro."
        exit 1
    fi
    
    log_success "Docker está rodando"
}

# Configurar arquivos de ambiente
setup_env_files() {
    log_info "Configurando arquivos de ambiente..."
    
    # Arquivo principal
    if [ ! -f .env ]; then
        cp .env.example .env
        log_success "Arquivo .env criado"
    else
        log_warning "Arquivo .env já existe"
    fi
    
    # Backend
    if [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        log_success "Arquivo backend/.env criado"
    else
        log_warning "Arquivo backend/.env já existe"
    fi
}

# Fazer build das imagens
build_images() {
    log_info "Fazendo build das imagens Docker..."
    
    log_info "Building backend image..."
    docker build -f Dockerfile.backend -t aura/backend:local .
    
    log_info "Building frontend image..."
    docker build -f Dockerfile.frontend -t aura/frontend:local .
    
    log_success "Imagens buildadas com sucesso"
}

# Inicializar banco de dados
init_database() {
    log_info "Inicializando banco de dados..."
    
    # Iniciar apenas PostgreSQL
    docker-compose up -d postgres
    
    # Aguardar PostgreSQL estar pronto
    log_info "Aguardando PostgreSQL estar pronto..."
    sleep 10
    
    # Executar migrações (se existirem)
    if [ -f "backend/migrations" ]; then
        log_info "Executando migrações..."
        docker-compose exec backend npm run migrate
    fi
    
    log_success "Banco de dados inicializado"
}

# Iniciar todos os serviços
start_services() {
    log_info "Iniciando todos os serviços..."
    
    docker-compose up -d
    
    log_info "Aguardando serviços estarem prontos..."
    sleep 30
    
    # Verificar se os serviços estão rodando
    if docker-compose ps | grep -q "Up"; then
        log_success "Serviços iniciados com sucesso"
    else
        log_error "Alguns serviços falharam ao iniciar"
        docker-compose logs
        exit 1
    fi
}

# Verificar saúde dos serviços
check_health() {
    log_info "Verificando saúde dos serviços..."
    
    # Verificar backend
    if curl -f http://localhost:3001/api/v1/health &> /dev/null; then
        log_success "Backend está saudável"
    else
        log_warning "Backend não está respondendo"
    fi
    
    # Verificar frontend
    if curl -f http://localhost:3000 &> /dev/null; then
        log_success "Frontend está saudável"
    else
        log_warning "Frontend não está respondendo"
    fi
}

# Mostrar informações finais
show_final_info() {
    echo ""
    echo "🎉 Setup concluído com sucesso!"
    echo ""
    echo "📋 Informações dos serviços:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend:  http://localhost:3001"
    echo "  API Docs: http://localhost:3001/api/docs"
    echo ""
    echo "🔧 Comandos úteis:"
    echo "  Ver logs:        docker-compose logs -f"
    echo "  Parar serviços:  docker-compose down"
    echo "  Reiniciar:       docker-compose restart"
    echo "  Status:          docker-compose ps"
    echo ""
    echo "📚 Para mais informações:"
    echo "  Documentação: docs/DOCKER_CICD.md"
    echo "  Helper script: ./scripts/docker-helper.sh help"
    echo ""
}

# Função principal
main() {
    echo "🚀 AURA Trading System - Docker Setup"
    echo "======================================"
    echo ""
    
    check_docker
    check_docker_running
    setup_env_files
    build_images
    init_database
    start_services
    check_health
    show_final_info
}

# Executar função principal
main "$@"