import 'dotenv/config';
import { BinanceService } from '../services/BinanceService';
import { logger } from '../utils/logger';

async function testBinanceConnection() {
    console.log('🚀 Testando conexão REAL com a Binance...');
    console.log('=====================================');

    try {
        // Verificar se as credenciais estão disponíveis
        const apiKey = process.env.BINANCE_API_KEY;
        const secretKey = process.env.BINANCE_SECRET_KEY;
        const useTestnet = process.env.BINANCE_USE_TESTNET === 'true';

        if (!apiKey || !secretKey) {
            throw new Error('BINANCE_API_KEY ou BINANCE_SECRET_KEY não encontradas no .env');
        }

        // Usar credenciais do .env
        const binanceService = new BinanceService({
            apiKey,
            secretKey,
            isTestnet: useTestnet
        });

        console.log(`🌐 Modo: ${useTestnet ? 'TESTNET' : 'MAINNET'}`);
        console.log(`🔑 API Key: ${apiKey.substring(0, 10)}...`);
        console.log(`🔐 Secret Key: ${secretKey.substring(0, 10)}...`);

        // 1. Teste de conectividade básica
        console.log('\n1. Testando conectividade básica...');
        const isConnected = await binanceService.testConnectivity();
        console.log(`✅ Conectividade: ${isConnected ? 'OK' : 'FALHOU'}`);

        if (!isConnected) {
            throw new Error('Falha na conectividade básica');
        }

        // 2. Teste de tempo do servidor
        console.log('\n2. Testando sincronização de tempo...');
        const serverTime = await binanceService.getServerTime();
        const localTime = Date.now();
        const timeDiff = Math.abs(localTime - serverTime);
        
        console.log(`🕐 Tempo do servidor: ${new Date(serverTime).toISOString()}`);
        console.log(`🕐 Tempo local: ${new Date(localTime).toISOString()}`);
        console.log(`⏱️  Diferença: ${timeDiff}ms`);

        if (timeDiff > 5000) {
            console.log('⚠️  AVISO: Diferença de tempo > 5s pode causar problemas');
        }

        // 3. Teste de informações da exchange
        console.log('\n3. Testando informações da exchange...');
        const exchangeInfo = await binanceService.getExchangeInfo();
        console.log(`📊 Total de símbolos: ${exchangeInfo.symbols.length}`);
        
        // Mostrar alguns símbolos populares
        const popularSymbols = exchangeInfo.symbols
            .filter(s => ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'].includes(s.symbol))
            .map(s => ({
                symbol: s.symbol,
                status: s.status,
                baseAsset: s.baseAsset,
                quoteAsset: s.quoteAsset
            }));
        
        console.log('📈 Símbolos populares:');
        popularSymbols.forEach(s => {
            console.log(`   ${s.symbol}: ${s.status} (${s.baseAsset}/${s.quoteAsset})`);
        });

        // 4. Teste de preços
        console.log('\n4. Testando preços em tempo real...');
        const btcPrice = await binanceService.getSymbolPrice('BTCUSDT');
        const ethPrice = await binanceService.getSymbolPrice('ETHUSDT');
        const bnbPrice = await binanceService.getSymbolPrice('BNBUSDT');

        console.log(`₿  BTC/USDT: $${parseFloat(btcPrice.price).toLocaleString()}`);
        console.log(`⟠  ETH/USDT: $${parseFloat(ethPrice.price).toLocaleString()}`);
        console.log(`🔶 BNB/USDT: $${parseFloat(bnbPrice.price).toLocaleString()}`);

        // 5. Teste de estatísticas 24h
        console.log('\n5. Testando estatísticas 24h...');
        const btcStats = await binanceService.get24hrStats('BTCUSDT');
        
        console.log(`📊 BTC/USDT 24h:`);
        console.log(`   Preço: $${parseFloat(btcStats.lastPrice).toLocaleString()}`);
        console.log(`   Variação: ${parseFloat(btcStats.priceChangePercent).toFixed(2)}%`);
        console.log(`   Volume: ${parseFloat(btcStats.volume).toLocaleString()} BTC`);
        console.log(`   Máxima: $${parseFloat(btcStats.highPrice).toLocaleString()}`);
        console.log(`   Mínima: $${parseFloat(btcStats.lowPrice).toLocaleString()}`);

        // 6. Teste de conta (se as credenciais permitirem)
        console.log('\n6. Testando informações da conta...');
        try {
            const accountInfo = await binanceService.getAccountInfo();
            
            console.log(`👤 Conta:`);
            console.log(`   Pode negociar: ${accountInfo.canTrade ? 'SIM' : 'NÃO'}`);
            console.log(`   Pode sacar: ${accountInfo.canWithdraw ? 'SIM' : 'NÃO'}`);
            console.log(`   Pode depositar: ${accountInfo.canDeposit ? 'SIM' : 'NÃO'}`);
            
            // Mostrar saldos não-zero
            const nonZeroBalances = accountInfo.balances
                .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
                .slice(0, 10); // Limitar a 10 para não poluir
            
            if (nonZeroBalances.length > 0) {
                console.log(`💰 Saldos (top 10):`);
                nonZeroBalances.forEach(balance => {
                    const total = parseFloat(balance.free) + parseFloat(balance.locked);
                    if (total > 0) {
                        console.log(`   ${balance.asset}: ${total.toFixed(8)} (livre: ${balance.free}, bloqueado: ${balance.locked})`);
                    }
                });
            } else {
                console.log(`💰 Nenhum saldo encontrado (conta testnet vazia)`);
            }

        } catch (error: any) {
            console.log(`❌ Erro ao acessar conta: ${error.message}`);
            console.log(`ℹ️  Isso pode ser normal se as credenciais não tiverem permissão de leitura da conta`);
        }

        // 7. Teste de ordens abertas
        console.log('\n7. Testando ordens abertas...');
        try {
            const openOrders = await binanceService.getOpenOrders();
            console.log(`📋 Ordens abertas: ${openOrders.length}`);
            
            if (openOrders.length > 0) {
                openOrders.slice(0, 5).forEach((order: any) => {
                    console.log(`   ${order.symbol}: ${order.side} ${order.origQty} @ ${order.price} (${order.status})`);
                });
            }
        } catch (error: any) {
            console.log(`❌ Erro ao buscar ordens: ${error.message}`);
        }

        console.log('\n🎉 TESTE CONCLUÍDO COM SUCESSO!');
        console.log('✅ Conexão com Binance está funcionando');
        console.log('✅ Dados em tempo real disponíveis');
        console.log('✅ API está respondendo corretamente');

        return {
            success: true,
            connectivity: isConnected,
            timeDiff,
            symbolsCount: exchangeInfo.symbols.length,
            prices: {
                BTC: btcPrice.price,
                ETH: ethPrice.price,
                BNB: bnbPrice.price
            },
            stats: btcStats
        };

    } catch (error: any) {
        console.error('\n❌ ERRO NO TESTE:', error.message);
        console.error('Stack:', error.stack);
        
        return {
            success: false,
            error: error.message
        };
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    testBinanceConnection()
        .then(result => {
            if (result.success) {
                console.log('\n✅ Teste finalizado com sucesso');
                process.exit(0);
            } else {
                console.log('\n❌ Teste falhou');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Erro fatal:', error);
            process.exit(1);
        });
}

export { testBinanceConnection };