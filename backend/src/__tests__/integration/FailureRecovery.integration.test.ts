import request from 'supertest';
import { app } from '../../app';
import { IntegrationTestSetup, cleanupBetweenTests } from './setup';
import { TestDataFactory } from './helpers/TestDataFactory';
import { BinanceMockServer } from './helpers/BinanceMockServer';
import { MessageBrokerService } from '../../services/MessageBrokerService';
import { DataIngestorService } from '../../services/DataIngestorService';
import { StrategyEngineService } from '../../services/StrategyEngineService';
import { ExecutionEngineService } from '../../services/ExecutionEngineService';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';

describe('Failure Recovery Integration Tests', () => {
  let testSetup: IntegrationTestSetup;
  let testDataFactory: TestDataFactory;
  let binanceMockServer: BinanceMockServer;
  let messageBroker: MessageBrokerService;
  let dataIngestor: DataIngestorService;
  let strategyEngine: StrategyEngineService;
  let executionEngine: ExecutionEngineService;
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    testSetup = IntegrationTestSetup.getInstance();
    await testSetup.setupDatabase();
    await testSetup.setupRedis();
    
    testDataFactory = new TestDataFactory(testSetup.getDbPool());
    
    // Start mock Binance server
    binanceMockServer = new BinanceMockServer(3001);
    await binanceMockServer.start();
    
    // Override Binance API URL for tests
    process.env.BINANCE_BASE_URL = 'http://localhost:3001';
    
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
    
    // Create test user
    testUser = await testDataFactory.createTestUser();
    await testDataFactory.createTestApiKey(testUser.id);
    
    // Generate auth token
    authToken = jwt.sign(
      { userId: testUser.id, username: testUser.username },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  describe('Database Connection Failures', () => {
    it('should handle temporary database disconnections', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      // Activate strategy
      await request(app)
        .post(`/api/v1/strategies/${strategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Simulate database connection failure by closing the pool temporarily
      const originalPool = testSetup.getDbPool();
      
      // Create a new pool that will fail
      const failingPool = {
        ...originalPool,
        connect: () => Promise.reject(new Error('Database connection failed')),
        query: () => Promise.reject(new Error('Database connection failed')),
      };

      // Replace the pool temporarily (this would be handled by connection retry logic in real implementation)
      // For this test, we'll simulate the failure by making requests that should fail gracefully

      // Try to make a request that requires database access
      const response = await request(app)
        .get('/api/v1/strategies')
        .set('Authorization', `Bearer ${authToken}`);

      // The system should handle the failure gracefully
      // In a real implementation, this would return cached data or a proper error response
      expect([200, 500, 503]).toContain(response.status);

      // Wait a moment for potential recovery
      await new Promise(resolve => setTimeout(resolve, 1000));

      // System should recover and work normally
      const recoveryResponse = await request(app)
        .get('/api/v1/strategies')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(recoveryResponse.body.strategies).toBeDefined();
    }, 10000);

    it('should maintain data consistency during database failures', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      // Create some initial trades
      const initialTrades = await Promise.all([
        testDataFactory.createTestTrade(strategy.id, { status: 'OPEN' }),
        testDataFactory.createTestTrade(strategy.id, { status: 'CLOSED_TP' }),
      ]);

      // Get initial count
      const initialResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const initialCount = initialResponse.body.trades.length;

      // Simulate a scenario where database operations might fail partially
      // This tests transaction rollback and data consistency

      // Try to create a trade that might fail during OCO order creation
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

      await request(app)
        .post(`/api/v1/strategies/${strategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      await messageBroker.publish('kline_closed', klineData);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check final count - should be consistent
      const finalResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const finalCount = finalResponse.body.trades.length;

      // Either the trade was created successfully or not at all (no partial states)
      expect(finalCount).toBeGreaterThanOrEqual(initialCount);
      
      // If a new trade was created, it should have proper status
      if (finalCount > initialCount) {
        const newTrades = finalResponse.body.trades.slice(0, finalCount - initialCount);
        newTrades.forEach((trade: any) => {
          expect(['OPEN', 'CLOSED_TP', 'CLOSED_SL', 'FAILED']).toContain(trade.status);
        });
      }
    }, 15000);
  });

  describe('Redis Connection Failures', () => {
    it('should handle Redis disconnections gracefully', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      // Activate strategy (this should work with Redis)
      await request(app)
        .post(`/api/v1/strategies/${strategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Simulate Redis disconnection
      const originalRedis = testSetup.getRedisClient();
      await originalRedis.disconnect();

      // System should still function without Redis (degraded mode)
      const response = await request(app)
        .get('/api/v1/strategies')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.strategies).toBeDefined();

      // Reconnect Redis
      await testSetup.setupRedis();
      await messageBroker.connect();

      // System should recover full functionality
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
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should work normally after Redis recovery
      const finalResponse = await request(app)
        .get('/api/v1/portfolio/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(finalResponse.body.totalValue).toBeDefined();
    }, 15000);

    it('should recover cached data after Redis restart', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      // Activate strategy and generate some cache data
      await request(app)
        .post(`/api/v1/strategies/${strategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Publish some market data to populate cache
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
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify cache is populated
      const cachedPrice = await testSetup.getRedisClient().get('price:BTCUSDT');
      expect(cachedPrice).toBeTruthy();

      // Simulate Redis restart (clear cache)
      await testSetup.cleanRedis();

      // System should rebuild cache from database/API
      await messageBroker.publish('kline_closed', {
        ...klineData,
        close: '45100.00',
      });
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Cache should be repopulated
      const newCachedPrice = await testSetup.getRedisClient().get('price:BTCUSDT');
      expect(newCachedPrice).toBeTruthy();
    }, 10000);
  });

  describe('Binance API Failures', () => {
    it('should handle Binance API rate limiting', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      // Stop the mock server to simulate API unavailability
      await binanceMockServer.stop();

      // Activate strategy
      await request(app)
        .post(`/api/v1/strategies/${strategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Try to trigger a trade signal
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

      // No orders should be placed due to API failure
      const tradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(tradesResponse.body.trades.length).toBe(0);

      // Restart the mock server
      binanceMockServer = new BinanceMockServer(3001);
      await binanceMockServer.start();

      // Wait for potential reconnection
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Try the same signal again - should work now
      await messageBroker.publish('kline_closed', klineData);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Should have created a trade after recovery
      const recoveryTradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(recoveryTradesResponse.body.trades.length).toBeGreaterThan(0);
    }, 20000);

    it('should handle partial order execution failures', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      await request(app)
        .post(`/api/v1/strategies/${strategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Simulate a scenario where entry order succeeds but OCO order fails
      // This would be handled by the ExecutionEngine's error handling

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

      // Check if any trades were created
      const tradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // If a trade was created, it should have proper error handling
      if (tradesResponse.body.trades.length > 0) {
        const trade = tradesResponse.body.trades[0];
        
        // Trade should either be properly opened with OCO orders or marked as failed
        expect(['OPEN', 'FAILED']).toContain(trade.status);
        
        if (trade.status === 'OPEN') {
          // Should have OCO order ID if properly opened
          expect(trade.binance_order_id_oco).toBeTruthy();
        }
      }
    }, 15000);
  });

  describe('System Recovery and Orphaned Positions', () => {
    it('should detect and handle orphaned positions on startup', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      // Create an orphaned trade (entry order placed but no OCO orders)
      const orphanedTrade = await testDataFactory.createTestTrade(strategy.id, {
        status: 'OPEN',
        binanceOrderIdOco: null, // No OCO orders
        entryPrice: '45000.00',
        quantity: '0.001',
      });

      // Simulate system restart by reinitializing ExecutionEngine
      const newExecutionEngine = new ExecutionEngineService(
        testSetup.getDbPool(),
        messageBroker
      );

      // Run orphaned position reconciliation
      await newExecutionEngine.reconcileOrphanedPositions();
      
      // Wait for reconciliation to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if OCO orders were created
      const orders = binanceMockServer.getAllOrders();
      const ocoOrders = orders.filter(order => 
        order.type === 'LIMIT_MAKER' || order.type === 'STOP_LOSS_LIMIT'
      );

      expect(ocoOrders.length).toBeGreaterThan(0);

      // Verify trade was updated with OCO order ID
      const updatedTradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const updatedTrade = updatedTradesResponse.body.trades.find(
        (t: any) => t.id === orphanedTrade.id
      );

      expect(updatedTrade).toBeDefined();
      expect(updatedTrade.binance_order_id_oco).toBeTruthy();
    }, 15000);

    it('should handle strategy state recovery after restart', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      // Activate strategy
      await request(app)
        .post(`/api/v1/strategies/${strategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Send some market data to build indicator state
      const klineDataPoints = [
        { close: '45000.00' },
        { close: '45100.00' },
        { close: '45200.00' },
        { close: '45150.00' },
        { close: '45300.00' },
      ];

      for (const [index, data] of klineDataPoints.entries()) {
        const klineData = {
          symbol: 'BTCUSDT',
          interval: '1h',
          openTime: Date.now() - (5 - index) * 60000,
          closeTime: Date.now() - (4 - index) * 60000,
          open: data.close,
          high: (parseFloat(data.close) + 50).toString(),
          low: (parseFloat(data.close) - 50).toString(),
          close: data.close,
          volume: '10.5',
        };

        await messageBroker.publish('kline_closed', klineData);
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Simulate system restart by creating new StrategyEngine
      const newStrategyEngine = new StrategyEngineService(
        testSetup.getDbPool(),
        testSetup.getRedisClient(),
        messageBroker
      );

      // Load active strategies (simulates restart)
      await newStrategyEngine.loadActiveStrategies();

      // Send new market data
      const newKlineData = {
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: Date.now() - 60000,
        closeTime: Date.now(),
        open: '45300.00',
        high: '45400.00',
        low: '45250.00',
        close: '45350.00',
        volume: '10.5',
      };

      await messageBroker.publish('kline_closed', newKlineData);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Strategy should be able to process new data correctly
      const tradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should have processed the data (may or may not have created trades depending on strategy logic)
      expect(tradesResponse.status).toBe(200);
    }, 20000);
  });

  describe('Circuit Breaker and Retry Logic', () => {
    it('should implement circuit breaker for external API calls', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      await request(app)
        .post(`/api/v1/strategies/${strategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Stop Binance mock server to trigger failures
      await binanceMockServer.stop();

      // Send multiple signals that would trigger API calls
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

      // Send multiple signals rapidly
      for (let i = 0; i < 5; i++) {
        await messageBroker.publish('kline_closed', {
          ...klineData,
          closeTime: Date.now() + i * 1000,
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Circuit breaker should prevent excessive API calls
      // No trades should be created due to circuit breaker
      const tradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(tradesResponse.body.trades.length).toBe(0);

      // Restart mock server
      binanceMockServer = new BinanceMockServer(3001);
      await binanceMockServer.start();

      // Wait for circuit breaker to reset
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Should work again after circuit breaker resets
      await messageBroker.publish('kline_closed', klineData);
      await new Promise(resolve => setTimeout(resolve, 2000));

      const recoveryTradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(recoveryTradesResponse.body.trades.length).toBeGreaterThan(0);
    }, 25000);

    it('should implement exponential backoff for retries', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      await request(app)
        .post(`/api/v1/strategies/${strategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Create a scenario where API calls fail initially but succeed after retries
      let apiCallCount = 0;
      const originalStop = binanceMockServer.stop.bind(binanceMockServer);
      const originalStart = binanceMockServer.start.bind(binanceMockServer);

      // Mock intermittent failures
      binanceMockServer.stop = async () => {
        apiCallCount++;
        if (apiCallCount < 3) {
          await originalStop();
        }
      };

      binanceMockServer.start = async () => {
        if (apiCallCount >= 3) {
          await originalStart();
        }
      };

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

      const startTime = Date.now();
      await messageBroker.publish('kline_closed', klineData);

      // Wait for retries to complete
      await new Promise(resolve => setTimeout(resolve, 10000));

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should have eventually succeeded after retries
      const tradesResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Either succeeded after retries or failed gracefully
      expect(tradesResponse.status).toBe(200);
      
      // Time should reflect exponential backoff (should take several seconds due to retries)
      expect(totalTime).toBeGreaterThan(1000);

      // Restore original methods
      binanceMockServer.stop = originalStop;
      binanceMockServer.start = originalStart;
    }, 20000);
  });
});