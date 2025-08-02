-- Inicialização do banco de dados AURA
-- Este script será executado automaticamente pelo Docker

-- Criar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Configurar timezone
SET timezone = 'UTC';

-- Criar usuário e banco se não existirem (já criados pelo Docker)
-- Este arquivo serve como placeholder para scripts de inicialização futuros