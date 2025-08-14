Write-Host "🚀 Iniciando AURA Trading System com DADOS REAIS" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green

# Verificar se os containers estão rodando
Write-Host "🔍 Verificando containers..." -ForegroundColor Yellow
docker-compose ps

# Iniciar containers se necessário
Write-Host "🐳 Iniciando containers..." -ForegroundColor Yellow
docker-compose up -d

# Aguardar containers iniciarem
Write-Host "⏳ Aguardando containers iniciarem..." -ForegroundColor Yellow
Start-Sleep 15

# Testar conectividade com Binance
Write-Host "🌐 Testando conectividade com Binance..." -ForegroundColor Yellow
try {
    $healthResponse = curl http://localhost:3001/api/market/health
    $healthData = $healthResponse.Content | ConvertFrom-Json
    Write-Host "✅ Binance Status: $($healthData.data.status)" -ForegroundColor Green
    Write-Host "🕐 Sincronização: $($healthData.data.timeDifference)ms" -ForegroundColor Green
    Write-Host "🌐 Modo: $($healthData.data.mode)" -ForegroundColor Green
} catch {
    Write-Host "❌ Erro ao conectar com Binance" -ForegroundColor Red
}

# Testar dados de mercado
Write-Host "📊 Testando dados de mercado..." -ForegroundColor Yellow
try {
    $marketResponse = curl http://localhost:3001/api/market/prices
    $marketData = $marketResponse.Content | ConvertFrom-Json
    Write-Host "✅ Dados de mercado carregados: $($marketData.data.Length) símbolos" -ForegroundColor Green
    
    # Mostrar alguns preços
    $btc = $marketData.data | Where-Object { $_.symbol -eq "BTCUSDT" }
    if ($btc) {
        Write-Host "₿  BTC/USDT: $($btc.price) ($(if($btc.change24h -ge 0){"+"})$($btc.change24h.ToString("F2"))%)" -ForegroundColor Cyan
    }
} catch {
    Write-Host "❌ Erro ao carregar dados de mercado" -ForegroundColor Red
}

# Verificar frontend
Write-Host "🖥️  Verificando frontend..." -ForegroundColor Yellow
try {
    $frontendResponse = curl http://localhost:3000
    if ($frontendResponse.StatusCode -eq 200) {
        Write-Host "✅ Frontend funcionando" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Erro no frontend" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 AURA Trading System iniciado com DADOS REAIS!" -ForegroundColor Green
Write-Host "📱 Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "🔧 Backend API: http://localhost:3001" -ForegroundColor White
Write-Host "📊 Dados de mercado: http://localhost:3001/api/market/prices" -ForegroundColor White
Write-Host "❤️  Health check: http://localhost:3001/api/market/health" -ForegroundColor White
Write-Host ""
Write-Host "✅ Todos os dados são REAIS da Binance Testnet" -ForegroundColor Green
Write-Host "🔒 Modo seguro: Testnet ativado" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Para fazer login use:" -ForegroundColor Yellow
Write-Host "   Email: interface@teste.com" -ForegroundColor White
Write-Host "   Senha: senha123" -ForegroundColor White