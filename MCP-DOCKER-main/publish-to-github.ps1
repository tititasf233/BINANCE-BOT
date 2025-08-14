# Script PowerShell para publicar o MCP-Bridge no GitHub
# Execute este script após criar o repositório no GitHub e configurar os secrets

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubUsername,
    
    [Parameter(Mandatory=$false)]
    [string]$RepositoryName = "mcp-bridge"
)

Write-Host "🚀 Publicando MCP-Bridge no GitHub..." -ForegroundColor Green
Write-Host "Usuario: $GitHubUsername" -ForegroundColor Yellow
Write-Host "Repositorio: $RepositoryName" -ForegroundColor Yellow
Write-Host ""

# Verificar se o Git está configurado
$gitUser = git config user.name
$gitEmail = git config user.email

if (-not $gitUser -or -not $gitEmail) {
    Write-Host "⚠️  Configurando Git..." -ForegroundColor Yellow
    git config user.name "MCP-Bridge Developer"
    git config user.email "developer@mcp-bridge.local"
}

# Verificar se há mudanças para commitar
$status = git status --porcelain
if ($status) {
    Write-Host "📝 Commitando mudanças pendentes..." -ForegroundColor Yellow
    git add .
    git commit -m "Final updates before GitHub publication"
}

# Verificar se o remote já existe
$remotes = git remote
if ($remotes -contains "origin") {
    Write-Host "🔄 Remote 'origin' já existe, removendo..." -ForegroundColor Yellow
    git remote remove origin
}

# Adicionar o remote do GitHub
$repoUrl = "https://github.com/$GitHubUsername/$RepositoryName.git"
Write-Host "🔗 Adicionando remote: $repoUrl" -ForegroundColor Yellow
git remote add origin $repoUrl

# Fazer push para o GitHub
Write-Host "📤 Fazendo push para o GitHub..." -ForegroundColor Yellow
try {
    git push -u origin main
    Write-Host ""
    Write-Host "✅ Sucesso! Projeto publicado no GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🔗 Acesse seu repositório em:" -ForegroundColor Cyan
    Write-Host "   https://github.com/$GitHubUsername/$RepositoryName" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Próximos passos:" -ForegroundColor Yellow
    Write-Host "   1. Configure os secrets do Docker Hub no GitHub" -ForegroundColor White
    Write-Host "   2. Verifique se o GitHub Actions executou com sucesso" -ForegroundColor White
    Write-Host "   3. Confira se a imagem foi publicada no Docker Hub" -ForegroundColor White
    Write-Host ""
    Write-Host "📖 Consulte DEPLOY_INSTRUCTIONS.md para detalhes" -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "❌ Erro ao fazer push!" -ForegroundColor Red
    Write-Host "Possíveis causas:" -ForegroundColor Yellow
    Write-Host "   - Repositório não foi criado no GitHub" -ForegroundColor White
    Write-Host "   - Username incorreto" -ForegroundColor White
    Write-Host "   - Problemas de autenticação" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Solução:" -ForegroundColor Cyan
    Write-Host "   1. Verifique se criou o repositório no GitHub" -ForegroundColor White
    Write-Host "   2. Configure suas credenciais do Git" -ForegroundColor White
    Write-Host "   3. Tente novamente com: .\publish-to-github.ps1 -GitHubUsername SEU_USUARIO" -ForegroundColor White
}

Write-Host ""
Write-Host "🏁 Script finalizado!" -ForegroundColor Green