import { BinanceApiService } from '../services/BinanceApiService';
import { logger } from '../utils/logger';

async function testBinanceConnection() {
  try {
    logger.info('🚀 Testando conexão com a API da Binance...');
    
    const binanceService = new BinanceApiService();
    
    // Test 1: Get server time
    logger.info('📡 Testando conectividade básica...');
    const serverTime = await binanceService.getServerTime();
    logger.info(`✅ Servidor Binance respondeu. Hora do servidor: ${new Date(serverTime).toISOString()}`);
    
    // Test 2: Get exchange info
    logger.info('📊 Obtendo informações da exchange...');
    const exchangeInfo = await binanceService.getExchangeInfo();
    logger.info(`✅ Exchange Info obtida. ${exchangeInfo.symbols.length} símbolos disponíveis`);
    
    // Test 3: Get account info (requires API key and secret)
    logger.info('🔐 Testando autenticação da conta...');
    try {
      const accountInfo = await binanceService.getAccountInfo();
      logger.info('✅ Autenticação bem-sucedida!');
      logger.info(`💰 Saldos da conta:`);
      
      // Show non-zero balances
      const nonZeroBalances = accountInfo.balances.filter(balance => 
        parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0
      );
      
      if (nonZeroBalances.length > 0) {
        nonZeroBalances.forEach(balance => {
          const free = parseFloat(balance.free);
          const locked = parseFloat(balance.locked);
          if (free > 0 || locked > 0) {
            logger.info(`   ${balance.asset}: ${free} (livre) + ${locked} (bloqueado) = ${free + locked}`);
          }
        });
      } else {
        logger.info('   Nenhum saldo encontrado na conta');
      }
      
      // Check trading permissions
      logger.info(`🔒 Permissões da conta:`);
      logger.info(`   Pode fazer spot trading: ${accountInfo.canTrade}`);
      logger.info(`   Pode sacar: ${accountInfo.canWithdraw}`);
      logger.info(`   Pode depositar: ${accountInfo.canDeposit}`);
      
    } catch (authError: any) {
      logger.error('❌ Falha na autenticação da conta');
      logger.error(`Erro: ${authError.message}`);
      
      if (authError.message.includes('Invalid API-key')) {
        logger.error('🔑 API Key inválida. Verifique se a chave está correta.');
      } else if (authError.message.includes('Signature')) {
        logger.error('🔐 Secret Key inválida ou problema na assinatura. Verifique a Secret Key.');
      } else if (authError.message.includes('IP')) {
        logger.error('🌐 Problema de IP. Verifique se seu IP está na whitelist da Binance.');
      }
      
      return false;
    }
    
    // Test 4: Get current prices for popular pairs
    logger.info('💹 Obtendo preços atuais...');
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    
    for (const symbol of symbols) {
      try {
        const ticker = await binanceService.getTickerPrice(symbol);
        logger.info(`   ${symbol}: $${parseFloat(ticker.price).toLocaleString()}`);
      } catch (priceError) {
        logger.warn(`   Não foi possível obter preço para ${symbol}`);
      }
    }
    
    // Test 5: Check if we can place orders (test mode)
    logger.info('🧪 Testando capacidade de criar ordens (modo teste)...');
    try {
      // This is a test order that won't be executed
      const testOrderResult = await binanceService.createTestOrder({
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        quantity: '0.001',
        price: '30000', // Very low price to ensure it won't execute
        timeInForce: 'GTC',
      });
      
      logger.info('✅ Teste de criação de ordem bem-sucedido!');
      logger.info('🎯 Sistema pode criar ordens reais quando necessário');
      
    } catch (orderError: any) {
      logger.error('❌ Falha no teste de criação de ordem');
      logger.error(`Erro: ${orderError.message}`);
      
      if (orderError.message.includes('trading is not enabled')) {
        logger.error('⚠️  Trading não está habilitado para esta API key');
        logger.error('💡 Vá para Binance > API Management > Habilite "Enable Spot & Margin Trading"');
      }
    }
    
    logger.info('');
    logger.info('🎉 Teste de conexão com Binance concluído!');
    logger.info('');
    
    return true;
    
  } catch (error: any) {
    logger.error('💥 Erro geral no teste de conexão:');
    logger.error(error.message);
    logger.error('');
    logger.error('🔧 Verifique:');
    logger.error('1. Se as variáveis BINANCE_API_KEY e BINANCE_SECRET_KEY estão configuradas');
    logger.error('2. Se a API key tem as permissões necessárias');
    logger.error('3. Se seu IP está na whitelist da Binance');
    logger.error('4. Se você está usando testnet (BINANCE_USE_TESTNET=true)');
    
    return false;
  }
}

// Execute the test if this file is run directly
if (require.main === module) {
  testBinanceConnection()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      logger.error('Erro fatal:', error);
      process.exit(1);
    });
}

export { testBinanceConnection };