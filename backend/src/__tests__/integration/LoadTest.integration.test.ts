import request from 'supertest';
import { app } from '../../app';
import { IntegrationTestSetup, cleanupBetweenTests } from './setup';
import { TestDataFactory } from './helpers/TestDataFactory';
import { BinanceMockServer } from './helpers/BinanceMockServer';
import { MessageBrokerService } from '../../services/MessageBrokerService';
import jwt from 'jsonwebtoken';
import { performance } from 'perf_hooks';

describe('Load Testing Integration Tests', () => {
  let testSetup: IntegrationTestSetup;
  let testDataFactory: TestDataFactory;
  let binanceMockServer: BinanceMockServer;
  let messageBroker: MessageBrokerService;
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

  describe('High Volume Trading Simulation', () => {
    it('should handle 100 concurrent strategies processing market data', async () => {
      const numberOfStrategies = 100;
      const marketDataPoints = 50;
      
      console.log(`Creating ${numberOfStrategies} strategies...`);
      
      // Create many strategies
      const strategies = await Promise.all(
        Array.from({ length: numberOfStrategies }, (_, i) => 
          testDataFactory.createTestStrategy(testUser.id, {
            name: `Load Test Strategy ${i}`,
            symbol: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'][i % 3],
          })
        )
      );

      console.log('Activating strategies...');
      
      // Activate all strategies
      const activationPromises = strategies.map(strategy =>
        request(app)
          .post(`/api/v1/strategies/${strategy.id}/activate`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
      );

      await Promise.all(activationPromises);

      console.log('Starting market data simulation...');
      
      const startTime = performance.now();
      
      // Send market data for all symbols
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'];
      const dataPromises = [];

      for (let i = 0; i < marketDataPoints; i++) {
        for (const symbol of symbols) {
          const klineData = {
            symbol,
            interval: '1h',
            openTime: Date.now() - 60000 + i * 1000,
            closeTime: Date.now() + i * 1000,
            open: (45000 + i * 10).toString(),
            high: (45100 + i * 10).toString(),
            low: (44900 + i * 10).toString(),
            close: (45050 + i * 10).toString(),
            volume: '10.5',
          };

          dataPromises.push(messageBroker.publish('kline_closed', klineData));
        }
      }

      await Promise.all(dataPromises);
      
      // Wait for processing
      console.log('Waiting for processing to complete...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const totalDataPoints = marketDataPoints * symbols.length;
      const throughput = totalDataPoints / (totalTime / 1000);

      console.log(`Processed ${totalDataPoints} data points in ${totalTime.toFixed(2)}ms`);
      console.log(`Throughput: ${throughput.toFixed(2)} messages/second`);

      // Verify system is still responsive
      const healthResponse = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
      expect(throughput).toBeGreaterThan(10); // Should process at least 10 messages/second
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Check if orders were placed
      const orders = binanceMockServer.getAllOrders();
      console.log(`Total orders placed: ${orders.length}`);
      
      // Should have placed some orders (not necessarily all strategies will trigger)
      expect(orders.length).toBeGreaterThan(0);
    }, 60000);

    it('should handle massive historical data backtesting', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      
      console.log('Starting large dataset backtest...');
      
      const backtestConfig = {
        strategyId: strategy.id,
        startDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days
        endDate: new Date().toISOString(),
        initialBalance: 10000,
      };

      const startTime = performance.now();

      const response = await request(app)
        .post(`/api/v1/strategies/${strategy.id}/backtest`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(backtestConfig)
        .expect(200);

      // Wait for completion with progress monitoring
      let backtestComplete = false;
      let lastProgressTime = Date.now();
      const maxWaitTime = 120000; // 2 minutes
      const checkInterval = 5000; // Check every 5 seconds

      for (let waited = 0; waited < maxWaitTime && !backtestComplete; waited += checkInterval) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
        const statusResponse = await request(app)
          .get(`/api/v1/backtest/${response.body.backtestId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const currentTime = Date.now();
        const elapsedSinceStart = currentTime - startTime;
        
        console.log(`Backtest status: ${statusResponse.body.status} (${elapsedSinceStart.toFixed(0)}ms elapsed)`);

        if (statusResponse.body.status === 'completed') {
          backtestComplete = true;
        } else if (statusResponse.body.status === 'failed') {
          throw new Error('Backtest failed');
        }

        lastProgressTime = currentTime;
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(backtestComplete).toBe(true);
      expect(totalTime).toBeLessThan(120000); // Should complete within 2 minutes

      console.log(`Large backtest completed in ${totalTime.toFixed(2)}ms`);

      // Get results and verify
      const resultsResponse = await request(app)
        .get(`/api/v1/backtest/${response.body.backtestId}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const results = resultsResponse.body;
      expect(results.totalTrades).toBeGreaterThanOrEqual(0);
      expect(results.winRate).toBeGreaterThanOrEqual(0);
      expect(results.winRate).toBeLessThanOrEqual(1);

      console.log(`Backtest results: ${results.totalTrades} trades, ${(results.winRate * 100).toFixed(1)}% win rate`);
    }, 150000);
  });

  describe('Database Stress Testing', () => {
    it('should handle bulk trade insertions efficiently', async () => {
      const strategy = await testDataFactory.createTestStrategy(testUser.id);
      const numberOfTrades = 5000;
      
      console.log(`Creating ${numberOfTrades} trades...`);
      
      const startTime = performance.now();
      
      // Create trades in batches to avoid overwhelming the system
      const batchSize = 100;
      const batches = Math.ceil(numberOfTrades / batchSize);
      
      for (let batch = 0; batch < batches; batch++) {
        const batchStart = batch * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, numberOfTrades);
        const batchPromises = [];
        
        for (let i = batchStart; i < batchEnd; i++) {
          batchPromises.push(
            testDataFactory.createTestTrade(strategy.id, {
              binanceOrderIdEntry: 1000000 + i,
              entryPrice: (45000 + (i % 1000)).toString(),
              status: i % 3 === 0 ? 'OPEN' : i % 3 === 1 ? 'CLOSED_TP' : 'CLOSED_SL',
              pnl: i % 3 === 0 ? null : (Math.random() * 200 - 100).toFixed(2),
              entryTimestamp: new Date(Date.now() - i * 60000),
            })
          );
        }
        
        await Promise.all(batchPromises);
        
        if (batch % 10 === 0) {
          console.log(`Completed batch ${batch + 1}/${batches}`);
        }
      }
      
      const insertTime = performance.now() - startTime;
      const insertsPerSecond = numberOfTrades / (insertTime / 1000);
      
      console.log(`Inserted ${numberOfTrades} trades in ${insertTime.toFixed(2)}ms`);
      console.log(`Insert rate: ${insertsPerSecond.toFixed(2)} trades/second`);
      
      // Test querying the large dataset
      const queryStartTime = performance.now();
      
      const response = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 1000, offset: 0 })
        .expect(200);
      
      const queryTime = performance.now() - queryStartTime;
      
      console.log(`Queried 1000 trades in ${queryTime.toFixed(2)}ms`);
      
      expect(response.body.trades.length).toBe(1000);
      expect(insertTime).toBeLessThan(60000); // Should insert within 1 minute
      expect(queryTime).toBeLessThan(5000); // Should query within 5 seconds
      expect(insertsPerSecond).toBeGreaterThan(50); // Should insert at least 50 trades/second
    }, 120000);

    it('should handle complex portfolio calculations with large datasets', async () => {
      // Create multiple strategies with many trades each
      const numberOfStrategies = 10;
      const tradesPerStrategy = 500;
      
      console.log(`Creating ${numberOfStrategies} strategies with ${tradesPerStrategy} trades each...`);
      
      const strategies = await Promise.all(
        Array.from({ length: numberOfStrategies }, (_, i) =>
          testDataFactory.createTestStrategy(testUser.id, {
            name: `Portfolio Test Strategy ${i}`,
            symbol: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT'][i % 5],
          })
        )
      );

      // Create trades for each strategy
      for (const [strategyIndex, strategy] of strategies.entries()) {
        const tradePromises = Array.from({ length: tradesPerStrategy }, (_, i) => {
          const tradeIndex = strategyIndex * tradesPerStrategy + i;
          return testDataFactory.createTestTrade(strategy.id, {
            binanceOrderIdEntry: 2000000 + tradeIndex,
            status: 'CLOSED_TP',
            entryPrice: (45000 + (tradeIndex % 1000)).toString(),
            exitPrice: (45000 + (tradeIndex % 1000) + (Math.random() * 100 - 50)).toString(),
            pnl: (Math.random() * 200 - 100).toFixed(2),
            entryTimestamp: new Date(Date.now() - tradeIndex * 60000),
            exitTimestamp: new Date(Date.now() - tradeIndex * 60000 + 3600000),
          });
        });
        
        await Promise.all(tradePromises);
        console.log(`Completed strategy ${strategyIndex + 1}/${numberOfStrategies}`);
      }

      console.log('Testing portfolio calculations...');
      
      // Test portfolio overview calculation
      const startTime = performance.now();
      
      const response = await request(app)
        .get('/api/v1/portfolio/overview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const calculationTime = performance.now() - startTime;
      
      console.log(`Portfolio calculation completed in ${calculationTime.toFixed(2)}ms`);
      
      expect(response.body.totalValue).toBeDefined();
      expect(response.body.totalPnl).toBeDefined();
      expect(response.body.totalTrades).toBe(numberOfStrategies * tradesPerStrategy);
      expect(calculationTime).toBeLessThan(10000); // Should calculate within 10 seconds
      
      // Test paginated history queries
      const historyStartTime = performance.now();
      
      const historyResponse = await request(app)
        .get('/api/v1/portfolio/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 100, offset: 0 })
        .expect(200);
      
      const historyTime = performance.now() - historyStartTime;
      
      console.log(`History query completed in ${historyTime.toFixed(2)}ms`);
      
      expect(historyResponse.body.trades.length).toBe(100);
      expect(historyTime).toBeLessThan(3000); // Should query within 3 seconds
    }, 180000);
  });

  describe('Concurrent User Simulation', () => {
    it('should handle multiple users with concurrent operations', async () => {
      const numberOfUsers = 20;
      const operationsPerUser = 10;
      
      console.log(`Simulating ${numberOfUsers} concurrent users...`);
      
      // Create multiple users
      const users = await Promise.all(
        Array.from({ length: numberOfUsers }, (_, i) =>
          testDataFactory.createTestUser({
            username: `loadtest_user_${i}`,
            email: `loadtest_${i}@example.com`,
          })
        )
      );

      // Create API keys for each user
      await Promise.all(
        users.map(user => testDataFactory.createTestApiKey(user.id))
      );

      // Generate auth tokens
      const authTokens = users.map(user =>
        jwt.sign(
          { userId: user.id, username: user.username },
          process.env.JWT_SECRET || 'test-secret',
          { expiresIn: '1h' }
        )
      );

      // Create strategies for each user
      const userStrategies = await Promise.all(
        users.map((user, i) =>
          testDataFactory.createTestStrategy(user.id, {
            name: `User ${i} Strategy`,
            symbol: ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'][i % 3],
          })
        )
      );

      console.log('Starting concurrent operations...');
      
      const startTime = performance.now();
      
      // Simulate concurrent operations for each user
      const userOperations = users.map(async (user, userIndex) => {
        const token = authTokens[userIndex];
        const strategy = userStrategies[userIndex];
        const operations = [];
        
        for (let op = 0; op < operationsPerUser; op++) {
          const operationType = op % 4;
          
          switch (operationType) {
            case 0:
              // Get portfolio overview
              operations.push(
                request(app)
                  .get('/api/v1/portfolio/overview')
                  .set('Authorization', `Bearer ${token}`)
                  .expect(200)
              );
              break;
            case 1:
              // Get strategies
              operations.push(
                request(app)
                  .get('/api/v1/strategies')
                  .set('Authorization', `Bearer ${token}`)
                  .expect(200)
              );
              break;
            case 2:
              // Get trade history
              operations.push(
                request(app)
                  .get('/api/v1/portfolio/history')
                  .set('Authorization', `Bearer ${token}`)
                  .query({ limit: 10 })
                  .expect(200)
              );
              break;
            case 3:
              // Activate/deactivate strategy
              const action = op % 2 === 0 ? 'activate' : 'deactivate';
              operations.push(
                request(app)
                  .post(`/api/v1/strategies/${strategy.id}/${action}`)
                  .set('Authorization', `Bearer ${token}`)
                  .expect(200)
              );
              break;
          }
        }
        
        return Promise.all(operations);
      });

      const results = await Promise.all(userOperations);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const totalOperations = numberOfUsers * operationsPerUser;
      const operationsPerSecond = totalOperations / (totalTime / 1000);
      
      console.log(`Completed ${totalOperations} operations in ${totalTime.toFixed(2)}ms`);
      console.log(`Throughput: ${operationsPerSecond.toFixed(2)} operations/second`);
      
      // Verify all operations succeeded
      const totalResponses = results.flat().length;
      expect(totalResponses).toBe(totalOperations);
      expect(operationsPerSecond).toBeGreaterThan(5); // Should handle at least 5 ops/second
      expect(totalTime).toBeLessThan(60000); // Should complete within 1 minute
      
      // Verify system is still healthy
      const healthResponse = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(healthResponse.body.status).toBe('healthy');
    }, 90000);
  });

  describe('Memory and Resource Monitoring', () => {
    it('should maintain stable memory usage under sustained load', async () => {
      const initialMemory = process.memoryUsage();
      console.log('Initial memory usage:', {
        heapUsed: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        external: `${(initialMemory.external / 1024 / 1024).toFixed(2)} MB`,
      });

      // Create strategies
      const strategies = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          testDataFactory.createTestStrategy(testUser.id, {
            name: `Memory Test Strategy ${i}`,
            symbol: ['BTCUSDT', 'ETHUSDT'][i % 2],
          })
        )
      );

      // Activate strategies
      await Promise.all(
        strategies.map(strategy =>
          request(app)
            .post(`/api/v1/strategies/${strategy.id}/activate`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200)
        )
      );

      // Run sustained load for 30 seconds
      const loadDuration = 30000;
      const startTime = Date.now();
      let operationCount = 0;

      console.log('Starting sustained load test...');

      while (Date.now() - startTime < loadDuration) {
        // Send market data
        const promises = strategies.map((strategy, i) => {
          const klineData = {
            symbol: strategy.symbol,
            interval: '1h',
            openTime: Date.now() - 60000,
            closeTime: Date.now(),
            open: (45000 + operationCount + i).toString(),
            high: (45100 + operationCount + i).toString(),
            low: (44900 + operationCount + i).toString(),
            close: (45050 + operationCount + i).toString(),
            volume: '10.5',
          };

          return messageBroker.publish('kline_closed', klineData);
        });

        await Promise.all(promises);
        operationCount++;

        // Make some API calls
        if (operationCount % 5 === 0) {
          await request(app)
            .get('/api/v1/portfolio/overview')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      console.log(`Completed ${operationCount} operation cycles`);

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      const finalMemory = process.memoryUsage();
      console.log('Final memory usage:', {
        heapUsed: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        external: `${(finalMemory.external / 1024 / 1024).toFixed(2)} MB`,
      });

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.heapUsed) * 100;

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(1)}%)`);

      // Memory increase should be reasonable
      expect(memoryIncreasePercent).toBeLessThan(100); // Less than 100% increase
      expect(operationCount).toBeGreaterThan(200); // Should have completed many operations

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const afterGcMemory = process.memoryUsage();
        console.log('After GC memory usage:', {
          heapUsed: `${(afterGcMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
          heapTotal: `${(afterGcMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        });
        
        const afterGcIncrease = afterGcMemory.heapUsed - initialMemory.heapUsed;
        const afterGcIncreasePercent = (afterGcIncrease / initialMemory.heapUsed) * 100;
        
        console.log(`Memory increase after GC: ${afterGcIncreasePercent.toFixed(1)}%`);
        expect(afterGcIncreasePercent).toBeLessThan(50); // Should be much lower after GC
      }
    }, 45000);
  });
});