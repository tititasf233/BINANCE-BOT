# 🚀 Guia Rápido - MCP-Bridge

## ⚡ Publicação Automática (Recomendado)

### 1. Criar Repositório no GitHub
1. Acesse [github.com](https://github.com)
2. Clique "+" → "New repository"
3. Nome: `mcp-bridge`
4. Público ✅
5. **NÃO** adicione README/gitignore
6. Clique "Create repository"

### 2. Configurar Secrets do Docker Hub
**IMPORTANTE: Faça ANTES do push!**

1. No repositório: **Settings** → **Secrets and variables** → **Actions**
2. Adicione:
   - `DOCKERHUB_USERNAME`: seu usuário Docker Hub
   - `DOCKERHUB_TOKEN`: seu token Docker Hub

### 3. Publicar com Script PowerShell
```powershell
# Substitua SEU_USUARIO pelo seu username do GitHub
.\publish-to-github.ps1 -GitHubUsername SEU_USUARIO
```

### 4. Verificar Deployment
```powershell
# Verificar se tudo funcionou
.\verify-deployment.ps1 -GitHubUsername SEU_USUARIO
```

## 🔧 Publicação Manual (Alternativa)

Se o script não funcionar:

```bash
# Substitua SEU_USUARIO pelo seu username do GitHub
git remote add origin https://github.com/SEU_USUARIO/mcp-bridge.git
git push -u origin main
```

## 📋 Checklist Final

- [ ] ✅ Repositório criado no GitHub
- [ ] 🔑 Secrets configurados (Docker Hub)
- [ ] 📤 Código enviado (push)
- [ ] 🤖 GitHub Actions executou
- [ ] 🐳 Imagem no Docker Hub
- [ ] 🧪 Testes passaram

## 🔗 Links Importantes

Após publicar, acesse:
- **Repositório**: `https://github.com/SEU_USUARIO/mcp-bridge`
- **Actions**: `https://github.com/SEU_USUARIO/mcp-bridge/actions`
- **Docker Hub**: `https://hub.docker.com/r/SEU_USUARIO/mcp-bridge`

## 🆘 Problemas?

1. **Actions falhou?** → Verifique secrets do Docker Hub
2. **Push falhou?** → Verifique se criou o repositório
3. **Imagem não aparece?** → Aguarde Actions terminar

## 🧪 Teste Rápido

```bash
# Testar API local
curl http://localhost:5000/health

# Testar imagem do Docker Hub (após deploy)
docker run -d -p 5001:5000 SEU_USUARIO/mcp-bridge:latest
curl http://localhost:5001/health
```

---

**🎉 Pronto! Seu MCP-Bridge está no ar!**