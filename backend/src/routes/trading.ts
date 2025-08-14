import express from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { BinanceService } from '../services/BinanceService';
import { db } from '../database/connection';
import { logger } from '../utils/logger';

const router = express.Router();

// Middleware para verificar se o usuário tem API keys configuradas
const requireApiKeys = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  try {
    let apiKeys = await db.query(
      'SELECT api_key_encrypted, secret_key_encrypted, is_testnet FROM api_keys WHERE user_id = $1 AND is_active = true LIMIT 1',
      [req.user!.id]
    );

    // Se o usuário não tem API keys, criar automaticamente usando as do ambiente
    if (apiKeys.length === 0) {
      if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY) {
        logger.info('Creating API keys for user', { userId: req.user!.id, email: req.user!.email });
        
        await db.query(
          `INSERT INTO api_keys (user_id, name, api_key_encrypted, secret_key_encrypted, is_testnet, is_active)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [
            req.user!.id,
            'Auto-configured Binance',
            process.env.BINANCE_API_KEY,
            process.env.BINANCE_SECRET_KEY,
            (process.env.BINANCE_USE_TESTNET || 'false').toLowerCase() === 'true'
          ]
        );
        
        // Buscar as chaves recém-criadas
        apiKeys = await db.query(
          'SELECT api_key_encrypted, secret_key_encrypted, is_testnet FROM api_keys WHERE user_id = $1 AND is_active = true LIMIT 1',
          [req.user!.id]
        );
      } else {
        return res.status(400).json({
          success: false,
          error: 'No active API keys found. Please configure your Binance API keys first.'
        });
      }
    }

    // Use the actual API keys from the database
    req.binanceService = new BinanceService({
      apiKey: apiKeys[0].api_key_encrypted,
      secretKey: apiKeys[0].secret_key_encrypted,
      isTestnet: apiKeys[0].is_testnet
    });

    next();
  } catch (error) {
    logger.error('Failed to load API keys', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load API configuration'
    });
  }
};

// Estender o tipo AuthRequest para incluir binanceService
declare global {
  namespace Express {
    interface Request {
      binanceService?: BinanceService;
    }
  }
}

// Obter informações da exchange
router.get('/exchange-info', authenticateToken, requireApiKeys, async (req: AuthRequest, res) => {
  try {
    const exchangeInfo = await req.binanceService!.getExchangeInfo();
    
    res.json({
      success: true,
      data: {
        symbols: exchangeInfo.symbols.slice(0, 50), // Limitar para não sobrecarregar
        totalSymbols: exchangeInfo.symbols.length
      }
    });
  } catch (error) {
    logger.error('Failed to get exchange info', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get exchange information'
    });
  }
});

// Obter preço de um símbolo
router.get('/price/:symbol', authenticateToken, requireApiKeys, async (req: AuthRequest, res) => {
  try {
    const { symbol } = req.params;
    const price = await req.binanceService!.getSymbolPrice(symbol.toUpperCase());
    
    res.json({
      success: true,
      data: price
    });
  } catch (error) {
    logger.error('Failed to get symbol price', { symbol: req.params.symbol, error });
    res.status(500).json({
      success: false,
      error: 'Failed to get symbol price'
    });
  }
});

// Obter estatísticas de 24h
router.get('/stats/:symbol', authenticateToken, requireApiKeys, async (req: AuthRequest, res) => {
  try {
    const { symbol } = req.params;
    const stats = await req.binanceService!.get24hrStats(symbol.toUpperCase());
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get 24hr stats', { symbol: req.params.symbol, error });
    res.status(500).json({
      success: false,
      error: 'Failed to get 24hr statistics'
    });
  }
});

// Obter informações da conta
router.get('/account', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Verificar se há API keys reais configuradas
    let apiKeys = await db.query(
      'SELECT api_key_encrypted, secret_key_encrypted, is_testnet FROM api_keys WHERE user_id = $1 AND is_active = true LIMIT 1',
      [req.user!.id]
    );

    // Se o usuário não tem API keys, criar automaticamente usando as do ambiente
    if (apiKeys.length === 0) {
      if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY) {
        logger.info('Auto-creating API keys for account endpoint', { userId: req.user!.id });
        
        await db.query(
          `INSERT INTO api_keys (user_id, name, api_key_encrypted, secret_key_encrypted, is_testnet, is_active)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [
            req.user!.id,
            'Auto-configured Binance',
            process.env.BINANCE_API_KEY,
            process.env.BINANCE_SECRET_KEY,
            (process.env.BINANCE_USE_TESTNET || 'false').toLowerCase() === 'true'
          ]
        );
        
        apiKeys = await db.query(
          'SELECT api_key_encrypted, secret_key_encrypted, is_testnet FROM api_keys WHERE user_id = $1 AND is_active = true LIMIT 1',
          [req.user!.id]
        );
      } else {
        return res.status(400).json({
          success: false,
          error: 'No valid Binance API keys configured. Please add your real Binance API keys to access trading features.',
          requiresApiKeys: true
        });
      }
    }

    // Use the actual API keys from the database
    try {
      const binanceService = new BinanceService({
        apiKey: apiKeys[0].api_key_encrypted,
        secretKey: apiKeys[0].secret_key_encrypted,
        isTestnet: apiKeys[0].is_testnet
      });

      const accountInfo = await binanceService.getAccountInfo();
      
      // Filtrar apenas saldos com valor > 0
      const nonZeroBalances = accountInfo.balances.filter(
        balance => parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0
      );

      res.json({
        success: true,
        data: {
          ...accountInfo,
          balances: nonZeroBalances
        }
      });
    } catch (apiError) {
      logger.error('Binance API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Binance API unavailable. Please configure valid API keys or try again later.'
      });
    }
  } catch (error) {
    logger.error('Failed to get account info', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get account information'
    });
  }
});

// Testar ordem (sem executar)
router.post('/order/test', authenticateToken, requireApiKeys, async (req: AuthRequest, res) => {
  try {
    const { symbol, side, type, quantity, quoteOrderQty, price, stopPrice, timeInForce, newClientOrderId } = req.body;

    if (!symbol || !side || !type) {
      return res.status(400).json({
        success: false,
        error: 'Symbol, side, and type are required'
      });
    }

    const orderRequest: any = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase() as 'BUY' | 'SELL',
      type: type.toUpperCase(),
    };

    // Adicionar parâmetros condicionalmente
    if (quantity) orderRequest.quantity = quantity.toString();
    if (quoteOrderQty) orderRequest.quoteOrderQty = quoteOrderQty.toString();
    if (price) orderRequest.price = price.toString();
    if (stopPrice) orderRequest.stopPrice = stopPrice.toString();
    if (timeInForce) orderRequest.timeInForce = timeInForce;
    if (newClientOrderId) orderRequest.newClientOrderId = newClientOrderId;

    const testResult = await req.binanceService!.testOrder(orderRequest);

    res.json({
      success: true,
      data: testResult,
      message: 'Order test successful - order parameters are valid'
    });
  } catch (error) {
    logger.error('Failed to test order', { body: req.body, error });
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to test order'
    });
  }
});

// Criar ordem
router.post('/order', authenticateToken, requireApiKeys, async (req: AuthRequest, res) => {
  try {
    const { symbol, side, type, quantity, quoteOrderQty, price, stopPrice, timeInForce, newClientOrderId, icebergQty } = req.body;

    if (!symbol || !side || !type) {
      return res.status(400).json({
        success: false,
        error: 'Symbol, side, and type are required'
      });
    }

    const orderRequest: any = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase() as 'BUY' | 'SELL',
      type: type.toUpperCase(),
      newOrderRespType: 'FULL' // Para obter informações completas da ordem
    };

    // Adicionar parâmetros condicionalmente conforme documentação oficial
    if (quantity) orderRequest.quantity = quantity.toString();
    if (quoteOrderQty) orderRequest.quoteOrderQty = quoteOrderQty.toString();
    if (price) orderRequest.price = price.toString();
    if (stopPrice) orderRequest.stopPrice = stopPrice.toString();
    if (timeInForce) orderRequest.timeInForce = timeInForce;
    if (newClientOrderId) orderRequest.newClientOrderId = newClientOrderId;
    if (icebergQty) orderRequest.icebergQty = icebergQty.toString();

    const orderResponse = await req.binanceService!.createOrder(orderRequest);

    // Salvar trade no banco de dados com informações mais completas
    const totalCommission = orderResponse.fills?.reduce((sum: number, fill: any) => 
      sum + parseFloat(fill.commission || '0'), 0) || 0;
    
    const avgPrice = orderResponse.fills?.length > 0 
      ? orderResponse.fills.reduce((sum: number, fill: any) => 
          sum + (parseFloat(fill.price) * parseFloat(fill.qty)), 0) / parseFloat(orderResponse.executedQty)
      : parseFloat(orderResponse.price || '0');

    // Map Binance status to database status
    const mapStatus = (binanceStatus: string): string => {
      switch (binanceStatus) {
        case 'NEW': return 'PENDING';
        case 'FILLED': return 'FILLED';
        case 'PARTIALLY_FILLED': return 'PARTIALLY_FILLED';
        case 'CANCELED': return 'CANCELLED';
        case 'REJECTED': return 'REJECTED';
        default: return 'PENDING';
      }
    };

    await db.query(
      `INSERT INTO trades (user_id, symbol, side, order_type, quantity, price, executed_price, 
       executed_quantity, status, binance_order_id, commission, commission_asset, executed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        req.user!.id,
        orderResponse.symbol,
        orderResponse.side,
        orderResponse.type,
        orderResponse.origQty,
        orderResponse.price || null,
        avgPrice || null,
        orderResponse.executedQty,
        mapStatus(orderResponse.status),
        orderResponse.orderId.toString(),
        totalCommission || null,
        orderResponse.fills?.[0]?.commissionAsset || null,
        new Date(orderResponse.transactTime)
      ]
    );

    logger.info('Order created and saved successfully', {
      userId: req.user!.id,
      orderId: orderResponse.orderId,
      symbol: orderResponse.symbol,
      side: orderResponse.side,
      status: orderResponse.status
    });

    res.json({
      success: true,
      data: orderResponse
    });
  } catch (error) {
    logger.error('Failed to create order', { body: req.body, error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create order'
    });
  }
});

// Cancelar ordem
router.delete('/order/:symbol/:orderId', authenticateToken, requireApiKeys, async (req: AuthRequest, res) => {
  try {
    const { symbol, orderId } = req.params;
    const cancelResponse = await req.binanceService!.cancelOrder(
      symbol.toUpperCase(), 
      parseInt(orderId)
    );

    // Atualizar status no banco de dados
    await db.query(
      'UPDATE trades SET status = $1, updated_at = NOW() WHERE binance_order_id = $2 AND user_id = $3',
      ['CANCELLED', orderId, req.user!.id]
    );

    res.json({
      success: true,
      data: cancelResponse
    });
  } catch (error) {
    logger.error('Failed to cancel order', { symbol: req.params.symbol, orderId: req.params.orderId, error });
    res.status(500).json({
      success: false,
      error: 'Failed to cancel order'
    });
  }
});

// Obter ordens abertas
router.get('/orders/open', authenticateToken, async (req: AuthRequest, res) => {
  try {
    // Verificar se há API keys reais configuradas
    let apiKeys = await db.query(
      'SELECT api_key_encrypted, secret_key_encrypted, is_testnet FROM api_keys WHERE user_id = $1 AND is_active = true LIMIT 1',
      [req.user!.id]
    );

    // Se o usuário não tem API keys, criar automaticamente usando as do ambiente
    if (apiKeys.length === 0) {
      if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY) {
        logger.info('Auto-creating API keys for orders endpoint', { userId: req.user!.id });
        
        await db.query(
          `INSERT INTO api_keys (user_id, name, api_key_encrypted, secret_key_encrypted, is_testnet, is_active)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [
            req.user!.id,
            'Auto-configured Binance',
            process.env.BINANCE_API_KEY,
            process.env.BINANCE_SECRET_KEY,
            (process.env.BINANCE_USE_TESTNET || 'false').toLowerCase() === 'true'
          ]
        );
        
        apiKeys = await db.query(
          'SELECT api_key_encrypted, secret_key_encrypted, is_testnet FROM api_keys WHERE user_id = $1 AND is_active = true LIMIT 1',
          [req.user!.id]
        );
      } else {
        return res.status(400).json({
          success: false,
          error: 'No valid Binance API keys configured. Please add your real Binance API keys to access trading features.',
          requiresApiKeys: true
        });
      }
    }

    // Use the actual API keys from the database
    try {
      const binanceService = new BinanceService({
        apiKey: apiKeys[0].api_key_encrypted,
        secretKey: apiKeys[0].secret_key_encrypted,
        isTestnet: apiKeys[0].is_testnet
      });

      const { symbol } = req.query;
      const openOrders = await binanceService.getOpenOrders(symbol as string);
      
      res.json({
        success: true,
        data: openOrders
      });
    } catch (apiError) {
      logger.error('Binance API error:', apiError);
      res.status(503).json({
        success: false,
        error: 'Binance API unavailable. Please check your API keys or try again later.'
      });
    }
  } catch (error) {
    logger.error('Failed to get open orders', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get open orders'
    });
  }
});

// Obter histórico de trades do usuário
router.get('/trades/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { limit = 50, offset = 0, symbol } = req.query;
    
    let query = `
      SELECT t.*, ts.name as strategy_name 
      FROM trades t 
      LEFT JOIN trading_strategies ts ON t.strategy_id = ts.id 
      WHERE t.user_id = $1
    `;
    const params = [req.user!.id];

    if (symbol) {
      query += ` AND t.symbol = $${params.length + 1}`;
      params.push(symbol as string);
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit as string, offset as string);

    const trades = await db.query(query, params);

    res.json({
      success: true,
      data: trades
    });
  } catch (error) {
    logger.error('Failed to get trade history', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trade history'
    });
  }
});

// Configurar API Keys
router.post('/api-keys', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, apiKey, secretKey, isTestnet } = req.body;

    if (!name || !apiKey || !secretKey) {
      return res.status(400).json({
        success: false,
        error: 'Name, API key, and secret key are required'
      });
    }

    // Testar as chaves antes de salvar
    try {
      const testService = new BinanceService({
        apiKey,
        secretKey,
        isTestnet: Boolean(isTestnet)
      });

      await testService.testConnectivity();
      await testService.getAccountInfo();
    } catch (testError) {
      logger.error('API key test failed', testError);
      return res.status(400).json({
        success: false,
        error: 'Invalid API keys or insufficient permissions'
      });
    }

    // Desativar chaves antigas
    await db.query(
      'UPDATE api_keys SET is_active = false WHERE user_id = $1',
      [req.user!.id]
    );

    // Em produção, você deve criptografar as chaves
    // Por enquanto, vamos armazenar como texto simples para demonstração
    const result = await db.query(
      `INSERT INTO api_keys (user_id, name, api_key_encrypted, secret_key_encrypted, is_testnet, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, name, is_testnet, created_at`,
      [req.user!.id, name, apiKey, secretKey, Boolean(isTestnet)]
    );

    logger.info('API keys configured successfully', { 
      userId: req.user!.id, 
      isTestnet: Boolean(isTestnet) 
    });

    res.json({
      success: true,
      data: result[0]
    });
  } catch (error) {
    logger.error('Failed to configure API keys', error);
    res.status(500).json({
      success: false,
      error: 'Failed to configure API keys'
    });
  }
});

// Testar conectividade
router.get('/test-connection', authenticateToken, requireApiKeys, async (req: AuthRequest, res) => {
  try {
    const isConnected = await req.binanceService!.testConnectivity();
    const serverTime = await req.binanceService!.getServerTime();
    
    res.json({
      success: true,
      data: {
        connected: isConnected,
        serverTime,
        localTime: Date.now(),
        timeDiff: Date.now() - serverTime
      }
    });
  } catch (error) {
    logger.error('Connection test failed', error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed'
    });
  }
});

// Obter informações de um símbolo específico
router.get('/symbol/:symbol', authenticateToken, requireApiKeys, async (req: AuthRequest, res) => {
  try {
    const { symbol } = req.params;
    const symbolInfo = await req.binanceService!.getSymbolInfo(symbol.toUpperCase());
    
    if (!symbolInfo) {
      return res.status(404).json({
        success: false,
        error: 'Symbol not found'
      });
    }

    res.json({
      success: true,
      data: symbolInfo
    });
  } catch (error) {
    logger.error('Failed to get symbol info', { symbol: req.params.symbol, error });
    res.status(500).json({
      success: false,
      error: 'Failed to get symbol information'
    });
  }
});

// Obter book de ofertas
router.get('/orderbook/:symbol', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 100 } = req.query;
    
    // For public endpoints, we can use environment variables or create a service without auth
    const binanceService = new BinanceService({
      apiKey: process.env.BINANCE_API_KEY || 'test-api-key',
      secretKey: process.env.BINANCE_SECRET_KEY || 'test-secret-key',
      isTestnet: true
    });

    const orderBook = await binanceService.getOrderBook(symbol.toUpperCase(), parseInt(limit as string));
    
    res.json({
      success: true,
      data: orderBook
    });
  } catch (error) {
    logger.error('Failed to get order book', { symbol: req.params.symbol, error });
    res.status(500).json({
      success: false,
      error: 'Failed to get order book'
    });
  }
});

// Obter trades recentes de um símbolo
router.get('/trades/:symbol/recent', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 100 } = req.query;
    
    // For public endpoints, we can use environment variables or create a service without auth
    const binanceService = new BinanceService({
      apiKey: process.env.BINANCE_API_KEY || 'test-api-key',
      secretKey: process.env.BINANCE_SECRET_KEY || 'test-secret-key',
      isTestnet: true
    });

    const recentTrades = await binanceService.getRecentTrades(symbol.toUpperCase(), parseInt(limit as string));
    
    res.json({
      success: true,
      data: recentTrades
    });
  } catch (error) {
    logger.error('Failed to get recent trades', { symbol: req.params.symbol, error });
    res.status(500).json({
      success: false,
      error: 'Failed to get recent trades'
    });
  }
});

// Obter dados de kline/candlestick
router.get('/klines/:symbol', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1h', limit = 100, startTime, endTime } = req.query;
    
    // For public endpoints, we can use environment variables or create a service without auth
    const binanceService = new BinanceService({
      apiKey: process.env.BINANCE_API_KEY || 'test-api-key',
      secretKey: process.env.BINANCE_SECRET_KEY || 'test-secret-key',
      isTestnet: true
    });

    const klines = await binanceService.getKlines(
      symbol.toUpperCase(), 
      interval as string, 
      parseInt(limit as string),
      startTime ? parseInt(startTime as string) : undefined,
      endTime ? parseInt(endTime as string) : undefined
    );
    
    res.json({
      success: true,
      data: klines
    });
  } catch (error) {
    logger.error('Failed to get klines', { symbol: req.params.symbol, error });
    res.status(500).json({
      success: false,
      error: 'Failed to get klines'
    });
  }
});

// Obter meus trades de um símbolo específico
router.get('/trades/:symbol/my', authenticateToken, requireApiKeys, async (req: AuthRequest, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 100, fromId } = req.query;
    
    const myTrades = await req.binanceService!.getMyTrades(
      symbol.toUpperCase(),
      parseInt(limit as string),
      fromId ? parseInt(fromId as string) : undefined
    );
    
    res.json({
      success: true,
      data: myTrades
    });
  } catch (error) {
    logger.error('Failed to get my trades', { symbol: req.params.symbol, error });
    res.status(500).json({
      success: false,
      error: 'Failed to get my trades'
    });
  }
});

// Alternar entre modo real e demo
router.post('/toggle-mode', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { isTestnet } = req.body;
    
    if (typeof isTestnet !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isTestnet must be a boolean value'
      });
    }

    // Atualizar o modo na base de dados
    const result = await db.query(
      'UPDATE api_keys SET is_testnet = $1, updated_at = NOW() WHERE user_id = $2 AND is_active = true',
      [isTestnet, req.user!.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active API keys found'
      });
    }

    logger.info('Trading mode toggled', { 
      userId: req.user!.id, 
      isTestnet,
      mode: isTestnet ? 'Demo/Testnet' : 'Real/Mainnet'
    });

    res.json({
      success: true,
      data: {
        isTestnet,
        mode: isTestnet ? 'Demo/Testnet' : 'Real/Mainnet',
        message: `Switched to ${isTestnet ? 'Demo/Testnet' : 'Real/Mainnet'} mode`
      }
    });
  } catch (error) {
    logger.error('Failed to toggle trading mode', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle trading mode'
    });
  }
});

// Limpar mock storage globalmente (para testes de integração/ci)
router.post('/mock/clear', authenticateToken, async (req: AuthRequest, res) => {
  try {
    BinanceService.resetMockStorage();
    res.json({ success: true, message: 'Global mock storage reset' });
  } catch (error) {
    logger.error('Failed to reset global mock storage', error);
    res.status(500).json({ success: false, error: 'Failed to reset mock storage' });
  }
});

// Obter modo atual
router.get('/mode', authenticateToken, async (req: AuthRequest, res) => {
  try {
    let apiKeys = await db.query(
      'SELECT is_testnet FROM api_keys WHERE user_id = $1 AND is_active = true LIMIT 1',
      [req.user!.id]
    );

    // Se o usuário não tem API keys, criar automaticamente usando as do ambiente
    if (apiKeys.length === 0) {
      if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET_KEY) {
        logger.info('Auto-creating API keys for mode endpoint', { userId: req.user!.id });
        
        await db.query(
          `INSERT INTO api_keys (user_id, name, api_key_encrypted, secret_key_encrypted, is_testnet, is_active)
           VALUES ($1, $2, $3, $4, false, true)`,
          [req.user!.id, 'Auto-configured Binance', process.env.BINANCE_API_KEY, process.env.BINANCE_SECRET_KEY]
        );
        
        apiKeys = await db.query(
          'SELECT is_testnet FROM api_keys WHERE user_id = $1 AND is_active = true LIMIT 1',
          [req.user!.id]
        );
      } else {
        return res.status(404).json({
          success: false,
          error: 'No active API keys found'
        });
      }
    }

    const isTestnet = apiKeys[0].is_testnet;
    
    res.json({
      success: true,
      data: {
        isTestnet,
        mode: isTestnet ? 'Demo/Testnet' : 'Real/Mainnet'
      }
    });
  } catch (error) {
    logger.error('Failed to get trading mode', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get trading mode'
    });
  }
});

// Endpoint para limpar mock storage (apenas para testes) - independente de API keys
router.post('/clear-mock-storage', authenticateToken, async (req: AuthRequest, res) => {
  try {
    BinanceService.resetMockStorage();
    res.json({
      success: true,
      message: 'Mock storage cleared successfully'
    });
  } catch (error) {
    logger.error('Failed to clear mock storage', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear mock storage'
    });
  }
});

export default router;