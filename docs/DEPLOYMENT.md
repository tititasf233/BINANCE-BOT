# Guia de Deployment - Sistema AURA

Este documento descreve como fazer o deployment do Sistema AURA em diferentes ambientes (desenvolvimento, staging e produção).

## Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Configuração de Ambiente](#configuração-de-ambiente)
3. [Build da Aplicação](#build-da-aplicação)
4. [Deployment com Docker](#deployment-com-docker)
5. [Deployment com Kubernetes](#deployment-com-kubernetes)
6. [Deployment Tradicional](#deployment-tradicional)
7. [Monitoramento e Logs](#monitoramento-e-logs)
8. [Troubleshooting](#troubleshooting)

## Pré-requisitos

### Software Necessário

- **Node.js** 18+ e npm
- **PostgreSQL** 15+
- **Redis** 7+
- **Docker** e Docker Compose (para deployment containerizado)
- **Kubernetes** (para deployment em cluster)
- **Nginx** (para proxy reverso)

### Recursos Mínimos

#### Desenvolvimento
- CPU: 2 cores
- RAM: 4GB
- Disco: 10GB

#### Staging
- CPU: 4 cores
- RAM: 8GB
- Disco: 50GB

#### Produção
- CPU: 8+ cores
- RAM: 16GB+
- Disco: 100GB+
- Backup: 500GB+

## Configuração de Ambiente

### 1. Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example`:

```bash
# Copiar template
cp .env.example .env

# Editar configurações
nano .env
```

#### Variáveis Obrigatórias

```bash
# Ambiente
NODE_ENV=production

# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aura_trading
DB_USER=postgres
DB_PASSWORD=sua_senha_segura

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=sua_senha_redis

# Segurança
JWT_SECRET=sua_chave_jwt_super_secreta_256_bits
JWT_REFRESH_SECRET=sua_chave_refresh_super_secreta
ENCRYPTION_KEY=sua_chave_encriptacao_32_caracteres

# Binance
BINANCE_API_KEY=sua_api_key_binance
BINANCE_SECRET_KEY=sua_secret_key_binance
BINANCE_USE_TESTNET=false
```

### 2. Configuração por Ambiente

O sistema usa arquivos YAML para configuração específica por ambiente:

- `config/environments/development.yml`
- `config/environments/staging.yml`
- `config/environments/production.yml`
- `config/environments/test.yml`

## Build da Aplicação

### 1. Build Automatizado

```bash
# Executar script de build
./scripts/build.sh

# Com testes
BUILD_VERSION=v1.0.0 ./scripts/build.sh

# Sem testes (mais rápido)
SKIP_TESTS=true ./scripts/build.sh
```

### 2. Build Manual

```bash
# Backend
cd backend
npm ci --only=production
npm run build

# Frontend
cd frontend
npm ci
npm run build

# Verificar builds
ls -la backend/dist/
ls -la frontend/build/
```

## Deployment com Docker

### 1. Docker Compose (Recomendado para desenvolvimento/staging)

```bash
# Desenvolvimento
docker-compose up -d

# Produção
docker-compose -f docker-compose.prod.yml up -d

# Com rebuild
docker-compose -f docker-compose.prod.yml up -d --build
```

### 2. Containers Individuais

```bash
# Build das imagens
docker build -f Dockerfile.backend -t aura/backend:latest .
docker build -f Dockerfile.frontend -t aura/frontend:latest .

# Executar containers
docker run -d --name aura-postgres \
  -e POSTGRES_DB=aura_trading \
  -e POSTGRES_PASSWORD=password \
  -v postgres_data:/var/lib/postgresql/data \
  postgres:15-alpine

docker run -d --name aura-redis \
  -v redis_data:/data \
  redis:7-alpine

docker run -d --name aura-backend \
  --link aura-postgres:postgres \
  --link aura-redis:redis \
  -p 8000:8000 \
  -e NODE_ENV=production \
  aura/backend:latest

docker run -d --name aura-frontend \
  --link aura-backend:backend \
  -p 80:80 \
  aura/frontend:latest
```

## Deployment com Kubernetes

### 1. Preparação do Cluster

```bash
# Criar namespace
kubectl create namespace aura-trading

# Aplicar configurações base
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
```

### 2. Deploy dos Serviços

```bash
# Banco de dados e cache
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml

# Aguardar serviços ficarem prontos
kubectl wait --for=condition=ready pod -l app=postgres -n aura-trading --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n aura-trading --timeout=300s

# Aplicações
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml

# Ingress (opcional)
kubectl apply -f k8s/ingress.yaml
```

### 3. Verificar Deployment

```bash
# Status dos pods
kubectl get pods -n aura-trading

# Logs
kubectl logs -f deployment/aura-backend -n aura-trading
kubectl logs -f deployment/aura-frontend -n aura-trading

# Serviços
kubectl get services -n aura-trading

# Ingress
kubectl get ingress -n aura-trading
```

### 4. Scaling

```bash
# Manual
kubectl scale deployment aura-backend --replicas=5 -n aura-trading

# Auto-scaling (HPA já configurado)
kubectl get hpa -n aura-trading
```

## Deployment Tradicional

### 1. Preparação do Servidor

```bash
# Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# Instalar Redis
sudo apt-get install -y redis-server

# Instalar Nginx
sudo apt-get install -y nginx
```

### 2. Configuração do Banco

```bash
# Criar usuário e banco
sudo -u postgres psql
CREATE USER aura WITH PASSWORD 'sua_senha';
CREATE DATABASE aura_trading OWNER aura;
GRANT ALL PRIVILEGES ON DATABASE aura_trading TO aura;
\q

# Executar migrações
cd /opt/aura
npm run migrate
```

### 3. Deploy da Aplicação

```bash
# Usar script de deploy
sudo ./scripts/deploy.sh

# Ou manual
sudo mkdir -p /opt/aura
sudo cp -r dist/* /opt/aura/
sudo chown -R aura:aura /opt/aura

# Instalar dependências
cd /opt/aura/backend
sudo -u aura npm ci --only=production

# Configurar systemd
sudo cp aura.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable aura
sudo systemctl start aura
```

### 4. Configuração do Nginx

```bash
# Copiar configuração
sudo cp nginx/aura.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/aura.conf /etc/nginx/sites-enabled/

# Testar e recarregar
sudo nginx -t
sudo systemctl reload nginx
```

## Monitoramento e Logs

### 1. Health Checks

```bash
# API Health
curl http://localhost:8000/api/v1/health

# Frontend Health
curl http://localhost/health

# Script automatizado
./scripts/health-check.sh
```

### 2. Logs

```bash
# Systemd logs
journalctl -u aura -f

# Arquivo de log
tail -f /var/log/aura/aura.log

# Docker logs
docker logs -f aura-backend

# Kubernetes logs
kubectl logs -f deployment/aura-backend -n aura-trading
```

### 3. Métricas

```bash
# Métricas da aplicação
curl http://localhost:8000/api/v1/metrics

# Prometheus (se configurado)
curl http://localhost:9090/metrics

# Sistema
htop
iostat -x 1
```

## CI/CD Pipeline

### 1. GitHub Actions

O pipeline está configurado em `.github/workflows/ci-cd.yml`:

- **Test**: Executa testes unitários e de integração
- **Build**: Constrói imagens Docker
- **Deploy Staging**: Deploy automático na branch `develop`
- **Deploy Production**: Deploy automático na branch `main`

### 2. Secrets Necessários

Configure no GitHub:

```
KUBE_CONFIG_STAGING=<base64_encoded_kubeconfig>
KUBE_CONFIG_PRODUCTION=<base64_encoded_kubeconfig>
SLACK_WEBHOOK_URL=<webhook_url>
```

### 3. Deployment Manual

```bash
# Trigger deployment
git tag v1.0.0
git push origin v1.0.0

# Ou via GitHub CLI
gh workflow run ci-cd.yml
```

## Backup e Recuperação

### 1. Backup do Banco

```bash
# Backup automático (cron)
0 2 * * * pg_dump -h localhost -U aura aura_trading | gzip > /backup/aura_$(date +\%Y\%m\%d).sql.gz

# Backup manual
pg_dump -h localhost -U aura aura_trading > backup.sql
```

### 2. Backup do Redis

```bash
# Backup RDB
redis-cli BGSAVE
cp /var/lib/redis/dump.rdb /backup/redis_$(date +%Y%m%d).rdb
```

### 3. Restauração

```bash
# Restaurar banco
psql -h localhost -U aura aura_trading < backup.sql

# Restaurar Redis
sudo systemctl stop redis
cp backup.rdb /var/lib/redis/dump.rdb
sudo systemctl start redis
```

## Troubleshooting

### 1. Problemas Comuns

#### Aplicação não inicia
```bash
# Verificar logs
journalctl -u aura -n 50

# Verificar configuração
node -e "console.log(require('./config/environments/production.yml'))"

# Verificar dependências
npm ls
```

#### Erro de conexão com banco
```bash
# Testar conexão
psql -h localhost -U aura aura_trading -c "SELECT 1;"

# Verificar status
sudo systemctl status postgresql
```

#### Erro de conexão com Redis
```bash
# Testar conexão
redis-cli ping

# Verificar status
sudo systemctl status redis
```

### 2. Performance Issues

```bash
# Verificar recursos
htop
free -h
df -h

# Verificar conexões
netstat -tulpn | grep :8000
ss -tulpn | grep :8000

# Verificar queries lentas
tail -f /var/log/postgresql/postgresql.log | grep "slow query"
```

### 3. Rollback

```bash
# Rollback automático
./scripts/rollback.sh

# Rollback manual
sudo systemctl stop aura
sudo mv /opt/aura /opt/aura.failed
sudo mv /opt/aura.backup.20240101_120000 /opt/aura
sudo systemctl start aura
```

## Segurança

### 1. Firewall

```bash
# UFW
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 8000/tcp  # Apenas via nginx
sudo ufw enable
```

### 2. SSL/TLS

```bash
# Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d aura-trading.com
```

### 3. Atualizações

```bash
# Sistema
sudo apt update && sudo apt upgrade

# Dependências Node.js
npm audit fix

# Imagens Docker
docker pull postgres:15-alpine
docker pull redis:7-alpine
```

## Contatos e Suporte

- **Documentação**: [docs/](../docs/)
- **Issues**: GitHub Issues
- **Slack**: #aura-trading
- **Email**: devops@aura-trading.com

---

**Última atualização**: Janeiro 2025
**Versão**: 1.0.0