import express from 'express';
import { BinanceService } from '../services/BinanceService';
import { logger } from '../utils/logger';

const router = express.Router();

// Instância global do serviço Binance (dados públicos não precisam de auth)
const binanceService = new BinanceService({
  apiKey: process.env.BINANCE_API_KEY || '',
  secretKey: process.env.BINANCE_SECRET_KEY || '',
  isTestnet: process.env.BINANCE_USE_TESTNET === 'true'
});

// Cache simples para evitar muitas chamadas à API
const cache = new Map();
const CACHE_TTL = 5000; // 5 segundos

const getCachedData = (key: string, fetchFn: () => Promise<any>) => {
  const cached = cache.get(key);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return Promise.resolve(cached.data);
  }
  
  return fetchFn().then(data => {
    cache.set(key, { data, timestamp: now });
    return data;
  });
};

// Obter preços de múltiplos símbolos
router.get('/prices', async (req, res) => {
  try {
    const symbols = (req.query.symbols as string)?.split(',') || [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT', 
      'XRPUSDT', 'DOTUSDT', 'LINKUSDT', 'LTCUSDT', 'BCHUSDT'
    ];

    const prices = await getCachedData('prices', async () => {
      const pricePromises = symbols.map(async (symbol) => {
        try {
          const price = await binanceService.getSymbolPrice(symbol);
          const stats = await binanceService.get24hrStats(symbol);
          
          return {
            symbol,
            price: parseFloat(price.price),
            change24h: parseFloat(stats.priceChangePercent),
            volume: parseFloat(stats.volume),
            high24h: parseFloat(stats.highPrice),
            low24h: parseFloat(stats.lowPrice),
            lastUpdate: new Date().toISOString()
          };
        } catch (error) {
          logger.error(`Error fetching data for ${symbol}:`, error as any);
          return null;
        }
      });

      const results = await Promise.all(pricePromises);
      return results.filter(result => result !== null);
    });

    res.json({
      success: true,
      data: prices,
      timestamp: new Date().toISOString(),
      source: 'binance_testnet'
    });

  } catch (error) {
    logger.error('Failed to fetch market prices:', error as any);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch market data'
    });
  }
});

// Obter dados detalhados de um símbolo específico
router.get('/symbol/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const symbolUpper = symbol.toUpperCase();

    const data = await getCachedData(`symbol_${symbolUpper}`, async () => {
      const [price, stats] = await Promise.all([
        binanceService.getSymbolPrice(symbolUpper),
        binanceService.get24hrStats(symbolUpper)
      ]);

      return {
        symbol: symbolUpper,
        price: parseFloat(price.price),
        change24h: parseFloat(stats.priceChangePercent),
        changeAmount: parseFloat(stats.priceChange),
        volume: parseFloat(stats.volume),
        quoteVolume: parseFloat(stats.quoteVolume),
        high24h: parseFloat(stats.highPrice),
        low24h: parseFloat(stats.lowPrice),
        openPrice: parseFloat(stats.openPrice),
        closePrice: parseFloat(stats.lastPrice),
        count: parseInt(stats.count),
        firstId: parseInt(stats.firstId),
        lastId: parseInt(stats.lastId),
        lastUpdate: new Date().toISOString()
      };
    });

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      source: 'binance_testnet'
    });

  } catch (error) {
    logger.error(`Failed to fetch symbol data for ${req.params.symbol}:`, error as any);
    res.status(500).json({
      success: false,
      error: `Failed to fetch data for symbol ${req.params.symbol}`
    });
  }
});

// Obter informações da exchange
router.get('/exchange-info', async (req, res) => {
  try {
    const data = await getCachedData('exchange_info', async () => {
      const exchangeInfo = await binanceService.getExchangeInfo();
      
      return {
        timezone: exchangeInfo.timezone,
        serverTime: exchangeInfo.serverTime,
        totalSymbols: exchangeInfo.symbols.length,
        activeSymbols: exchangeInfo.symbols.filter(s => s.status === 'TRADING').length,
        symbols: exchangeInfo.symbols
          .filter(s => s.status === 'TRADING')
          .slice(0, 100) // Limitar para não sobrecarregar
          .map(s => ({
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
            status: s.status
          }))
      };
    });

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      source: 'binance_testnet'
    });

  } catch (error) {
    logger.error('Failed to fetch exchange info:', error as any);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch exchange information'
    });
  }
});

// Teste de conectividade
router.get('/health', async (req, res) => {
  try {
    const [connectivity, serverTime] = await Promise.all([
      binanceService.testConnectivity(),
      binanceService.getServerTime()
    ]);

    const localTime = Date.now();
    const timeDiff = Math.abs(localTime - serverTime);

    res.json({
      success: true,
      data: {
        connected: connectivity,
        serverTime: new Date(serverTime).toISOString(),
        localTime: new Date(localTime).toISOString(),
        timeDifference: timeDiff,
        status: connectivity ? 'healthy' : 'unhealthy',
        mode: process.env.BINANCE_USE_TESTNET === 'true' ? 'testnet' : 'mainnet'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Market health check failed:', error as any);
    res.status(500).json({
      success: false,
      error: 'Market health check failed'
    });
  }
});

// Limpar cache (útil para desenvolvimento)
router.post('/clear-cache', (req, res) => {
  cache.clear();
  res.json({
    success: true,
    message: 'Cache cleared successfully'
  });
});

export default router;