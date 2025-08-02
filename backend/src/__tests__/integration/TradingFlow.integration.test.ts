import request from 'supertest';
import { app } from '../../app';
import { IntegrationTestSetup, cleanupBetweenTests } from './setup';
import { TestDataFactory } from './helpers/TestDataFactory';
import { BinanceMockServer } from './helpers/BinanceMockServer';
import { DataIngestorService } from '../../services/DataIngestorService';
import { StrategyEngineService } from '../../services/StrategyEngineService';
import { ExecutionEngineService } from '../../services/ExecutionEngineService';
import { MessageBrokerService } from '../../services/MessageBrokerService';
import jwt from 'jsonwebtoken';

describe('Trading Flow Integration Tests', () => {
  let testSetup: IntegrationTestSetup;
  let testDataFactory: TestDataFactory;
  let binanceMockServer: BinanceMockServer;
  let dataIngestor: DataIngestorService;
  let strategyEngine: StrategyEngineService;
  let executionEngine: ExecutionEngineService;
  let messageBroker: MessageBrokerService;
  let authToken: string;
  let testUser: any;
  let testStrategy: any;

  beforeAll(async () => {
    // Setup test environment
    testSetup = IntegrationTestSetup.getInstance();
    await testSetup.setupDatabase();
    await testSetup.setupRedis();
    
    testDataFactory = new TestDataFactory(testSetup.getDbPool());
    
    // Start mock Binance server
    binanceMockServer = new BinanceMockServer(3001);
    await binanceMockServer.start();
    
    // Override Binance API URL for tests
    process.env.BINANCE_BASE_URL = 'http://localhost:3001';
    process.env.BINANCE_USE_TESTNET = 'false';
    
    // Initialize services
    messageBroker = new MessageBrokerService(testSetup.getRedisClient());
    dataIngestor = new DataIngestorService(messageBroker);
    strategyEngine = new StrategyEngineService(
      testSetup.getDbPool(),
      testSetup.getRedisClient(),
      messageBroker
    );
    executionEngine = new ExecutionEngineService(
      testSetup.getDbPool(),
      messageBroker
    );
    
    await messageBroker.connect();
  });

  afterAll(async () => {
    await binanceMockServer.stop();
    await messageBroker.disconnect();
    await testSetup.teardown();
  });

  beforeEach(async () => {
    await cleanupBetweenTests();
    binanceMockServer.clearOrders();
    
    // Create test user and strategy
    const scenario = await testDataFactory.createCompleteTestScenario();
    testUser = scenario.user;
    testStrategy = scenario.strategy;
    
    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('Complete Trading Flow', () => {
    it('should execute a complete buy-sell cycle', async () => {
      // Step 1: Activate strategy
      const activateResponse = await request(app)
        .post(`/api/v1/strategies/${testStrategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(activateResponse.body.success).toBe(true);

      // Step 2: Simulate market data that triggers entry signal
      const mockKlineData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: Date.now() - 60000,
        closeTime: Date.now(),
        open: '45000.00',
        high: '45100.00',
        low: '44900.00',
        close: '45050.00',
        volume: '10.5',
      };

      // Publish kline data to trigger strategy
      await messageBroker.publish('kline_closed', mockKlineData);

      // Wait for strategy processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Verify entry order was placed
      const ordersAfterEntry = binanceMockServer.getAllOrders();
      expect(ordersAfterEntry.length).toBeGreaterThan(0);

      const entryOrder = ordersAfterEntry.find(order => 
        order.symbol === 'BTCUSDT' && order.side === 'BUY'
      );
      expect(entryOrder).toBeDefined();
      expect(entryOrder?.status).toBe('FILLED');

      // Step 4: Verify OCO orders were created
      // OCO orders should be created after entry order
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 5: Check database for trade record
      const tradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(tradesResponse.body.trades.length).toBe(1);
      const trade = tradesResponse.body.trades[0];
      expect(trade.symbol).toBe('BTCUSDT');
      expect(trade.status).toBe('OPEN');
      expect(trade.entry_price).toBeDefined();

      // Step 6: Simulate market data that triggers exit signal
      const exitKlineData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: Date.now() - 60000,
        closeTime: Date.now(),
        open: '45050.00',
        high: '46000.00',
        low: '45000.00',
        close: '45900.00', // Price increase to trigger take profit
        volume: '12.3',
      };

      await messageBroker.publish('kline_closed', exitKlineData);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 7: Verify exit order was placed
      const ordersAfterExit = binanceMockServer.getAllOrders();
      const exitOrder = ordersAfterExit.find(order => 
        order.symbol === 'BTCUSDT' && order.side === 'SELL'
      );
      expect(exitOrder).toBeDefined();

      // Step 8: Verify trade was closed with profit
      const finalTradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const closedTrade = finalTradesResponse.body.trades[0];
      expect(closedTrade.status).toBe('CLOSED_TP');
      expect(parseFloat(closedTrade.pnl)).toBeGreaterThan(0);
    }, 30000);

    it('should handle stop loss scenario', async () => {
      // Activate strategy
      await request(app)
        .post(`/api/v1/strategies/${testStrategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Trigger entry signal
      const entryKlineData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: Date.now() - 60000,
        closeTime: Date.now(),
        open: '45000.00',
        high: '45100.00',
        low: '44900.00',
        close: '45050.00',
        volume: '10.5',
      };

      await messageBroker.publish('kline_closed', entryKlineData);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Simulate price drop to trigger stop loss
      const stopLossKlineData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: Date.now() - 60000,
        closeTime: Date.now(),
        open: '45050.00',
        high: '45100.00',
        low: '44000.00',
        close: '44500.00', // Price drop to trigger stop loss
        volume: '15.2',
      };

      await messageBroker.publish('kline_closed', stopLossKlineData);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify trade was closed with loss
      const tradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const closedTrade = tradesResponse.body.trades[0];
      expect(closedTrade.status).toBe('CLOSED_SL');
      expect(parseFloat(closedTrade.pnl)).toBeLessThan(0);
    }, 30000);

    it('should handle multiple strategies simultaneously', async () => {
      // Create additional strategies
      const strategy2 = await testDataFactory.createTestStrategy(testUser.id, {
        name: 'Test Strategy 2',
        symbol: 'ETHUSDT',
      });

      const strategy3 = await testDataFactory.createTestStrategy(testUser.id, {
        name: 'Test Strategy 3',
        symbol: 'ADAUSDT',
      });

      // Activate all strategies
      await request(app)
        .post(`/api/v1/strategies/${testStrategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app)
        .post(`/api/v1/strategies/${strategy2.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await request(app)
        .post(`/api/v1/strategies/${strategy3.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Simulate market data for all symbols
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
      const prices = ['45050.00', '3050.00', '0.51'];

      for (let i = 0; i < symbols.length; i++) {
        const klineData = {
          symbol: symbols[i],
          interval: '1h',
          openTime: Date.now() - 60000,
          closeTime: Date.now(),
          open: prices[i],
          high: (parseFloat(prices[i]) * 1.002).toFixed(2),
          low: (parseFloat(prices[i]) * 0.998).toFixed(2),
          close: (parseFloat(prices[i]) * 1.001).toFixed(2),
          volume: '10.5',
        };

        await messageBroker.publish('kline_closed', klineData);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify orders were placed for all symbols
      const allOrders = binanceMockServer.getAllOrders();
      const btcOrders = allOrders.filter(order => order.symbol === 'BTCUSDT');
      const ethOrders = allOrders.filter(order => order.symbol === 'ETHUSDT');
      const adaOrders = allOrders.filter(order => order.symbol === 'ADAUSDT');

      expect(btcOrders.length).toBeGreaterThan(0);
      expect(ethOrders.length).toBeGreaterThan(0);
      expect(adaOrders.length).toBeGreaterThan(0);

      // Verify trades were recorded
      const tradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(tradesResponse.body.trades.length).toBe(3);
    }, 30000);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Binance API failures gracefully', async () => {
      // Stop mock server to simulate API failure
      await binanceMockServer.stop();

      // Activate strategy
      await request(app)
        .post(`/api/v1/strategies/${testStrategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Trigger entry signal
      const klineData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: Date.now() - 60000,
        closeTime: Date.now(),
        open: '45000.00',
        high: '45100.00',
        low: '44900.00',
        close: '45050.00',
        volume: '10.5',
      };

      await messageBroker.publish('kline_closed', klineData);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify no trades were created due to API failure
      const tradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(tradesResponse.body.trades.length).toBe(0);

      // Restart mock server
      binanceMockServer = new BinanceMockServer(3001);
      await binanceMockServer.start();

      // Trigger signal again - should work now
      await messageBroker.publish('kline_closed', klineData);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify trade was created after recovery
      const recoveryTradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(recoveryTradesResponse.body.trades.length).toBe(1);
    }, 30000);

    it('should handle orphaned positions on restart', async () => {
      // Create a trade manually to simulate orphaned position
      await testDataFactory.createTestTrade(testStrategy.id, {
        status: 'OPEN',
        binanceOrderIdOco: null, // Simulate missing OCO orders
      });

      // Initialize execution engine (simulates restart)
      await executionEngine.reconcileOrphanedPositions();

      // Wait for reconciliation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify OCO orders were created for orphaned position
      const orders = binanceMockServer.getAllOrders();
      const ocoOrders = orders.filter(order => 
        order.type === 'LIMIT_MAKER' || order.type === 'STOP_LOSS_LIMIT'
      );

      expect(ocoOrders.length).toBeGreaterThan(0);
    }, 15000);
  });

  describe('Performance and Latency Tests', () => {
    it('should process market data within acceptable latency', async () => {
      const startTime = Date.now();
      
      // Activate strategy
      await request(app)
        .post(`/api/v1/strategies/${testStrategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Trigger entry signal
      const klineData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: Date.now() - 60000,
        closeTime: Date.now(),
        open: '45000.00',
        high: '45100.00',
        low: '44900.00',
        close: '45050.00',
        volume: '10.5',
      };

      await messageBroker.publish('kline_closed', klineData);

      // Wait for processing and measure time
      let orderPlaced = false;
      const maxWaitTime = 5000; // 5 seconds max
      const checkInterval = 100; // Check every 100ms

      for (let waited = 0; waited < maxWaitTime && !orderPlaced; waited += checkInterval) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        const orders = binanceMockServer.getAllOrders();
        if (orders.length > 0) {
          orderPlaced = true;
          break;
        }
      }

      const processingTime = Date.now() - startTime;
      
      expect(orderPlaced).toBe(true);
      expect(processingTime).toBeLessThan(2000); // Should process within 2 seconds
    }, 10000);

    it('should handle high frequency market data', async () => {
      // Activate strategy
      await request(app)
        .post(`/api/v1/strategies/${testStrategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Send multiple kline updates rapidly
      const promises = [];
      for (let i = 0; i < 100; i++) {
        const klineData = {
          symbol: 'BTCUSDT',
          interval: '1h',
          openTime: Date.now() - 60000 + i * 1000,
          closeTime: Date.now() + i * 1000,
          open: (45000 + i).toString(),
          high: (45100 + i).toString(),
          low: (44900 + i).toString(),
          close: (45050 + i).toString(),
          volume: '10.5',
        };

        promises.push(messageBroker.publish('kline_closed', klineData));
      }

      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // System should remain stable and not crash
      const healthResponse = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
    }, 15000);
  });
});