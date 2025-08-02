import request from 'supertest';
import { app } from '../../app';
import { IntegrationTestSetup, cleanupBetweenTests } from './setup';
import { TestDataFactory } from './helpers/TestDataFactory';
import { BinanceMockServer } from './helpers/BinanceMockServer';
import { BacktestingService } from '../../services/BacktestingService';
import jwt from 'jsonwebtoken';

describe('Backtesting Integration Tests', () => {
  let testSetup: IntegrationTestSetup;
  let testDataFactory: TestDataFactory;
  let binanceMockServer: BinanceMockServer;
  let backtestingService: BacktestingService;
  let authToken: string;
  let testUser: any;
  let testStrategy: any;

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
    
    // Initialize backtesting service
    backtestingService = new BacktestingService(
      testSetup.getDbPool(),
      testSetup.getRedisClient()
    );
  });

  afterAll(async () => {
    await binanceMockServer.stop();
    await testSetup.teardown();
  });

  beforeEach(async () => {
    await cleanupBetweenTests();
    
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

  describe('Backtest Execution', () => {
    it('should execute a complete backtest with historical data', async () => {
      const backtestConfig = {
        strategyId: testStrategy.id,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        endDate: new Date().toISOString(),
        initialBalance: 10000,
      };

      const response = await request(app)
        .post(`/api/v1/strategies/${testStrategy.id}/backtest`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(backtestConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.backtestId).toBeDefined();

      // Wait for backtest to complete
      let backtestComplete = false;
      const maxWaitTime = 30000; // 30 seconds
      const checkInterval = 1000; // Check every second

      for (let waited = 0; waited < maxWaitTime && !backtestComplete; waited += checkInterval) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
        const statusResponse = await request(app)
          .get(`/api/v1/backtest/${response.body.backtestId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        if (statusResponse.body.status === 'completed') {
          backtestComplete = true;
        }
      }

      expect(backtestComplete).toBe(true);

      // Get backtest results
      const resultsResponse = await request(app)
        .get(`/api/v1/backtest/${response.body.backtestId}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const results = resultsResponse.body;
      expect(results.totalTrades).toBeGreaterThanOrEqual(0);
      expect(results.winRate).toBeGreaterThanOrEqual(0);
      expect(results.winRate).toBeLessThanOrEqual(1);
      expect(results.totalPnl).toBeDefined();
      expect(results.maxDrawdown).toBeDefined();
      expect(results.sharpeRatio).toBeDefined();
      expect(results.trades).toBeInstanceOf(Array);
    }, 45000);

    it('should handle different strategy configurations', async () => {
      // Create strategies with different parameters
      const strategies = [
        await testDataFactory.createTestStrategy(testUser.id, {
          name: 'RSI Strategy',
          entryConditions: [{ indicator: 'RSI', operator: '<', value: 30 }],
          exitConditions: [{ indicator: 'RSI', operator: '>', value: 70 }],
          riskParams: {
            positionSizeUsd: 1000,
            takeProfitPercent: 3.0,
            stopLossPercent: 1.5,
            maxDrawdownPercent: 10.0,
          },
        }),
        await testDataFactory.createTestStrategy(testUser.id, {
          name: 'MACD Strategy',
          entryConditions: [{ indicator: 'MACD', operator: '>', value: 0 }],
          exitConditions: [{ indicator: 'MACD', operator: '<', value: 0 }],
          riskParams: {
            positionSizeUsd: 500,
            takeProfitPercent: 2.0,
            stopLossPercent: 1.0,
            maxDrawdownPercent: 5.0,
          },
        }),
      ];

      const backtestPromises = strategies.map(async (strategy) => {
        const backtestConfig = {
          strategyId: strategy.id,
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          endDate: new Date().toISOString(),
          initialBalance: 10000,
        };

        const response = await request(app)
          .post(`/api/v1/strategies/${strategy.id}/backtest`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(backtestConfig)
          .expect(200);

        return response.body.backtestId;
      });

      const backtestIds = await Promise.all(backtestPromises);

      // Wait for all backtests to complete
      for (const backtestId of backtestIds) {
        let backtestComplete = false;
        const maxWaitTime = 30000;
        const checkInterval = 1000;

        for (let waited = 0; waited < maxWaitTime && !backtestComplete; waited += checkInterval) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          
          const statusResponse = await request(app)
            .get(`/api/v1/backtest/${backtestId}/status`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          if (statusResponse.body.status === 'completed') {
            backtestComplete = true;
          }
        }

        expect(backtestComplete).toBe(true);
      }

      // Verify all backtests completed successfully
      for (const backtestId of backtestIds) {
        const resultsResponse = await request(app)
          .get(`/api/v1/backtest/${backtestId}/results`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(resultsResponse.body.totalTrades).toBeGreaterThanOrEqual(0);
        expect(resultsResponse.body.winRate).toBeGreaterThanOrEqual(0);
      }
    }, 60000);

    it('should calculate accurate performance metrics', async () => {
      // Create a strategy with known expected behavior
      const predictableStrategy = await testDataFactory.createTestStrategy(testUser.id, {
        name: 'Predictable Strategy',
        entryConditions: [{ indicator: 'SMA', operator: '>', value: 0 }], // Always true
        exitConditions: [{ indicator: 'SMA', operator: '<', value: 999999 }], // Always false (hold)
        riskParams: {
          positionSizeUsd: 1000,
          takeProfitPercent: 5.0,
          stopLossPercent: 2.0,
          maxDrawdownPercent: 10.0,
        },
      });

      const backtestConfig = {
        strategyId: predictableStrategy.id,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        initialBalance: 10000,
      };

      const response = await request(app)
        .post(`/api/v1/strategies/${predictableStrategy.id}/backtest`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(backtestConfig)
        .expect(200);

      // Wait for completion
      let backtestComplete = false;
      const maxWaitTime = 30000;
      const checkInterval = 1000;

      for (let waited = 0; waited < maxWaitTime && !backtestComplete; waited += checkInterval) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
        const statusResponse = await request(app)
          .get(`/api/v1/backtest/${response.body.backtestId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        if (statusResponse.body.status === 'completed') {
          backtestComplete = true;
        }
      }

      expect(backtestComplete).toBe(true);

      const resultsResponse = await request(app)
        .get(`/api/v1/backtest/${response.body.backtestId}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const results = resultsResponse.body;

      // Validate metric calculations
      if (results.totalTrades > 0) {
        expect(results.winningTrades + results.losingTrades).toBe(results.totalTrades);
        expect(results.winRate).toBe(results.winningTrades / results.totalTrades);
        expect(results.maxDrawdown).toBeLessThanOrEqual(0); // Drawdown should be negative or zero
        
        // Verify individual trade data
        expect(results.trades).toBeInstanceOf(Array);
        results.trades.forEach((trade: any) => {
          expect(trade.entryPrice).toBeDefined();
          expect(trade.entryTime).toBeDefined();
          expect(['CLOSED_TP', 'CLOSED_SL', 'OPEN']).toContain(trade.status);
          
          if (trade.status !== 'OPEN') {
            expect(trade.exitPrice).toBeDefined();
            expect(trade.exitTime).toBeDefined();
            expect(trade.pnl).toBeDefined();
          }
        });
      }
    }, 45000);
  });

  describe('Backtest Performance and Optimization', () => {
    it('should handle large historical datasets efficiently', async () => {
      const backtestConfig = {
        strategyId: testStrategy.id,
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        endDate: new Date().toISOString(),
        initialBalance: 10000,
      };

      const startTime = Date.now();

      const response = await request(app)
        .post(`/api/v1/strategies/${testStrategy.id}/backtest`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(backtestConfig)
        .expect(200);

      // Wait for completion
      let backtestComplete = false;
      const maxWaitTime = 60000; // 60 seconds for large dataset
      const checkInterval = 2000;

      for (let waited = 0; waited < maxWaitTime && !backtestComplete; waited += checkInterval) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
        const statusResponse = await request(app)
          .get(`/api/v1/backtest/${response.body.backtestId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        if (statusResponse.body.status === 'completed') {
          backtestComplete = true;
        }
      }

      const executionTime = Date.now() - startTime;

      expect(backtestComplete).toBe(true);
      expect(executionTime).toBeLessThan(60000); // Should complete within 60 seconds

      // Verify results are still accurate
      const resultsResponse = await request(app)
        .get(`/api/v1/backtest/${response.body.backtestId}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(resultsResponse.body.totalTrades).toBeGreaterThanOrEqual(0);
    }, 75000);

    it('should handle concurrent backtests', async () => {
      const strategies = [];
      for (let i = 0; i < 3; i++) {
        strategies.push(
          await testDataFactory.createTestStrategy(testUser.id, {
            name: `Concurrent Strategy ${i + 1}`,
            symbol: i === 0 ? 'BTCUSDT' : i === 1 ? 'ETHUSDT' : 'ADAUSDT',
          })
        );
      }

      const backtestPromises = strategies.map(async (strategy) => {
        const backtestConfig = {
          strategyId: strategy.id,
          startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          initialBalance: 10000,
        };

        return request(app)
          .post(`/api/v1/strategies/${strategy.id}/backtest`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(backtestConfig)
          .expect(200);
      });

      const responses = await Promise.all(backtestPromises);
      const backtestIds = responses.map(r => r.body.backtestId);

      // Wait for all to complete
      const completionPromises = backtestIds.map(async (backtestId) => {
        let backtestComplete = false;
        const maxWaitTime = 45000;
        const checkInterval = 1000;

        for (let waited = 0; waited < maxWaitTime && !backtestComplete; waited += checkInterval) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          
          const statusResponse = await request(app)
            .get(`/api/v1/backtest/${backtestId}/status`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          if (statusResponse.body.status === 'completed') {
            backtestComplete = true;
          }
        }

        return backtestComplete;
      });

      const completionResults = await Promise.all(completionPromises);
      expect(completionResults.every(completed => completed)).toBe(true);

      // Verify all results
      for (const backtestId of backtestIds) {
        const resultsResponse = await request(app)
          .get(`/api/v1/backtest/${backtestId}/results`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(resultsResponse.body.totalTrades).toBeGreaterThanOrEqual(0);
      }
    }, 90000);
  });

  describe('Backtest Error Handling', () => {
    it('should handle invalid date ranges', async () => {
      const backtestConfig = {
        strategyId: testStrategy.id,
        startDate: new Date().toISOString(), // Start date is today
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // End date is yesterday
        initialBalance: 10000,
      };

      const response = await request(app)
        .post(`/api/v1/strategies/${testStrategy.id}/backtest`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(backtestConfig)
        .expect(400);

      expect(response.body.error).toContain('Invalid date range');
    });

    it('should handle insufficient historical data', async () => {
      const backtestConfig = {
        strategyId: testStrategy.id,
        startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year ago
        endDate: new Date(Date.now() - 364 * 24 * 60 * 60 * 1000).toISOString(), // 364 days ago
        initialBalance: 10000,
      };

      const response = await request(app)
        .post(`/api/v1/strategies/${testStrategy.id}/backtest`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(backtestConfig)
        .expect(200);

      // Wait for completion
      let backtestComplete = false;
      const maxWaitTime = 30000;
      const checkInterval = 1000;

      for (let waited = 0; waited < maxWaitTime && !backtestComplete; waited += checkInterval) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
        const statusResponse = await request(app)
          .get(`/api/v1/backtest/${response.body.backtestId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        if (statusResponse.body.status === 'completed' || statusResponse.body.status === 'failed') {
          backtestComplete = true;
        }
      }

      expect(backtestComplete).toBe(true);

      // Should complete but with limited or no trades
      const resultsResponse = await request(app)
        .get(`/api/v1/backtest/${response.body.backtestId}/results`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should handle gracefully even with no data
      expect(resultsResponse.body.totalTrades).toBeGreaterThanOrEqual(0);
    }, 45000);

    it('should handle strategy with invalid parameters', async () => {
      const invalidStrategy = await testDataFactory.createTestStrategy(testUser.id, {
        name: 'Invalid Strategy',
        entryConditions: [{ indicator: 'INVALID_INDICATOR', operator: '>', value: 50 }],
        exitConditions: [{ indicator: 'RSI', operator: '>', value: 70 }],
      });

      const backtestConfig = {
        strategyId: invalidStrategy.id,
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        initialBalance: 10000,
      };

      const response = await request(app)
        .post(`/api/v1/strategies/${invalidStrategy.id}/backtest`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(backtestConfig)
        .expect(200);

      // Wait for completion or failure
      let backtestComplete = false;
      let backtestStatus = '';
      const maxWaitTime = 30000;
      const checkInterval = 1000;

      for (let waited = 0; waited < maxWaitTime && !backtestComplete; waited += checkInterval) {
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
        const statusResponse = await request(app)
          .get(`/api/v1/backtest/${response.body.backtestId}/status`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        backtestStatus = statusResponse.body.status;
        if (backtestStatus === 'completed' || backtestStatus === 'failed') {
          backtestComplete = true;
        }
      }

      expect(backtestComplete).toBe(true);
      expect(backtestStatus).toBe('failed');
    }, 45000);
  });
});