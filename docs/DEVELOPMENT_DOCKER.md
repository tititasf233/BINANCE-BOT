# 🚀 Ambiente de Desenvolvimento Docker - Bind Mounts

Este documento explica como usar o ambiente de desenvolvimento Docker configurado com bind mounts para desenvolvimento dinâmico.

## 📋 Visão Geral

O ambiente de desenvolvimento foi configurado com **bind mounts** que permitem que as alterações feitas no código local sejam refletidas imediatamente dentro dos containers, sem necessidade de rebuild das imagens.

### ✨ Características Principais

- **Desenvolvimento Dinâmico**: Alterações no código são refletidas instantaneamente
- **Hot Reload**: Backend e Frontend com reload automático
- **Volumes Otimizados**: node_modules isolados em volumes anônimos
- **Logs Separados**: Volumes dedicados para logs de desenvolvimento
- **Scripts Automatizados**: Comandos simplificados para gerenciamento

## 🛠️ Arquivos de Configuração

### Docker Compose para Desenvolvimento
- `docker-compose.dev.yml` - Configuração específica para desenvolvimento
- `backend/Dockerfile.dev` - Dockerfile otimizado para desenvolvimento do backend
- `frontend/Dockerfile.dev` - Dockerfile otimizado para desenvolvimento do frontend

### Scripts de Gerenciamento
- `scripts/dev-docker.sh` - Script Linux/Mac
- `scripts/dev-docker.bat` - Script Windows

## 🚀 Como Usar

### 1. Iniciar o Ambiente

**Linux/Mac:**
```bash
./scripts/dev-docker.sh start
```

**Windows:**
```cmd
scripts\dev-docker.bat start
```

### 2. Verificar Status

**Linux/Mac:**
```bash
./scripts/dev-docker.sh status
```

**Windows:**
```cmd
scripts\dev-docker.bat status
```

### 3. Ver Logs

**Todos os serviços:**
```bash
./scripts/dev-docker.sh logs
```

**Serviço específico:**
```bash
./scripts/dev-docker.sh logs backend
./scripts/dev-docker.sh logs frontend
```

### 4. Entrar no Container

**Backend (padrão):**
```bash
./scripts/dev-docker.sh exec
```

**Frontend:**
```bash
./scripts/dev-docker.sh exec frontend
```

### 5. Parar o Ambiente

```bash
./scripts/dev-docker.sh stop
```

### 6. Reiniciar o Ambiente

```bash
./scripts/dev-docker.sh restart
```

## 🔧 Configurações de Bind Mount

### Backend
```yaml
volumes:
  - ./backend:/app                    # Código fonte
  - /app/node_modules                  # Dependências isoladas
  - backend_logs:/app/logs            # Logs de desenvolvimento
```

### Frontend
```yaml
volumes:
  - ./frontend:/app                   # Código fonte
  - /app/node_modules                  # Dependências isoladas
  - frontend_cache:/app/.cache        # Cache do React
```

## ⚡ Variáveis de Ambiente para Desenvolvimento

### Backend
```yaml
environment:
  NODE_ENV: development
  CHOKIDAR_USEPOLLING: "true"        # Hot reload otimizado
  WATCHPACK_POLLING: "true"          # Webpack polling
```

### Frontend
```yaml
environment:
  CHOKIDAR_USEPOLLING: "true"        # Hot reload otimizado
  WATCHPACK_POLLING: "true"          # Webpack polling
  FAST_REFRESH: "true"               # React Fast Refresh
```

## 🔄 Fluxo de Desenvolvimento

### 1. Desenvolvimento Normal
1. Inicie o ambiente: `./scripts/dev-docker.sh start`
2. Faça alterações no código local
3. As alterações são refletidas automaticamente nos containers
4. Backend reinicia automaticamente com nodemon
5. Frontend atualiza automaticamente com hot reload

### 2. Adicionando Dependências
Se você adicionar novas dependências:

**Backend:**
```bash
# No host
cd backend
npm install nova-dependencia

# Rebuild do container
./scripts/dev-docker.sh rebuild backend
```

**Frontend:**
```bash
# No host
cd frontend
npm install nova-dependencia

# Rebuild do container
./scripts/dev-docker.sh rebuild frontend
```

### 3. Debugging
Para debugar dentro do container:

```bash
# Entrar no container
./scripts/dev-docker.sh exec backend

# Dentro do container
npm run debug
```

## 📊 Monitoramento

### Verificar Logs em Tempo Real
```bash
# Todos os serviços
./scripts/dev-docker.sh logs

# Serviço específico
./scripts/dev-docker.sh logs backend
```

### Verificar Status dos Containers
```bash
./scripts/dev-docker.sh status
```

### Verificar Uso de Recursos
```bash
docker stats
```

## 🧹 Limpeza e Manutenção

### Limpar Volumes
```bash
./scripts/dev-docker.sh cleanup
```

### Rebuild Completo
```bash
# Todos os serviços
./scripts/dev-docker.sh rebuild

# Serviço específico
./scripts/dev-docker.sh rebuild backend
```

## 🔍 Troubleshooting

### Problema: Alterações não são refletidas
**Solução:**
1. Verifique se o bind mount está funcionando:
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend ls -la /app
   ```

2. Reinicie o serviço:
   ```bash
   ./scripts/dev-docker.sh restart
   ```

### Problema: node_modules conflitando
**Solução:**
1. Pare o ambiente: `./scripts/dev-docker.sh stop`
2. Remova node_modules local: `rm -rf backend/node_modules frontend/node_modules`
3. Reinicie: `./scripts/dev-docker.sh start`

### Problema: Portas em uso
**Solução:**
1. Verifique processos usando as portas:
   ```bash
   netstat -tulpn | grep :3000
   netstat -tulpn | grep :3001
   ```

2. Pare processos conflitantes ou altere as portas no docker-compose.dev.yml

## 📝 Comandos Úteis

### Desenvolvimento Rápido
```bash
# Iniciar tudo
./scripts/dev-docker.sh start

# Ver logs em tempo real
./scripts/dev-docker.sh logs

# Parar tudo
./scripts/dev-docker.sh stop
```

### Debugging
```bash
# Entrar no backend
./scripts/dev-docker.sh exec backend

# Ver logs do backend
./scripts/dev-docker.sh logs backend

# Rebuild backend
./scripts/dev-docker.sh rebuild backend
```

### Manutenção
```bash
# Status dos containers
./scripts/dev-docker.sh status

# Limpar volumes
./scripts/dev-docker.sh cleanup

# Rebuild completo
./scripts/dev-docker.sh rebuild
```

## 🎯 Benefícios do Bind Mount

1. **Desenvolvimento Dinâmico**: Alterações instantâneas
2. **Performance**: Não precisa rebuild para cada alteração
3. **Debugging**: Acesso direto aos arquivos dentro do container
4. **Flexibilidade**: Pode usar qualquer editor/IDE local
5. **Consistência**: Ambiente idêntico entre desenvolvedores

## 🔗 URLs de Acesso

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## 📚 Recursos Adicionais

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Volumes](https://docs.docker.com/storage/volumes/)
- [Node.js Development in Docker](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [React Development in Docker](https://create-react-app.dev/docs/deployment/) 