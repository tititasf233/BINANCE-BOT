import request from 'supertest';
import { app } from '../../app';
import { IntegrationTestSetup, cleanupBetweenTests } from './setup';
import { TestDataFactory } from './helpers/TestDataFactory';
import { BinanceMockServer } from './helpers/BinanceMockServer';
import { MessageBrokerService } from '../../services/MessageBrokerService';
import { DataIngestorService } from '../../services/DataIngestorService';
import { StrategyEngineService } from '../../services/StrategyEngineService';
import jwt from 'jsonwebtoken';
import { performance } from 'perf_hooks';

describe('Performance and Latency Integration Tests', () => {
  let testSetup: IntegrationTestSetup;
  let testDataFactory: TestDataFactory;
  let binanceMockServer: BinanceMockServer;
  let messageBroker: MessageBrokerService;
  let dataIngestor: DataIngestorService;
  let strategyEngine: StrategyEngineService;
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

  describe('API Response Times', () => {
    it('should respond to authentication requests within acceptable time', async () => {
      const startTime = performance.now();
      
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        })
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(response.body.token).toBeDefined();
      expect(responseTime).toBeLessThan(500); // Should respond within 500ms
    });

    it('should respond to portfolio requests within acceptable time', async () => {
      const startTime = performance.now();
      
      await request(app)
        .get('/api/v1/portfolio/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle concurrent API requests efficiently', async () => {
      const concurrentRequests = 50;
      const startTime = performance.now();
      
      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app)
          .get('/api/v1/portfolio/overview')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
      );

      await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentRequests;

      expect(averageTime).toBeLessThan(2000); // Average response time should be under 2 seconds
      expect(totalTime).toBeLessThan(10000); // Total time should be under 10 seconds
    }, 15000);
  });

  describe('Market Data Processing Latency', () => {
    it('should process kline data with minimal latency', async () => {
      // Create and activate a strategy
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      await request(app)
        .post(`/api/v1/strategies/${strategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Measure time from data publication to order placement
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

      const startTime = performance.now();
      await messageBroker.publish('kline_closed', klineData);

      // Wait for order to be placed
      let orderPlaced = false;
      let processingTime = 0;
      const maxWaitTime = 5000;
      const checkInterval = 10;

      for (let waited = 0; waited < maxWaitTime && !orderPlaced; waited += checkInterval) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        const orders = binanceMockServer.getAllOrders();
        if (orders.length > 0) {
          processingTime = performance.now() - startTime;
          orderPlaced = true;
          break;
        }
      }

      expect(orderPlaced).toBe(true);
      expect(processingTime).toBeLessThan(500); // Should process within 500ms
    }, 10000);

    it('should handle high-frequency data without performance degradation', async () => {
      // Create multiple strategies
      const strategies = await Promise.all([
        testDataFactory.createTestStrategy(testUser.id, { symbol: 'BTCUSDT' }),
        testDataFactory.createTestStrategy(testUser.id, { symbol: 'ETHUSDT' }),
        testDataFactory.createTestStrategy(testUser.id, { symbol: 'ADAUSDT' }),
      ]);

      // Activate all strategies
      for (const strategy of strategies) {
        await request(app)
          .post(`/api/v1/strategies/${strategy.id}/activate`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      }

      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
      const dataPoints = 100;
      const startTime = performance.now();

      // Send high-frequency data
      const promises = [];
      for (let i = 0; i < dataPoints; i++) {
        for (const symbol of symbols) {
          const klineData = {
            symbol,
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
      }

      await Promise.all(promises);
      
      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const throughput = (dataPoints * symbols.length) / (totalTime / 1000); // messages per second

      expect(throughput).toBeGreaterThan(50); // Should process at least 50 messages per second

      // Verify system is still responsive
      const healthResponse = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
    }, 15000);
  });

  describe('Database Performance', () => {
    it('should handle large numbers of trades efficiently', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      const numberOfTrades = 1000;
      
      const startTime = performance.now();

      // Create many trades
      const tradePromises = Array.from({ length: numberOfTrades }, (_, i) =>
        testDataFactory.createTestTrade(strategy.id, {
          binanceOrderIdEntry: 1000000 + i,
          entryPrice: (45000 + i).toString(),
          status: i % 2 === 0 ? 'OPEN' : 'CLOSED_TP',
          pnl: i % 2 === 0 ? null : (Math.random() * 100 - 50).toFixed(2),
        })
      );

      await Promise.all(tradePromises);
      
      const insertTime = performance.now() - startTime;

      // Query the trades
      const queryStartTime = performance.now();
      
      const response = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: numberOfTrades })
        .expect(200);

      const queryTime = performance.now() - queryStartTime;

      expect(response.body.trades.length).toBe(numberOfTrades);
      expect(insertTime).toBeLessThan(10000); // Should insert within 10 seconds
      expect(queryTime).toBeLessThan(2000); // Should query within 2 seconds
    }, 20000);

    it('should handle complex portfolio calculations efficiently', async () => {
      // Create multiple strategies with trades
      const strategies = await Promise.all([
        testDataFactory.createTestStrategy(testUser.id, { symbol: 'BTCUSDT' }),
        testDataFactory.createTestStrategy(testUser.id, { symbol: 'ETHUSDT' }),
        testDataFactory.createTestStrategy(testUser.id, { symbol: 'ADAUSDT' }),
      ]);

      // Create trades for each strategy
      for (const strategy of strategies) {
        const tradePromises = Array.from({ length: 100 }, (_, i) =>
          testDataFactory.createTestTrade(strategy.id, {
            binanceOrderIdEntry: strategy.id * 100000 + i,
            status: 'CLOSED_TP',
            pnl: (Math.random() * 200 - 100).toFixed(2),
            entryTimestamp: new Date(Date.now() - i * 60000),
          })
        );
        await Promise.all(tradePromises);
      }

      const startTime = performance.now();

      // Request portfolio overview (should calculate aggregated metrics)
      const response = await request(app)
        .get('/api/v1/portfolio/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const calculationTime = performance.now() - startTime;

      expect(response.body.totalValue).toBeDefined();
      expect(response.body.totalPnl).toBeDefined();
      expect(response.body.totalTrades).toBe(300);
      expect(calculationTime).toBeLessThan(1000); // Should calculate within 1 second
    }, 15000);
  });

  describe('Memory and Resource Usage', () => {
    it('should not have memory leaks during extended operation', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create and activate multiple strategies
      const strategies = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          testDataFactory.createTestStrategy(testUser.id, {
            name: `Memory Test Strategy ${i}`,
            symbol: i % 2 === 0 ? 'BTCUSDT' : 'ETHUSDT',
          })
        )
      );

      for (const strategy of strategies) {
        await request(app)
          .post(`/api/v1/strategies/${strategy.id}/activate`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      }

      // Simulate extended operation with market data
      for (let cycle = 0; cycle < 50; cycle++) {
        const promises = strategies.map(strategy => {
          const klineData = {
            symbol: strategy.symbol,
            interval: '1h',
            openTime: Date.now() - 60000 + cycle * 1000,
            closeTime: Date.now() + cycle * 1000,
            open: (45000 + cycle).toString(),
            high: (45100 + cycle).toString(),
            low: (44900 + cycle).toString(),
            close: (45050 + cycle).toString(),
            volume: '10.5',
          };

          return messageBroker.publish('kline_closed', klineData);
        });

        await Promise.all(promises);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).toBeLessThan(50);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const afterGcMemory = process.memoryUsage();
        const afterGcIncrease = afterGcMemory.heapUsed - initialMemory.heapUsed;
        const afterGcIncreasePercent = (afterGcIncrease / initialMemory.heapUsed) * 100;
        
        // After GC, memory increase should be even smaller
        expect(afterGcIncreasePercent).toBeLessThan(30);
      }
    }, 30000);

    it('should handle connection pool limits gracefully', async () => {
      const concurrentRequests = 100;
      const startTime = performance.now();

      // Make many concurrent database requests
      const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
        const strategy = await testDataFactory.createTestStrategy(testUser.id, {
          name: `Concurrent Strategy ${i}`,
        });

        return request(app)
          .get(`/api/v1/strategies/${strategy.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results.length).toBe(concurrentRequests);
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds

      // Verify all requests succeeded
      results.forEach(result => {
        expect(result.body.id).toBeDefined();
        expect(result.body.name).toContain('Concurrent Strategy');
      });
    }, 20000);
  });

  describe('Load Testing', () => {
    it('should maintain performance under sustained load', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      await request(app)
        .post(`/api/v1/strategies/${strategy.id}/activate`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const loadTestDuration = 10000; // 10 seconds
      const requestInterval = 100; // Request every 100ms
      const startTime = performance.now();
      let requestCount = 0;
      let successCount = 0;
      let errorCount = 0;

      const loadTestPromise = new Promise<void>((resolve) => {
        const interval = setInterval(async () => {
          if (performance.now() - startTime >= loadTestDuration) {
            clearInterval(interval);
            resolve();
            return;
          }

          requestCount++;
          
          try {
            // Mix of different request types
            const requestType = requestCount % 4;
            
            switch (requestType) {
              case 0:
                await request(app)
                  .get('/api/v1/portfolio/overview')
                  .set('Authorization', `Bearer ${authToken}`)
                  .expect(200);
                break;
              case 1:
                await request(app)
                  .get('/api/v1/strategies')
                  .set('Authorization', `Bearer ${authToken}`)
                  .expect(200);
                break;
              case 2:
                await request(app)
                  .get('/api/v1/portfolio/history')
                  .set('Authorization', `Bearer ${authToken}`)
                  .query({ limit: 10 })
                  .expect(200);
                break;
              case 3:
                // Publish market data
                await messageBroker.publish('kline_closed', {
                  symbol: 'BTCUSDT',
                  interval: '1h',
                  openTime: Date.now() - 60000,
                  closeTime: Date.now(),
                  open: '45000.00',
                  high: '45100.00',
                  low: '44900.00',
                  close: '45050.00',
                  volume: '10.5',
                });
                break;
            }
            
            successCount++;
          } catch (error) {
            errorCount++;
          }
        }, requestInterval);
      });

      await loadTestPromise;
      
      const endTime = performance.now();
      const actualDuration = endTime - startTime;
      const requestsPerSecond = (successCount / actualDuration) * 1000;
      const errorRate = (errorCount / requestCount) * 100;

      expect(requestsPerSecond).toBeGreaterThan(5); // Should handle at least 5 requests per second
      expect(errorRate).toBeLessThan(5); // Error rate should be less than 5%

      // System should still be responsive after load test
      const healthResponse = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
    }, 15000);
  });
});