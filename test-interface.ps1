# Script PowerShell para testar a interface da aplicação AURA
Write-Host "TESTANDO INTERFACE DA APLICACAO AURA" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:3001"
$frontendUrl = "http://localhost:3000"

try {
    # 1. Verificar Backend
    Write-Host "`n1. Verificando Backend..." -ForegroundColor Yellow
    $health = curl -Method GET -Uri "$baseUrl/health"
    $healthData = $health.Content | ConvertFrom-Json
    Write-Host "OK Backend Status: $($healthData.status)" -ForegroundColor Green

    # 2. Registrar usuário de teste
    Write-Host "`n2. Registrando usuário de teste..." -ForegroundColor Yellow
    $registerBody = @{
        name = "Usuario Interface"
        email = "interface@teste.com"
        password = "senha123"
    } | ConvertTo-Json

    try {
        $registerResponse = curl -Method POST -Uri "$baseUrl/api/auth/register" -Body $registerBody -ContentType "application/json"
        $registerData = $registerResponse.Content | ConvertFrom-Json
        Write-Host "OK Usuario registrado: $($registerData.data.user.name)" -ForegroundColor Green
    } catch {
        Write-Host "INFO Usuario ja existe ou erro esperado, continuando..." -ForegroundColor Cyan
    }

    # 3. Fazer login
    Write-Host "`n3. Fazendo login..." -ForegroundColor Yellow
    $loginBody = @{
        email = "interface@teste.com"
        password = "senha123"
    } | ConvertTo-Json

    $loginResponse = curl -Method POST -Uri "$baseUrl/api/auth/login" -Body $loginBody -ContentType "application/json"
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $token = $loginData.data.token

    Write-Host "OK Login realizado com sucesso" -ForegroundColor Green
    Write-Host "TOKEN: $($token.Substring(0,50))..." -ForegroundColor Green

    # 4. Acessar perfil
    Write-Host "`n4. Acessando perfil do usuário..." -ForegroundColor Yellow
    $headers = @{
        'Authorization' = "Bearer $token"
        'Content-Type' = 'application/json'
    }

    $profileResponse = curl -Method GET -Uri "$baseUrl/api/auth/profile" -Headers $headers
    $profileData = $profileResponse.Content | ConvertFrom-Json

    Write-Host "OK Perfil acessado:" -ForegroundColor Green
    Write-Host "   Nome: $($profileData.data.user.name)" -ForegroundColor White
    Write-Host "   Email: $($profileData.data.user.email)" -ForegroundColor White
    Write-Host "   Role: $($profileData.data.user.role)" -ForegroundColor White

    # 5. Verificar monitoramento
    Write-Host "`n5. Verificando monitoramento..." -ForegroundColor Yellow
    $monitoringResponse = curl -Method GET -Uri "$baseUrl/api/monitoring/stats"
    $monitoringData = $monitoringResponse.Content | ConvertFrom-Json

    Write-Host "OK Estatisticas de monitoramento:" -ForegroundColor Green
    Write-Host "   Total Requests: $($monitoringData.data.totalRequests)" -ForegroundColor White
    Write-Host "   Taxa de Erro: $($monitoringData.data.errorRate)%" -ForegroundColor White
    Write-Host "   Tempo Médio: $($monitoringData.data.avgResponseTime)ms" -ForegroundColor White

    # 6. Verificar Frontend
    Write-Host "`n6. Verificando Frontend..." -ForegroundColor Yellow
    $frontendResponse = curl -Method GET -Uri $frontendUrl
    Write-Host "OK Frontend Status: $($frontendResponse.StatusCode)" -ForegroundColor Green

    # 7. Simular navegação na interface
    Write-Host "`n7. Simulando navegação na interface..." -ForegroundColor Yellow
    Write-Host "INTERFACE WEB disponivel em:" -ForegroundColor Cyan
    Write-Host "   Frontend: $frontendUrl" -ForegroundColor White
    Write-Host "   Backend API: $baseUrl" -ForegroundColor White

    # 8. Demonstrar endpoints disponíveis
    Write-Host "`n8. Endpoints da API disponíveis:" -ForegroundColor Yellow
    Write-Host "   AUTH POST /api/auth/register - Registro" -ForegroundColor White
    Write-Host "   AUTH POST /api/auth/login - Login" -ForegroundColor White
    Write-Host "   USER GET /api/auth/profile - Perfil (protegido)" -ForegroundColor White
    Write-Host "   TRADE GET /api/trading/* - APIs de Trading (protegido)" -ForegroundColor White
    Write-Host "   MONITOR GET /api/monitoring/* - Monitoramento" -ForegroundColor White
    Write-Host "   HEALTH GET /health - Health Check" -ForegroundColor White

    Write-Host "`nTESTE DA INTERFACE CONCLUIDO COM SUCESSO!" -ForegroundColor Green
    Write-Host "NAVEGADOR: Abra seu navegador em: $frontendUrl" -ForegroundColor Yellow
    Write-Host "API: Documentada em: $baseUrl" -ForegroundColor Yellow

} catch {
    Write-Host "ERRO no teste: $($_.Exception.Message)" -ForegroundColor Red
}