pp#!/bin/bash

# AURA Trading System - Development Docker Script
# Script para gerenciar o ambiente de desenvolvimento com bind mounts

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções de log
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
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose não está instalado. Por favor, instale o Docker Compose primeiro."
        exit 1
    fi

    if ! docker info &> /dev/null; then
        log_error "Docker não está rodando. Por favor, inicie o Docker primeiro."
        exit 1
    fi

    log_success "Docker e Docker Compose estão prontos"
}

# Função para iniciar o ambiente de desenvolvimento
start_dev() {
    log_info "Iniciando ambiente de desenvolvimento..."
    
    # Fazer build das imagens de desenvolvimento
    log_info "Fazendo build das imagens de desenvolvimento..."
    docker-compose -f docker-compose.dev.yml build
    
    # Iniciar serviços
    log_info "Iniciando serviços..."
    docker-compose -f docker-compose.dev.yml up -d
    
    log_success "Ambiente de desenvolvimento iniciado!"
    log_info "Frontend: http://localhost:3000"
    log_info "Backend: http://localhost:3001"
    log_info "PostgreSQL: localhost:5432"
    log_info "Redis: localhost:6379"
}

# Função para parar o ambiente
stop_dev() {
    log_info "Parando ambiente de desenvolvimento..."
    docker-compose -f docker-compose.dev.yml down
    log_success "Ambiente parado!"
}

# Função para reiniciar o ambiente
restart_dev() {
    log_info "Reiniciando ambiente de desenvolvimento..."
    docker-compose -f docker-compose.dev.yml down
    docker-compose -f docker-compose.dev.yml up -d
    log_success "Ambiente reiniciado!"
}

# Função para ver logs
show_logs() {
    local service=${1:-""}
    if [ -z "$service" ]; then
        log_info "Mostrando logs de todos os serviços..."
        docker-compose -f docker-compose.dev.yml logs -f
    else
        log_info "Mostrando logs do serviço: $service"
        docker-compose -f docker-compose.dev.yml logs -f "$service"
    fi
}

# Função para entrar no container
exec_container() {
    local service=${1:-"backend"}
    log_info "Entrando no container: $service"
    docker-compose -f docker-compose.dev.yml exec "$service" sh
}

# Função para rebuild das imagens
rebuild() {
    local service=${1:-""}
    if [ -z "$service" ]; then
        log_info "Rebuild de todas as imagens..."
        docker-compose -f docker-compose.dev.yml build --no-cache
    else
        log_info "Rebuild da imagem: $service"
        docker-compose -f docker-compose.dev.yml build --no-cache "$service"
    fi
}

# Função para limpar volumes
cleanup() {
    log_warning "Isso irá remover todos os volumes. Tem certeza? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        log_info "Removendo volumes..."
        docker-compose -f docker-compose.dev.yml down -v
        docker volume prune -f
        log_success "Volumes removidos!"
    else
        log_info "Operação cancelada."
    fi
}

# Função para mostrar status
show_status() {
    log_info "Status dos containers:"
    docker-compose -f docker-compose.dev.yml ps
}

# Função para mostrar ajuda
show_help() {
    echo "🚀 AURA Trading System - Development Docker Helper"
    echo ""
    echo "Uso: $0 [comando]"
    echo ""
    echo "Comandos disponíveis:"
    echo "  start     - Iniciar ambiente de desenvolvimento"
    echo "  stop      - Parar ambiente de desenvolvimento"
    echo "  restart   - Reiniciar ambiente de desenvolvimento"
    echo "  logs      - Mostrar logs (opcional: especificar serviço)"
    echo "  exec      - Entrar no container (padrão: backend)"
    echo "  rebuild   - Rebuild das imagens (opcional: especificar serviço)"
    echo "  cleanup   - Limpar volumes"
    echo "  status    - Mostrar status dos containers"
    echo "  help      - Mostrar esta ajuda"
    echo ""
    echo "Exemplos:"
    echo "  $0 start"
    echo "  $0 logs backend"
    echo "  $0 exec frontend"
    echo "  $0 rebuild backend"
}

# Main
case "${1:-help}" in
    start)
        check_docker
        start_dev
        ;;
    stop)
        check_docker
        stop_dev
        ;;
    restart)
        check_docker
        restart_dev
        ;;
    logs)
        check_docker
        show_logs "$2"
        ;;
    exec)
        check_docker
        exec_container "$2"
        ;;
    rebuild)
        check_docker
        rebuild "$2"
        ;;
    cleanup)
        check_docker
        cleanup
        ;;
    status)
        check_docker
        show_status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Comando inválido: $1"
        show_help
        exit 1
        ;;
esac 