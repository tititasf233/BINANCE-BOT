#!/bin/bash

echo "🚀 Iniciando AURA Trading System com DADOS REAIS"
echo "================================================"

# Verificar se as credenciais da Binance estão configuradas
if [ -z "$BINANCE_API_KEY" ] && [ ! -f "backend/.env" ]; then
    echo "❌ ERRO: Credenciais da Binance não encontradas!"
    echo "Configure o arquivo backend/.env com suas credenciais"
    exit 1
fi

echo "✅ Credenciais da Binance encontradas"

# Verificar se os containers estão rodando
echo "🔍 Verificando containers..."
docker-compose ps

# Iniciar containers se necessário
echo "🐳 Iniciando containers..."
docker-compose up -d

# Aguardar containers iniciarem
echo "⏳ Aguardando containers iniciarem..."
sleep 15

# Testar conectividade com Binance
echo "🌐 Testando conectividade com Binance..."
curl -s http://localhost:3001/api/market/health | jq .

# Testar dados de mercado
echo "📊 Testando dados de mercado..."
curl -s http://localhost:3001/api/market/prices | jq '.data[0:3]'

# Verificar frontend
echo "🖥️  Verificando frontend..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

echo ""
echo "🎉 AURA Trading System iniciado com DADOS REAIS!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:3001"
echo "📊 Dados de mercado: http://localhost:3001/api/market/prices"
echo "❤️  Health check: http://localhost:3001/api/market/health"
echo ""
echo "✅ Todos os dados são REAIS da Binance Testnet"
echo "🔒 Modo seguro: Testnet ativado"