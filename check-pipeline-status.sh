#!/bin/bash

# Script para verificar status do pipeline localmente
# (Limitado - não pode acessar GitHub Actions diretamente)

echo "🚀 BINANCE-BOT Pipeline Status Checker"
echo "======================================"
echo ""

# Verificar último commit
echo "📊 Último Commit:"
git log --oneline -1
echo ""

# Verificar se há mudanças pendentes
echo "📋 Status do Git:"
git status --porcelain
if [ $? -eq 0 ] && [ -z "$(git status --porcelain)" ]; then
    echo "✅ Repositório limpo - sem mudanças pendentes"
else
    echo "⚠️  Há mudanças não commitadas"
fi
echo ""

# Verificar se Dockerfiles existem e estão corretos
echo "🐳 Verificação dos Dockerfiles:"
if [ -f "Dockerfile.backend" ]; then
    echo "✅ Dockerfile.backend existe"
else
    echo "❌ Dockerfile.backend não encontrado"
fi

if [ -f "Dockerfile.frontend" ]; then
    echo "✅ Dockerfile.frontend existe"
else
    echo "❌ Dockerfile.frontend não encontrado"
fi
echo ""

# Verificar workflows
echo "⚙️  Workflows GitHub Actions:"
if [ -f ".github/workflows/ci-cd.yml" ]; then
    echo "✅ CI/CD workflow configurado"
else
    echo "❌ CI/CD workflow não encontrado"
fi

if [ -f ".github/workflows/release.yml" ]; then
    echo "✅ Release workflow configurado"
else
    echo "❌ Release workflow não encontrado"
fi
echo ""

# Links para monitoramento manual
echo "🔗 Links para Monitoramento:"
echo "GitHub Actions: https://github.com/tititasf/BINANCE-BOT/actions"
echo "Packages: https://github.com/tititasf/BINANCE-BOT/pkgs"
echo ""

# Instruções
echo "📋 Para acompanhar o progresso:"
echo "1. Acesse: https://github.com/tititasf/BINANCE-BOT/actions"
echo "2. Clique no workflow mais recente"
echo "3. Monitore cada job em tempo real"
echo ""

# Verificar se imagens já estão disponíveis (tentativa)
echo "🧪 Teste de Conectividade (Opcional):"
echo "Para testar se as imagens estão prontas:"
echo "docker pull ghcr.io/tititasf/binance-bot/backend:latest"
echo "docker pull ghcr.io/tititasf/binance-bot/frontend:latest"
echo ""

echo "✅ Verificação local concluída!"
echo "Para status em tempo real, acesse o GitHub Actions no navegador."