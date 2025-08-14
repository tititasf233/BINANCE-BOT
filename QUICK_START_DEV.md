# 🚀 Guia Rápido - Ambiente de Desenvolvimento Docker

## ⚡ Início Rápido

### 1. Iniciar o Ambiente
```bash
# Linux/Mac
./scripts/dev-docker.sh start

# Windows
scripts\dev-docker.bat start
```

### 2. Verificar Status
```bash
./scripts/dev-docker.sh status
```

### 3. Acessar as Aplicações
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 🔄 Desenvolvimento Dinâmico

### Alterações Automáticas
1. Faça alterações no código local
2. As mudanças são refletidas automaticamente nos containers
3. Backend reinicia automaticamente
4. Frontend atualiza com hot reload

### Exemplo de Fluxo
```bash
# 1. Iniciar ambiente
./scripts/dev-docker.sh start

# 2. Fazer alterações no código
# (editar arquivos em backend/ ou frontend/)

# 3. Ver logs em tempo real
./scripts/dev-docker.sh logs

# 4. Parar ambiente
./scripts/dev-docker.sh stop
```

## 📋 Comandos Essenciais

| Comando | Descrição |
|---------|-----------|
| `./scripts/dev-docker.sh start` | Iniciar ambiente |
| `./scripts/dev-docker.sh stop` | Parar ambiente |
| `./scripts/dev-docker.sh restart` | Reiniciar ambiente |
| `./scripts/dev-docker.sh logs` | Ver logs |
| `./scripts/dev-docker.sh status` | Status dos containers |
| `./scripts/dev-docker.sh exec` | Entrar no container |

## 🎯 URLs de Acesso

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 📚 Documentação Completa

Para mais detalhes, consulte: [docs/DEVELOPMENT_DOCKER.md](docs/DEVELOPMENT_DOCKER.md) 