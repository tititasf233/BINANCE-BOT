# 🚀 Sistema AURA - Automated Unified Risk-managed Arbitrage

[![Build Status](https://github.com/aura-trading/sistema-aura/workflows/CI/badge.svg)](https://github.com/aura-trading/sistema-aura/actions)
[![Coverage](https://codecov.io/gh/aura-trading/sistema-aura/branch/main/graph/badge.svg)](https://codecov.io/gh/aura-trading/sistema-aura)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-green.svg)](package.json)

## 📋 Visão Geral

O Sistema AURA é uma plataforma robusta e escalável para automação de estratégias de trading de criptomoedas. Desenvolvido com foco em modularidade, resiliência, segurança e performance em tempo real, o sistema permite aos usuários criar, testar e executar estratégias de trading automatizadas utilizando a API da Binance.

### ✨ Características Principais

- 🔐 **Segurança Avançada**: Criptografia AES-256, autenticação JWT, rate limiting
- 📊 **Trading Automatizado**: Execução de estratégias em tempo real com ordens OCO
- 🧠 **Indicadores Técnicos**: SMA, EMA, RSI, MACD, Bandas de Bollinger
- 📈 **Backtesting**: Teste de estratégias com dados históricos
- 🎯 **Gestão de Risco**: Stop loss, take profit, controle de drawdown
- 📱 **Interface Moderna**: Dashboard React com atualizações em tempo real
- 🔄 **Alta Disponibilidade**: Arquitetura resiliente com recuperação automática
- 📊 **Monitoramento**: Métricas, logs e alertas integrados

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Microserviços │
│   (React SPA)   │◄──►│   (Express)     │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                       ┌─────────────────┐    ┌─────────────────┐
                       │   PostgreSQL    │    │     Redis       │
                       │   (Database)    │    │   (Cache/Pub)   │
                       └─────────────────┘    └─────────────────┘
                                │                        │
                       ┌─────────────────────────────────────────┐
                       │           Binance API                  │
                       │      (WebSocket + REST)                │
                       └─────────────────────────────────────────┘
```

### 🔧 Componentes Principais

- **Frontend**: React 18 + TypeScript + Redux Toolkit
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 15 com pool de conexões
- **Cache**: Redis 7 para dados em tempo real
- **Message Broker**: Redis Pub/Sub
- **Monitoramento**: Prometheus + Grafana
- **Deployment**: Docker + Kubernetes

## 🚀 Quick Start

### Pré-requisitos

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker (opcional)

### 1. Instalação

```bash
# Clonar repositório
git clone https://github.com/aura-trading/sistema-aura.git
cd sistema-aura

# Instalar dependências
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configuração

```bash
# Copiar arquivo de ambiente
cp .env.example .env

# Editar configurações
nano .env
```

**Variáveis obrigatórias:**
```bash
# Banco de dados
DB_HOST=localhost
DB_PASSWORD=sua_senha_postgres

# Redis
REDIS_HOST=localhost

# Segurança
JWT_SECRET=sua_chave_jwt_super_secreta
ENCRYPTION_KEY=sua_chave_encriptacao_32_chars

# Binance
BINANCE_API_KEY=sua_api_key_binance
BINANCE_SECRET_KEY=sua_secret_key_binance
```

### 3. Inicialização

```bash
# Executar migrações
npm run migrate

# Desenvolvimento
npm run dev

# Produção
npm run build
npm start
```

### 4. Acesso

- **Frontend**: http://localhost:3000
- **API**: http://localhost:8000
- **Health Check**: http://localhost:8000/api/v1/health

## 📚 Documentação

### 📖 Guias

- [📋 Configuração de Ambiente](docs/SETUP.md)
- [🚀 Guia de Deployment](docs/DEPLOYMENT.md)
- [🔧 Configuração da Binance](BINANCE_SETUP.md)
- [📊 Visão Geral do Sistema](docs/SYSTEM_OVERVIEW.md)

### 🔗 API Reference

- **Autenticação**: `POST /api/v1/auth/login`
- **Estratégias**: `GET /api/v1/strategies`
- **Portfolio**: `GET /api/v1/portfolio/overview`
- **Backtesting**: `POST /api/v1/strategies/:id/backtest`
- **Health**: `GET /api/v1/health`

## 🧪 Testes

### Executar Testes

```bash
# Testes unitários
npm test

# Testes de integração
npm run test:integration

# Testes de carga
npm run test:load

# Coverage
npm run test:coverage
```

### Métricas de Qualidade

- **Cobertura de Testes**: >85%
- **Testes Unitários**: 500+ testes
- **Testes de Integração**: 50+ cenários
- **Performance**: <500ms latência média

## 🐳 Docker & CI/CD

### 🚀 Imagens Docker Automáticas

O sistema possui CI/CD totalmente automatizado com GitHub Actions:

- **Build automático** em cada push
- **Testes** executados antes do deploy
- **Publicação** no GitHub Container Registry
- **Deploy automático** para staging/produção

#### Imagens Disponíveis

```bash
# GitHub Container Registry (Recomendado)
docker pull ghcr.io/[owner]/[repo]/backend:latest
docker pull ghcr.io/[owner]/[repo]/frontend:latest

# Tags disponíveis: latest, develop, v1.2.3, stable
```

### 🛠️ Desenvolvimento Local

```bash
# Usando Docker Compose
docker-compose up -d

# Ou usando helper script
./scripts/docker-helper.sh build all
./scripts/docker-helper.sh run backend
```

### 🚀 Produção

```bash
# Docker Compose para produção
docker-compose -f docker-compose.prod.yml up -d

# Ou usando imagens do registry
docker run -d -p 3001:8000 ghcr.io/[owner]/[repo]/backend:latest
docker run -d -p 3000:80 ghcr.io/[owner]/[repo]/frontend:latest
```

### 📋 Scripts Helper

Para facilitar o gerenciamento das imagens Docker:

```bash
# Linux/Mac
./scripts/docker-helper.sh help

# Windows
scripts\docker-helper.bat help
```

**Comandos disponíveis:**
- `build [service]` - Build local das imagens
- `pull [tag]` - Pull das imagens do registry
- `run [service]` - Executar serviço localmente
- `logs [service]` - Mostrar logs
- `clean` - Limpar imagens não utilizadas

### 🔄 CI/CD Pipeline

O pipeline automatizado inclui:

1. **Testes** - Unitários, integração e linting
2. **Build** - Imagens Docker multi-arquitetura
3. **Security** - Scan de vulnerabilidades
4. **Deploy** - Automático para staging/produção
5. **Monitoring** - Health checks e notificações

**Triggers:**
- Push para `main` → Deploy produção
- Push para `develop` → Deploy staging
- Tags `v*.*.*` → Release com changelog

### 📊 Registries Suportados

- **GitHub Container Registry** (GHCR) - Automático
- **Docker Hub** - Configuração opcional

Para mais detalhes, veja [DOCKER_CICD.md](docs/DOCKER_CICD.md)

## ☸️ Kubernetes

```bash
# Aplicar configurações
kubectl apply -f k8s/

# Verificar status
kubectl get pods -n aura-trading
```

## 📊 Monitoramento

### Métricas Disponíveis

- **Performance**: Latência, throughput, CPU, memória
- **Trading**: Número de trades, P&L, win rate
- **Sistema**: Uptime, erros, conexões ativas
- **Binance**: Rate limits, erros de API

### Dashboards

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090

## 🔒 Segurança

### Medidas Implementadas

- ✅ Criptografia AES-256 para chaves API
- ✅ Autenticação JWT com refresh tokens
- ✅ Rate limiting por usuário
- ✅ Validação de entrada rigorosa
- ✅ HTTPS obrigatório em produção
- ✅ Logs de auditoria completos

### Boas Práticas

- Nunca commitar credenciais
- Usar testnet para desenvolvimento
- Configurar whitelist de IP na Binance
- Monitorar logs de segurança
- Atualizar dependências regularmente

## 🤝 Contribuindo

### Desenvolvimento

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-feature`
3. Commit: `git commit -m 'Add nova feature'`
4. Push: `git push origin feature/nova-feature`
5. Abra um Pull Request

### Padrões de Código

- **TypeScript**: Strict mode habilitado
- **ESLint**: Configuração personalizada
- **Prettier**: Formatação automática
- **Testes**: Cobertura mínima de 80%

## 📈 Roadmap

### v1.1 (Q2 2025)
- [ ] Suporte a múltiplas exchanges
- [ ] Estratégias de machine learning
- [ ] Mobile app (React Native)

### v1.2 (Q3 2025)
- [ ] Copy trading
- [ ] Social features
- [ ] Advanced analytics

### v2.0 (Q4 2025)
- [ ] DeFi integration
- [ ] NFT trading
- [ ] Cross-chain support

## 🐛 Problemas Conhecidos

- WebSocket pode desconectar em redes instáveis
- Rate limiting da Binance em horários de pico
- Performance degradada com >1000 estratégias ativas

## 📞 Suporte

### Canais de Comunicação

- **Issues**: [GitHub Issues](https://github.com/aura-trading/sistema-aura/issues)
- **Discussions**: [GitHub Discussions](https://github.com/aura-trading/sistema-aura/discussions)
- **Email**: support@aura-trading.com
- **Discord**: [Servidor da Comunidade](https://discord.gg/aura-trading)

### FAQ

**P: Como configurar a API da Binance?**
R: Veja o guia completo em [BINANCE_SETUP.md](BINANCE_SETUP.md)

**P: O sistema funciona com outras exchanges?**
R: Atualmente apenas Binance. Outras exchanges estão no roadmap.

**P: É seguro usar em produção?**
R: Sim, com as configurações de segurança adequadas.

## 📄 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🙏 Agradecimentos

- **Binance**: Pela excelente API
- **Comunidade Open Source**: Pelas bibliotecas utilizadas
- **Beta Testers**: Pelo feedback valioso
- **Contribuidores**: Por tornarem este projeto possível

---

**⚠️ Aviso Legal**: Trading de criptomoedas envolve riscos significativos. Use apenas capital que você pode perder. Este software é fornecido "como está" sem garantias.

**📊 Status do Projeto**: ✅ Produção | 🔄 Desenvolvimento Ativo | 📈 Crescendo

---

<div align="center">

**Feito com ❤️ pela equipe AURA**

[Website](https://aura-trading.com) • [Documentação](https://docs.aura-trading.com) • [API](https://api.aura-trading.com)

</div>