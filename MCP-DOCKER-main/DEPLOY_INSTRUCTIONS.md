# 🚀 Instruções para Deploy no GitHub

## 1. Criar Repositório no GitHub

1. Acesse [github.com](https://github.com) e faça login
2. Clique no botão "+" no canto superior direito → "New repository"
3. Configure:
   - **Repository name**: `mcp-bridge`
   - **Description**: `MCP-Bridge - Docker Container Management API`
   - **Public**: ✅ (para GitHub Actions gratuito)
   - **NÃO** marque "Add a README file" (já temos)
   - **NÃO** marque "Add .gitignore" (já temos)
   - **NÃO** marque "Choose a license" (pode adicionar depois)
4. Clique "Create repository"

## 2. Configurar Secrets do Docker Hub

**IMPORTANTE**: Faça isso ANTES do push!

1. No repositório GitHub: **Settings** → **Secrets and variables** → **Actions**
2. Clique "New repository secret"
3. Adicione:

   **Secret 1:**
   - Name: `DOCKERHUB_USERNAME`
   - Value: `seu-usuario-dockerhub`

   **Secret 2:**
   - Name: `DOCKERHUB_TOKEN`
   - Value: `seu-token-dockerhub`

### Como criar Token do Docker Hub:
1. Acesse [hub.docker.com](https://hub.docker.com)
2. **Account Settings** → **Security** → **New Access Token**
3. Nome: `github-actions-mcp-bridge`
4. Permissões: **Read, Write, Delete**
5. **Copie o token** (só aparece uma vez!)

## 3. Fazer Push para GitHub

Execute estes comandos (substitua `SEU-USUARIO`):

```bash
git remote add origin https://github.com/SEU-USUARIO/mcp-bridge.git
git push -u origin main
```

## 4. Verificar GitHub Actions

1. Vá para o repositório no GitHub
2. Aba **Actions**
3. Deve aparecer: "Build and Deploy MCP-Bridge"
4. Clique para ver detalhes

## 5. Verificar Deploy no Docker Hub

Após sucesso do Actions:
1. Acesse [hub.docker.com](https://hub.docker.com)
2. Vá em **Repositories**
3. Deve aparecer: `seu-usuario/mcp-bridge`

## 6. Testar Imagem Publicada

```bash
# Parar container local
docker-compose down

# Usar imagem do Docker Hub
docker run -d --name mcp-bridge-hub -p 5001:5000 -v /var/run/docker.sock:/var/run/docker.sock seu-usuario/mcp-bridge:latest

# Testar
curl http://localhost:5001/health
```

## ✅ Checklist de Verificação

- [ ] Repositório criado no GitHub
- [ ] Secrets configurados (DOCKERHUB_USERNAME e DOCKERHUB_TOKEN)
- [ ] Push realizado com sucesso
- [ ] GitHub Actions executou sem erros
- [ ] Imagem aparece no Docker Hub
- [ ] Teste da imagem publicada funcionou

## 🔧 Troubleshooting

**Actions falhou?**
- Verifique se os secrets estão corretos
- Verifique se o token do Docker Hub tem permissões adequadas

**Imagem não aparece no Docker Hub?**
- Verifique os logs do GitHub Actions
- Confirme se o username está correto nos secrets

**Erro de permissão?**
- Certifique-se que o token do Docker Hub não expirou
- Verifique se o repositório no Docker Hub existe (será criado automaticamente)