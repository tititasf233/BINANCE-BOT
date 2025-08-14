# Script PowerShell para verificar se o deployment do MCP-Bridge funcionou

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubUsername,
    
    [Parameter(Mandatory=$false)]
    [string]$RepositoryName = "mcp-bridge"
)

Write-Host "🔍 Verificando deployment do MCP-Bridge..." -ForegroundColor Green
Write-Host ""

# 1. Verificar se o repositório existe no GitHub
Write-Host "1️⃣ Verificando repositório no GitHub..." -ForegroundColor Yellow
$repoUrl = "https://github.com/$GitHubUsername/$RepositoryName"
try {
    $response = Invoke-WebRequest -Uri $repoUrl -Method Head -ErrorAction Stop
    Write-Host "   ✅ Repositório encontrado: $repoUrl" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Repositório não encontrado: $repoUrl" -ForegroundColor Red
    Write-Host "   💡 Certifique-se de ter criado o repositório no GitHub" -ForegroundColor Cyan
    return
}

# 2. Verificar GitHub Actions
Write-Host ""
Write-Host "2️⃣ Verificando GitHub Actions..." -ForegroundColor Yellow
$actionsUrl = "$repoUrl/actions"
Write-Host "   🔗 Acesse: $actionsUrl" -ForegroundColor Cyan
Write-Host "   📋 Verifique se o workflow 'Build and Deploy MCP-Bridge' executou" -ForegroundColor White

# 3. Verificar se a imagem existe no Docker Hub
Write-Host ""
Write-Host "3️⃣ Verificando imagem no Docker Hub..." -ForegroundColor Yellow
$dockerHubUrl = "https://hub.docker.com/r/$GitHubUsername/$RepositoryName"
try {
    $response = Invoke-WebRequest -Uri $dockerHubUrl -Method Head -ErrorAction Stop
    Write-Host "   ✅ Imagem encontrada: $dockerHubUrl" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Imagem ainda não disponível: $dockerHubUrl" -ForegroundColor Yellow
    Write-Host "   💡 Aguarde o GitHub Actions terminar ou verifique os logs" -ForegroundColor Cyan
}

# 4. Testar a API local
Write-Host ""
Write-Host "4️⃣ Testando API local..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/health" -ErrorAction Stop
    Write-Host "   ✅ API local funcionando!" -ForegroundColor Green
    Write-Host "   📊 Status: $($response.status)" -ForegroundColor White
    Write-Host "   🐳 Docker conectado: $($response.docker_connected)" -ForegroundColor White
} catch {
    Write-Host "   ❌ API local não está respondendo" -ForegroundColor Red
    Write-Host "   💡 Execute: docker-compose up -d" -ForegroundColor Cyan
}

# 5. Testar imagem do Docker Hub (se disponível)
Write-Host ""
Write-Host "5️⃣ Testando imagem do Docker Hub..." -ForegroundColor Yellow
$imageName = "$GitHubUsername/$RepositoryName`:latest"
try {
    # Verificar se a imagem existe localmente ou pode ser baixada
    $pullResult = docker pull $imageName 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Imagem baixada com sucesso: $imageName" -ForegroundColor Green
        
        # Testar a imagem
        Write-Host "   🧪 Testando imagem..." -ForegroundColor Yellow
        $containerId = docker run -d -p 5001:5000 $imageName
        Start-Sleep -Seconds 5
        
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:5001/health" -ErrorAction Stop
            Write-Host "   ✅ Imagem do Docker Hub funcionando!" -ForegroundColor Green
            docker stop $containerId | Out-Null
            docker rm $containerId | Out-Null
        } catch {
            Write-Host "   ❌ Imagem não está respondendo" -ForegroundColor Red
            docker stop $containerId | Out-Null
            docker rm $containerId | Out-Null
        }
    } else {
        Write-Host "   ⚠️  Não foi possível baixar a imagem" -ForegroundColor Yellow
        Write-Host "   💡 Verifique se o GitHub Actions terminou com sucesso" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   ❌ Erro ao testar imagem do Docker Hub" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 Resumo dos Links Importantes:" -ForegroundColor Cyan
Write-Host "   🔗 Repositório: $repoUrl" -ForegroundColor White
Write-Host "   🔗 Actions: $actionsUrl" -ForegroundColor White
Write-Host "   🔗 Docker Hub: $dockerHubUrl" -ForegroundColor White
Write-Host "   🔗 API Local: http://localhost:5000/health" -ForegroundColor White

Write-Host ""
Write-Host "🏁 Verificação concluída!" -ForegroundColor Green