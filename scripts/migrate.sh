#!/bin/bash

# Script de migração de banco de dados para o Sistema AURA
set -e

# Configurações
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-aura_trading}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD}
MIGRATIONS_DIR=${MIGRATIONS_DIR:-backend/src/database/migrations}

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

# Verificar se psql está disponível
if ! command -v psql &> /dev/null; then
    error "psql não está instalado"
    exit 1
fi

# Verificar se o diretório de migrações existe
if [ ! -d "$MIGRATIONS_DIR" ]; then
    error "Diretório de migrações não encontrado: $MIGRATIONS_DIR"
    exit 1
fi

# Função para executar SQL
execute_sql() {
    local sql="$1"
    local description="$2"
    
    log "$description"
    
    if [ -n "$DB_PASSWORD" ]; then
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql"
    else
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql"
    fi
}

# Função para executar arquivo SQL
execute_sql_file() {
    local file="$1"
    local description="$2"
    
    log "$description"
    
    if [ -n "$DB_PASSWORD" ]; then
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file"
    else
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file"
    fi
}

# Testar conexão com o banco
log "Testando conexão com o banco de dados..."
if [ -n "$DB_PASSWORD" ]; then
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null
else
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null
fi

success "Conexão com banco de dados estabelecida"

# Criar tabela de controle de migrações se não existir
log "Criando tabela de controle de migrações..."
execute_sql "
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    checksum VARCHAR(64)
);
" "Criando tabela schema_migrations"

# Função para calcular checksum de arquivo
calculate_checksum() {
    local file="$1"
    sha256sum "$file" | cut -d' ' -f1
}

# Função para verificar se migração já foi executada
is_migration_executed() {
    local version="$1"
    local result
    
    if [ -n "$DB_PASSWORD" ]; then
        result=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM schema_migrations WHERE version = '$version';")
    else
        result=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM schema_migrations WHERE version = '$version';")
    fi
    
    [ "$(echo $result | tr -d ' ')" -gt 0 ]
}

# Função para registrar migração executada
register_migration() {
    local version="$1"
    local filename="$2"
    local checksum="$3"
    
    execute_sql "
    INSERT INTO schema_migrations (version, filename, checksum) 
    VALUES ('$version', '$filename', '$checksum');
    " "Registrando migração $version"
}

# Executar migrações
log "Iniciando execução de migrações..."

migration_count=0
executed_count=0

# Processar arquivos de migração em ordem
for migration_file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
    if [ ! -f "$migration_file" ]; then
        continue
    fi
    
    filename=$(basename "$migration_file")
    version=$(echo "$filename" | sed 's/^\([0-9]\+\)_.*/\1/')
    
    migration_count=$((migration_count + 1))
    
    log "Processando migração: $filename (versão: $version)"
    
    # Verificar se já foi executada
    if is_migration_executed "$version"; then
        log "Migração $version já foi executada, pulando..."
        continue
    fi
    
    # Calcular checksum
    checksum=$(calculate_checksum "$migration_file")
    
    # Executar migração
    log "Executando migração $version..."
    
    # Iniciar transação
    if [ -n "$DB_PASSWORD" ]; then
        PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
BEGIN;
\i $migration_file
INSERT INTO schema_migrations (version, filename, checksum) VALUES ('$version', '$filename', '$checksum');
COMMIT;
EOF
    else
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << EOF
BEGIN;
\i $migration_file
INSERT INTO schema_migrations (version, filename, checksum) VALUES ('$version', '$filename', '$checksum');
COMMIT;
EOF
    fi
    
    if [ $? -eq 0 ]; then
        success "Migração $version executada com sucesso"
        executed_count=$((executed_count + 1))
    else
        error "Falha ao executar migração $version"
        exit 1
    fi
done

# Resumo
log "📊 Resumo das migrações:"
echo "  • Total de arquivos encontrados: $migration_count"
echo "  • Migrações executadas: $executed_count"
echo "  • Migrações já existentes: $((migration_count - executed_count))"

# Verificar estado atual do banco
log "Verificando estado atual do banco..."
if [ -n "$DB_PASSWORD" ]; then
    current_version=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT MAX(version) FROM schema_migrations;" | tr -d ' ')
else
    current_version=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT MAX(version) FROM schema_migrations;" | tr -d ' ')
fi

if [ -n "$current_version" ] && [ "$current_version" != "" ]; then
    success "Banco de dados está na versão: $current_version"
else
    warning "Nenhuma migração encontrada no banco"
fi

# Verificar integridade das tabelas principais
log "Verificando integridade das tabelas..."
tables=("users" "user_api_keys" "strategies" "trades" "backtest_results" "system_logs")

for table in "${tables[@]}"; do
    if [ -n "$DB_PASSWORD" ]; then
        exists=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '$table';" | tr -d ' ')
    else
        exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '$table';" | tr -d ' ')
    fi
    
    if [ "$exists" -eq 1 ]; then
        success "Tabela $table existe"
    else
        warning "Tabela $table não encontrada"
    fi
done

success "🎉 Migrações concluídas com sucesso!"

# Mostrar informações úteis
echo ""
echo "🔗 Informações de conexão:"
echo "  • Host: $DB_HOST:$DB_PORT"
echo "  • Database: $DB_NAME"
echo "  • User: $DB_USER"
echo ""
echo "📋 Comandos úteis:"
echo "  • Conectar ao banco: psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
echo "  • Ver migrações: SELECT * FROM schema_migrations ORDER BY executed_at;"
echo "  • Ver tabelas: \\dt"