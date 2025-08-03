#!/bin/bash

# AURA Trading System - Docker Helper Script
# Este script facilita o gerenciamento das imagens Docker

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações
REGISTRY="ghcr.io"
REPO_OWNER="${GITHUB_REPOSITORY_OWNER:-$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^/]*\).*/\1/')}"
REPO_NAME="${GITHUB_REPOSITORY_NAME:-$(basename $(git config --get remote.origin.url) .git)}"
FULL_REPO="${REPO_OWNER}/${REPO_NAME}"

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

# Função para mostrar ajuda
show_help() {
    echo "AURA Trading System - Docker Helper"
    echo ""
    echo "Uso: $0 [COMANDO] [OPÇÕES]"
    echo ""
    echo "Comandos:"
    echo "  build [service]     - Build local das imagens (backend, frontend, ou all)"
    echo "  pull [tag]          - Pull das imagens do registry (latest, develop, etc.)"
    echo "  push [tag]          - Push das imagens para o registry"
    echo "  run [service]       - Executar um serviço localmente"
    echo "  logs [service]      - Mostrar logs de um serviço"
    echo "  clean               - Limpar imagens não utilizadas"
    echo "  list                - Listar imagens do projeto"
    echo "  inspect [service]   - Inspecionar uma imagem"
    echo "  shell [service]     - Abrir shell dentro de uma imagem"
    echo "  health [service]    - Verificar health check de um serviço"
    echo ""
    echo "Exemplos:"
    echo "  $0 build all"
    echo "  $0 pull latest"
    echo "  $0 run backend"
    echo "  $0 logs frontend"
    echo "  $0 clean"
}

# Função para build local
build_images() {
    local service=$1
    
    if [[ "$service" == "backend" || "$service" == "all" ]]; then
        log_info "Building backend image..."
        docker build -f Dockerfile.backend -t aura/backend:local .
        log_success "Backend image built successfully"
    fi
    
    if [[ "$service" == "frontend" || "$service" == "all" ]]; then
        log_info "Building frontend image..."
        docker build -f Dockerfile.frontend -t aura/frontend:local .
        log_success "Frontend image built successfully"
    fi
    
    if [[ "$service" != "backend" && "$service" != "frontend" && "$service" != "all" ]]; then
        log_error "Serviço inválido. Use: backend, frontend, ou all"
        exit 1
    fi
}

# Função para pull das imagens
pull_images() {
    local tag=${1:-latest}
    
    log_info "Pulling images with tag: $tag"
    
    docker pull "${REGISTRY}/${FULL_REPO}/backend:${tag}" || log_warning "Failed to pull backend:$tag"
    docker pull "${REGISTRY}/${FULL_REPO}/frontend:${tag}" || log_warning "Failed to pull frontend:$tag"
    
    log_success "Pull completed"
}

# Função para push das imagens
push_images() {
    local tag=${1:-latest}
    
    log_info "Pushing images with tag: $tag"
    
    # Tag local images
    docker tag aura/backend:local "${REGISTRY}/${FULL_REPO}/backend:${tag}"
    docker tag aura/frontend:local "${REGISTRY}/${FULL_REPO}/frontend:${tag}"
    
    # Push images
    docker push "${REGISTRY}/${FULL_REPO}/backend:${tag}"
    docker push "${REGISTRY}/${FULL_REPO}/frontend:${tag}"
    
    log_success "Push completed"
}

# Função para executar serviços
run_service() {
    local service=$1
    local tag=${2:-local}
    
    case $service in
        backend)
            log_info "Starting backend service..."
            docker run -d \
                --name aura-backend-dev \
                -p 3001:3001 \
                -e NODE_ENV=development \
                aura/backend:$tag
            ;;
        frontend)
            log_info "Starting frontend service..."
            docker run -d \
                --name aura-frontend-dev \
                -p 3000:3000 \
                aura/frontend:$tag
            ;;
        *)
            log_error "Serviço inválido. Use: backend ou frontend"
            exit 1
            ;;
    esac
    
    log_success "$service started successfully"
}

# Função para mostrar logs
show_logs() {
    local service=$1
    
    case $service in
        backend)
            docker logs -f aura-backend-dev
            ;;
        frontend)
            docker logs -f aura-frontend-dev
            ;;
        *)
            log_error "Serviço inválido. Use: backend ou frontend"
            exit 1
            ;;
    esac
}

# Função para limpeza
clean_images() {
    log_info "Cleaning unused images..."
    
    # Remove unused images
    docker image prune -f
    
    # Remove dangling images
    docker images -f "dangling=true" -q | xargs -r docker rmi
    
    log_success "Cleanup completed"
}

# Função para listar imagens
list_images() {
    log_info "AURA Trading System Images:"
    echo ""
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}" | grep -E "(aura|${FULL_REPO})" || log_warning "No AURA images found"
}

# Função para inspecionar imagem
inspect_image() {
    local service=$1
    local tag=${2:-local}
    
    case $service in
        backend|frontend)
            docker inspect aura/$service:$tag
            ;;
        *)
            log_error "Serviço inválido. Use: backend ou frontend"
            exit 1
            ;;
    esac
}

# Função para abrir shell
open_shell() {
    local service=$1
    local tag=${2:-local}
    
    case $service in
        backend|frontend)
            log_info "Opening shell in $service:$tag..."
            docker run -it --rm aura/$service:$tag sh
            ;;
        *)
            log_error "Serviço inválido. Use: backend ou frontend"
            exit 1
            ;;
    esac
}

# Função para verificar health
check_health() {
    local service=$1
    
    case $service in
        backend)
            log_info "Checking backend health..."
            curl -f http://localhost:3001/api/v1/health || log_error "Backend health check failed"
            ;;
        frontend)
            log_info "Checking frontend health..."
            curl -f http://localhost:3000/health || log_error "Frontend health check failed"
            ;;
        *)
            log_error "Serviço inválido. Use: backend ou frontend"
            exit 1
            ;;
    esac
}

# Main script
case $1 in
    build)
        build_images ${2:-all}
        ;;
    pull)
        pull_images $2
        ;;
    push)
        push_images $2
        ;;
    run)
        run_service $2 $3
        ;;
    logs)
        show_logs $2
        ;;
    clean)
        clean_images
        ;;
    list)
        list_images
        ;;
    inspect)
        inspect_image $2 $3
        ;;
    shell)
        open_shell $2 $3
        ;;
    health)
        check_health $2
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Comando inválido. Use '$0 help' para ver os comandos disponíveis."
        exit 1
        ;;
esac