# Docker CI/CD com GitHub Actions

Este documento explica como o sistema de CI/CD está configurado para automatizar o build e deploy das imagens Docker do sistema AURA.

## Visão Geral

O sistema possui 3 workflows principais:

1. **CI/CD Pipeline** (`ci-cd.yml`) - Executa testes, build e deploy automático
2. **Release** (`release.yml`) - Cria releases com tags semânticas
3. **Cleanup** (`cleanup.yml`) - Remove imagens antigas automaticamente

## Workflows

### 1. CI/CD Pipeline

**Triggers:**
- Push para `main` ou `develop`
- Pull requests para `main`

**Jobs:**
- `test` - Executa testes unitários e de integração
- `build` - Constrói e publica imagens Docker
- `publish-dockerhub` - Publica no Docker Hub (opcional)
- `deploy-staging` - Deploy automático para staging (branch develop)
- `deploy-production` - Deploy automático para produção (branch main)
- `security` - Análise de segurança com Trivy e CodeQL

### 2. Release Workflow

**Triggers:**
- Push de tags no formato `v*.*.*` (ex: v1.0.0)

**Funcionalidades:**
- Build de imagens com tags semânticas
- Publicação no GitHub Container Registry e Docker Hub
- Geração de SBOM (Software Bill of Materials)
- Criação automática de GitHub Release com changelog

### 3. Cleanup Workflow

**Triggers:**
- Agendado para domingos às 2:00 AM UTC
- Execução manual via workflow_dispatch

**Funcionalidade:**
- Remove imagens antigas mantendo apenas as 10 mais recentes
- Preserva tags importantes (latest, stable, main, develop)

## Registries Suportados

### GitHub Container Registry (GHCR)
- **URL:** `ghcr.io`
- **Autenticação:** Automática via `GITHUB_TOKEN`
- **Imagens:**
  - Backend: `ghcr.io/[owner]/[repo]/backend`
  - Frontend: `ghcr.io/[owner]/[repo]/frontend`

### Docker Hub (Opcional)
- **URL:** `docker.io`
- **Configuração necessária:**
  - `DOCKERHUB_USERNAME` - Seu username do Docker Hub
  - `DOCKERHUB_TOKEN` - Token de acesso do Docker Hub

## Configuração de Secrets

Para usar todos os recursos, configure os seguintes secrets no GitHub:

### Obrigatórios
- `GITHUB_TOKEN` - Gerado automaticamente pelo GitHub

### Opcionais (Docker Hub)
- `DOCKERHUB_USERNAME` - Username do Docker Hub
- `DOCKERHUB_TOKEN` - Token de acesso do Docker Hub

### Para Deploy (se usando Kubernetes)
- `KUBE_CONFIG_STAGING` - Configuração kubectl para staging (base64)
- `KUBE_CONFIG_PRODUCTION` - Configuração kubectl para produção (base64)

### Para Notificações
- `SLACK_WEBHOOK_URL` - URL do webhook do Slack para notificações

## Tags de Imagem

### Branches
- `main` → `latest`
- `develop` → `develop`
- `feature/xyz` → `feature-xyz`

### Pull Requests
- `pr-123` → `pr-123`

### Releases (Tags)
- `v1.2.3` → `1.2.3`, `1.2`, `1`, `stable`

### Commits
- Qualquer commit → `[branch]-[sha]`

## Uso das Imagens

### Desenvolvimento Local
```bash
# Usar imagens da branch develop
docker pull ghcr.io/[owner]/[repo]/backend:develop
docker pull ghcr.io/[owner]/[repo]/frontend:develop
```

### Produção
```bash
# Usar imagens estáveis
docker pull ghcr.io/[owner]/[repo]/backend:latest
docker pull ghcr.io/[owner]/[repo]/frontend:latest

# Ou versão específica
docker pull ghcr.io/[owner]/[repo]/backend:1.2.3
docker pull ghcr.io/[owner]/[repo]/frontend:1.2.3
```

### Docker Compose
```yaml
version: '3.8'
services:
  backend:
    image: ghcr.io/[owner]/[repo]/backend:latest
    # ... outras configurações
  
  frontend:
    image: ghcr.io/[owner]/[repo]/frontend:latest
    # ... outras configurações
```

## Processo de Release

### 1. Preparar Release
```bash
# Atualizar versão no package.json
npm version patch  # ou minor, major

# Fazer commit das mudanças
git add .
git commit -m "chore: bump version to v1.2.3"
```

### 2. Criar Tag
```bash
# Criar e push da tag
git tag v1.2.3
git push origin v1.2.3
```

### 3. Automático
- GitHub Actions detecta a tag
- Executa build das imagens
- Publica nos registries
- Cria GitHub Release com changelog

## Monitoramento

### Logs de Build
- Acesse a aba "Actions" no GitHub
- Selecione o workflow desejado
- Visualize logs detalhados de cada job

### Imagens Publicadas
- **GHCR:** https://github.com/[owner]/[repo]/pkgs/container/[service]
- **Docker Hub:** https://hub.docker.com/r/[username]/aura-[service]

### Segurança
- Relatórios de vulnerabilidade na aba "Security"
- SBOMs disponíveis nos releases
- Análise CodeQL automática

## Troubleshooting

### Build Falha
1. Verifique os logs no GitHub Actions
2. Teste o build localmente:
   ```bash
   docker build -f Dockerfile.backend .
   docker build -f Dockerfile.frontend .
   ```

### Push Falha
1. Verifique permissões do token
2. Confirme que o registry está acessível
3. Verifique se o nome da imagem está correto

### Deploy Falha
1. Verifique configuração do kubectl
2. Confirme que os secrets estão configurados
3. Teste conectividade com o cluster

## Otimizações

### Cache
- Build cache é compartilhado entre execuções
- Layers Docker são reutilizadas quando possível
- Cache separado por serviço (backend/frontend)

### Paralelização
- Builds de backend e frontend executam em paralelo
- Testes executam antes dos builds
- Deploy só acontece após builds bem-sucedidos

### Multi-arquitetura
- Imagens são buildadas para AMD64 e ARM64
- Suporte nativo para Apple Silicon e servidores ARM

## Comandos Úteis

### Verificar Imagens Locais
```bash
# Listar imagens do projeto
docker images | grep aura

# Verificar tamanho das imagens
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

### Limpeza Local
```bash
# Remover imagens não utilizadas
docker image prune -f

# Remover todas as imagens do projeto
docker rmi $(docker images "ghcr.io/*/aura-*" -q)
```

### Debug de Imagens
```bash
# Executar shell dentro da imagem
docker run -it --rm ghcr.io/[owner]/[repo]/backend:latest sh

# Verificar logs de uma imagem
docker run --rm ghcr.io/[owner]/[repo]/backend:latest cat /var/log/app.log
```

## Próximos Passos

1. **Configurar Docker Hub** (opcional)
2. **Configurar deploy automático** para seus ambientes
3. **Personalizar notificações** (Slack, Discord, etc.)
4. **Adicionar testes de performance** no pipeline
5. **Configurar monitoramento** das imagens em produção