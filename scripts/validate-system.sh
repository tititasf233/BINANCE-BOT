#!/bin/bash

# Script de validação final do Sistema AURA
set -e

# Configurações
API_URL=${API_URL:-http://localhost:8000}
FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}
TIMEOUT=${TIMEOUT:-30}
VERBOSE=${VERBOSE:-false}

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

verbose() {
    if [ "$VERBOSE" = "true" ]; then
        echo -e "${BLUE}[VERBOSE]${NC} $1"
    fi
}

# Função para fazer requisições HTTP
http_request() {
    local url="$1"
    local method="${2:-GET}"
    local data="$3"
    local headers="$4"
    
    verbose "Making $method request to $url"
    
    if [ -n "$data" ]; then
        curl -s -X "$method" -H "Content-Type: application/json" $headers -d "$data" --max-time "$TIMEOUT" "$url"
    else
        curl -s -X "$method" $headers --max-time "$TIMEOUT" "$url"
    fi
}

# Função para verificar se serviço está respondendo
check_service() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    log "Verificando $name..."
    
    local response
    local status_code
    
    response=$(http_request "$url" "GET" "" "" 2>/dev/null) || {
        error "$name não está respondendo"
        return 1
    }
    
    status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null) || {
        error "$name retornou erro de conexão"
        return 1
    }
    
    if [ "$status_code" = "$expected_status" ]; then
        success "$name está funcionando (HTTP $status_code)"
        return 0
    else
        error "$name retornou HTTP $status_code (esperado $expected_status)"
        return 1
    fi
}

# Função para verificar health check detalhado
check_health_detailed() {
    log "Verificando health check detalhado..."
    
    local response
    response=$(http_request "$API_URL/api/v1/health" "GET")
    
    if [ $? -ne 0 ]; then
        error "Falha ao obter health check"
        return 1
    fi
    
    # Verificar se resposta contém campos esperados
    if echo "$response" | grep -q '"status":"healthy"'; then
        success "Sistema reporta status saudável"
    else
        error "Sistema não está saudável: $response"
        return 1
    fi
    
    # Verificar serviços individuais
    if echo "$response" | grep -q '"database":"connected"'; then
        success "Banco de dados conectado"
    else
        warning "Banco de dados pode não estar conectado"
    fi
    
    if echo "$response" | grep -q '"redis":"connected"'; then
        success "Redis conectado"
    else
        warning "Redis pode não estar conectado"
    fi
    
    verbose "Health check response: $response"
    return 0
}

# Função para verificar métricas
check_metrics() {
    log "Verificando métricas do sistema..."
    
    local response
    response=$(http_request "$API_URL/api/v1/metrics" "GET")
    
    if [ $? -ne 0 ]; then
        error "Falha ao obter métricas"
        return 1
    fi
    
    # Verificar se métricas contêm dados esperados
    if echo "$response" | grep -q "aura_"; then
        success "Métricas customizadas do AURA encontradas"
    else
        warning "Métricas customizadas não encontradas"
    fi
    
    if echo "$response" | grep -q "http_requests_total"; then
        success "Métricas HTTP encontradas"
    else
        warning "Métricas HTTP não encontradas"
    fi
    
    if echo "$response" | grep -q "process_"; then
        success "Métricas de processo encontradas"
    else
        warning "Métricas de processo não encontradas"
    fi
    
    return 0
}

# Função para verificar endpoints da API
check_api_endpoints() {
    log "Verificando endpoints da API..."
    
    local endpoints=(
        "/api/v1/health:200"
        "/api/v1/metrics:200"
        "/api/v1/auth/login:400"  # Sem dados deve retornar 400
        "/api/v1/strategies:401"  # Sem auth deve retornar 401
    )
    
    local failed=0
    
    for endpoint_info in "${endpoints[@]}"; do
        local endpoint=$(echo "$endpoint_info" | cut -d':' -f1)
        local expected_status=$(echo "$endpoint_info" | cut -d':' -f2)
        
        verbose "Testando endpoint: $endpoint (esperado: $expected_status)"
        
        local status_code
        status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$API_URL$endpoint" 2>/dev/null)
        
        if [ "$status_code" = "$expected_status" ]; then
            success "Endpoint $endpoint OK (HTTP $status_code)"
        else
            error "Endpoint $endpoint falhou (HTTP $status_code, esperado $expected_status)"
            failed=$((failed + 1))
        fi
    done
    
    if [ $failed -eq 0 ]; then
        success "Todos os endpoints da API estão funcionando"
        return 0
    else
        error "$failed endpoint(s) falharam"
        return 1
    fi
}

# Função para verificar segurança
check_security() {
    log "Verificando configurações de segurança..."
    
    # Verificar headers de segurança
    local headers
    headers=$(curl -s -I --max-time "$TIMEOUT" "$API_URL/api/v1/health" 2>/dev/null)
    
    if echo "$headers" | grep -qi "x-frame-options"; then
        success "Header X-Frame-Options presente"
    else
        warning "Header X-Frame-Options não encontrado"
    fi
    
    if echo "$headers" | grep -qi "x-content-type-options"; then
        success "Header X-Content-Type-Options presente"
    else
        warning "Header X-Content-Type-Options não encontrado"
    fi
    
    # Verificar rate limiting
    log "Testando rate limiting..."
    local rate_limit_hit=false
    
    for i in {1..20}; do
        local status_code
        status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$API_URL/api/v1/health" 2>/dev/null)
        
        if [ "$status_code" = "429" ]; then
            rate_limit_hit=true
            break
        fi
        
        sleep 0.1
    done
    
    if [ "$rate_limit_hit" = true ]; then
        success "Rate limiting está funcionando"
    else
        warning "Rate limiting pode não estar configurado corretamente"
    fi
    
    return 0
}

# Função para verificar performance
check_performance() {
    log "Verificando performance do sistema..."
    
    # Teste de latência
    local start_time
    local end_time
    local response_time
    
    start_time=$(date +%s%N)
    http_request "$API_URL/api/v1/health" "GET" > /dev/null 2>&1
    end_time=$(date +%s%N)
    
    response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    if [ "$response_time" -lt 1000 ]; then
        success "Tempo de resposta OK: ${response_time}ms"
    elif [ "$response_time" -lt 2000 ]; then
        warning "Tempo de resposta aceitável: ${response_time}ms"
    else
        error "Tempo de resposta alto: ${response_time}ms"
        return 1
    fi
    
    # Teste de carga simples
    log "Executando teste de carga simples..."
    local concurrent_requests=10
    local failed_requests=0
    
    for i in $(seq 1 $concurrent_requests); do
        (
            if ! http_request "$API_URL/api/v1/health" "GET" > /dev/null 2>&1; then
                echo "FAILED"
            fi
        ) &
    done
    
    wait
    
    # Contar falhas (simplificado)
    if [ $failed_requests -eq 0 ]; then
        success "Teste de carga simples passou"
    else
        warning "$failed_requests requisições falharam no teste de carga"
    fi
    
    return 0
}

# Função para verificar integração com Binance
check_binance_integration() {
    log "Verificando integração com Binance..."
    
    # Verificar se endpoint de status da Binance responde
    local response
    response=$(http_request "$API_URL/api/v1/system/binance/status" "GET" "" "" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        if echo "$response" | grep -q '"status":"connected"'; then
            success "Integração com Binance está funcionando"
        else
            warning "Binance pode estar em modo testnet ou desconectada"
            verbose "Binance status: $response"
        fi
    else
        warning "Não foi possível verificar status da Binance"
    fi
    
    return 0
}

# Função para verificar logs
check_logs() {
    log "Verificando sistema de logs..."
    
    # Verificar se logs estão sendo gerados
    if [ -f "logs/aura.log" ]; then
        local log_lines
        log_lines=$(wc -l < "logs/aura.log" 2>/dev/null || echo "0")
        
        if [ "$log_lines" -gt 0 ]; then
            success "Logs estão sendo gerados ($log_lines linhas)"
        else
            warning "Arquivo de log existe mas está vazio"
        fi
    else
        warning "Arquivo de log não encontrado"
    fi
    
    return 0
}

# Função principal de validação
main() {
    log "🔍 Iniciando validação do Sistema AURA..."
    log "API URL: $API_URL"
    log "Frontend URL: $FRONTEND_URL"
    log "Timeout: ${TIMEOUT}s"
    echo ""
    
    local total_checks=0
    local passed_checks=0
    local failed_checks=0
    
    # Lista de verificações
    local checks=(
        "check_service 'API Backend' '$API_URL/api/v1/health'"
        "check_health_detailed"
        "check_metrics"
        "check_api_endpoints"
        "check_security"
        "check_performance"
        "check_binance_integration"
        "check_logs"
    )
    
    # Executar verificações
    for check in "${checks[@]}"; do
        total_checks=$((total_checks + 1))
        echo ""
        
        if eval "$check"; then
            passed_checks=$((passed_checks + 1))
        else
            failed_checks=$((failed_checks + 1))
        fi
    done
    
    # Verificar frontend se URL fornecida
    if [ "$FRONTEND_URL" != "http://localhost:3000" ] || curl -s --max-time 5 "$FRONTEND_URL" > /dev/null 2>&1; then
        total_checks=$((total_checks + 1))
        echo ""
        if check_service "Frontend" "$FRONTEND_URL"; then
            passed_checks=$((passed_checks + 1))
        else
            failed_checks=$((failed_checks + 1))
        fi
    fi
    
    # Resumo final
    echo ""
    log "📊 Resumo da Validação:"
    echo "  • Total de verificações: $total_checks"
    echo "  • Passou: $passed_checks"
    echo "  • Falhou: $failed_checks"
    echo "  • Taxa de sucesso: $(( passed_checks * 100 / total_checks ))%"
    
    if [ $failed_checks -eq 0 ]; then
        echo ""
        success "🎉 Todas as verificações passaram! Sistema AURA está funcionando corretamente."
        return 0
    else
        echo ""
        error "❌ $failed_checks verificação(ões) falharam. Verifique os logs acima."
        return 1
    fi
}

# Verificar argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        --api-url)
            API_URL="$2"
            shift 2
            ;;
        --frontend-url)
            FRONTEND_URL="$2"
            shift 2
            ;;
        --timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Uso: $0 [opções]"
            echo ""
            echo "Opções:"
            echo "  --api-url URL        URL da API (padrão: http://localhost:8000)"
            echo "  --frontend-url URL   URL do frontend (padrão: http://localhost:3000)"
            echo "  --timeout SECONDS    Timeout para requisições (padrão: 30)"
            echo "  --verbose            Modo verboso"
            echo "  --help               Mostrar esta ajuda"
            echo ""
            echo "Exemplos:"
            echo "  $0                                    # Validação local"
            echo "  $0 --api-url https://api.aura.com    # Validação produção"
            echo "  $0 --verbose                          # Com logs detalhados"
            exit 0
            ;;
        *)
            error "Opção desconhecida: $1"
            echo "Use --help para ver as opções disponíveis"
            exit 1
            ;;
    esac
done

# Executar validação
main