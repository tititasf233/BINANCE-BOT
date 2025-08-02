import { BacktestingService, BacktestRequest } from '../../services/BacktestingService';
import { BinanceApiService } from '../../services/BinanceApiService';
import { RSIStrategy } from '../../trading/strategies/RSIStrategy';

// Mock dependencies
jest.mock('../../services/BinanceApiService');
jest.mock('../../trading/strategies/RSIStrategy');

const MockBinanceApiService = BinanceApiService as jest.MockedClass<typeof BinanceApiService>;
const MockRSIStrategy = RSIStrategy as jest.MockedClass<typeof RSIStrategy>;

describe('BacktestingService', () => {
  let backtestingService: BacktestingService;

  beforeEach(() => {
    jest.clearAllMocks();
    backtestingService = new BacktestingService();
  });

  describe('validateBacktestRequest', () => {
    const validRequest: BacktestRequest = {
      strategyType: 'RSI',
      strategyParams: {
        symbol: 'BTCUSDT',
        interval: '1h',
        entryConditions: [],
        exitConditions: [],
        riskParams: {
          positionSizeUsd: 1000,
          takeProfitPercent: 3,
          stopLossPercent: 2,
          maxDrawdownPercent: 10,
          maxPositions: 1
        },
        indicatorParams: {}
      },
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-01-31'),
      initialBalance: 10000
    };

    it('should validate a correct backtest request', () => {
      const result = backtestingService.validateBacktestRequest(validRequest);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject request with missing strategy type', () => {
      const invalidRequest = { ...validRequest, strategyType: '' as any };
      const result = backtestingService.validateBacktestRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Strategy type is required');
    });

    it('should reject request with invalid date range', () => {
      const invalidRequest = {
        ...validRequest,
        startDate: new Date('2023-01-31'),
        endDate: new Date('2023-01-01')
      };
      const result = backtestingService.validateBacktestRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Start date must be before end date');
    });

    it('should reject request with future end date', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const invalidRequest = {
        ...validRequest,
        endDate: futureDate
      };
      const result = backtestingService.validateBacktestRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('End date cannot be in the future');
    });

    it('should reject request with invalid initial balance', () => {
      const invalidRequest = { ...validRequest, initialBalance: -1000 };
      const result = backtestingService.validateBacktestRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Initial balance must be greater than 0');
    });

    it('should reject request with date range exceeding 1 year', () => {
      const invalidRequest = {
        ...validRequest,
        startDate: new Date('2022-01-01'),
        endDate: new Date('2023-12-31')
      };
      const result = backtestingService.validateBacktestRequest(invalidRequest);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Date range cannot exceed 1 year');
    });
  });

  describe('runBacktest', () => {
    const backtestRequest: BacktestRequest = {
      strategyType: 'RSI',
      strategyParams: {
        symbol: 'BTCUSDT',
        interval: '1h',
        entryConditions: [],
        exitConditions: [],
        riskParams: {
          positionSizeUsd: 1000,
          takeProfitPercent: 3,
          stopLossPercent: 2,
          maxDrawdownPercent: 10,
          maxPositions: 1
        },
        indicatorParams: {
          rsi: {
            period: 14,
            overbought: 70,
            oversold: 30
          }
        }
      },
      startDate: new Date('2023-01-01'),
      endDate: new Date('2023-01-07'),
      initialBalance: 10000
    };

    it('should run backtest successfully with historical data', async () => {
      // Mock historical data
      const mockHistoricalData = [
        [1672531200000, '16500.00', '16600.00', '16400.00', '16550.00', '100.5', 1672534799999, '1660000.00', 1000, '50.25', '830000.00'],
        [1672534800000, '16550.00', '16650.00', '16500.00', '16600.00', '120.3', 1672538399999, '1992000.00', 1200, '60.15', '996000.00'],
        [1672538400000, '16600.00', '16700.00', '16550.00', '16650.00', '95.8', 1672541999999, '1595000.00', 950, '47.9', '797500.00']
      ];

      const mockBinanceInstance = {
        getKlines: jest.fn().mockResolvedValue(mockHistoricalData)
      };
      MockBinanceApiService.mockImplementation(() => mockBinanceInstance as any);

      // Mock strategy instance
      const mockStrategyInstance = {
        on: jest.fn(),
        onKline: jest.fn(),
        updatePosition: jest.fn()
      };
      MockRSIStrategy.mockImplementation(() => mockStrategyInstance as any);

      const result = await backtestingService.runBacktest(backtestRequest);

      expect(result.success).toBe(true);
      expect(result.startDate).toEqual(backtestRequest.startDate);
      expect(result.endDate).toEqual(backtestRequest.endDate);
      expect(result.initialBalance).toBe(backtestRequest.initialBalance);
      expect(result.trades).toBeDefined();
      expect(result.equityCurve).toBeDefined();
      expect(result.monthlyReturns).toBeDefined();
      expect(mockBinanceInstance.getKlines).toHaveBeenCalled();
      expect(MockRSIStrategy).toHaveBeenCalledWith(backtestRequest.strategyParams);
    });

    it('should handle case with no historical data', async () => {
      const mockBinanceInstance = {
        getKlines: jest.fn().mockResolvedValue([])
      };
      MockBinanceApiService.mockImplementation(() => mockBinanceInstance as any);

      const result = await backtestingService.runBacktest(backtestRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No historical data available for the specified period');
      expect(result.totalTrades).toBe(0);
      expect(result.finalBalance).toBe(backtestRequest.initialBalance);
    });

    it('should handle API errors gracefully', async () => {
      const mockBinanceInstance = {
        getKlines: jest.fn().mockRejectedValue(new Error('API Error'))
      };
      MockBinanceApiService.mockImplementation(() => mockBinanceInstance as any);

      const result = await backtestingService.runBacktest(backtestRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(result.totalTrades).toBe(0);
    });

    it('should handle unsupported strategy type', async () => {
      const invalidRequest = {
        ...backtestRequest,
        strategyType: 'UNKNOWN' as any
      };

      const result = await backtestingService.runBacktest(invalidRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported strategy type');
    });
  });

  describe('simulation with signals', () => {
    it('should process buy and sell signals correctly', async () => {
      const backtestRequest: BacktestRequest = {
        strategyType: 'RSI',
        strategyParams: {
          symbol: 'BTCUSDT',
          interval: '1h',
          entryConditions: [],
          exitConditions: [],
          riskParams: {
            positionSizeUsd: 1000,
            takeProfitPercent: 3,
            stopLossPercent: 2,
            maxDrawdownPercent: 10,
            maxPositions: 1
          },
          indicatorParams: {}
        },
        startDate: new Date('2023-01-01'),
        endDate: new Date('2023-01-02'),
        initialBalance: 10000
      };

      // Mock historical data with price movement
      const mockHistoricalData = [
        [1672531200000, '16500.00', '16600.00', '16400.00', '16550.00', '100.5', 1672534799999, '1660000.00', 1000, '50.25', '830000.00'],
        [1672534800000, '16550.00', '16650.00', '16500.00', '16600.00', '120.3', 1672538399999, '1992000.00', 1200, '60.15', '996000.00']
      ];

      const mockBinanceInstance = {
        getKlines: jest.fn().mockResolvedValue(mockHistoricalData)
      };
      MockBinanceApiService.mockImplementation(() => mockBinanceInstance as any);

      // Mock strategy that generates signals
      const mockStrategyInstance = {
        on: jest.fn((event, callback) => {
          if (event === 'signal_generated') {
            // Simulate buy signal on first kline
            setTimeout(() => {
              callback({
                signal: 'BUY',
                strength: 80,
                conditions: [],
                timestamp: 1672534799999
              });
            }, 0);
            
            // Simulate sell signal on second kline
            setTimeout(() => {
              callback({
                signal: 'SELL',
                strength: 75,
                conditions: [],
                timestamp: 1672538399999
              });
            }, 10);
          }
        }),
        onKline: jest.fn(),
        updatePosition: jest.fn()
      };
      MockRSIStrategy.mockImplementation(() => mockStrategyInstance as any);

      const result = await backtestingService.runBacktest(backtestRequest);

      expect(result.success).toBe(true);
      expect(mockStrategyInstance.onKline).toHaveBeenCalledTimes(2);
      expect(mockStrategyInstance.updatePosition).toHaveBeenCalled();
    });
  });

  describe('metrics calculation', () => {
    it('should calculate metrics correctly for profitable trades', () => {
      const trades = [
        {
          id: 1,
          entryTime: 1672531200000,
          exitTime: 1672534800000,
          entryPrice: 16500,
          exitPrice: 16650,
          quantity: 0.06,
          side: 'BUY' as const,
          status: 'CLOSED_TP' as const,
          pnl: 9, // (16650 - 16500) * 0.06 = 9
          fees: 1,
          entrySignal: { signal: 'BUY', strength: 80, conditions: [], timestamp: 1672531200000 }
        },
        {
          id: 2,
          entryTime: 1672538400000,
          exitTime: 1672542000000,
          entryPrice: 16600,
          exitPrice: 16500,
          quantity: 0.06,
          side: 'BUY' as const,
          status: 'CLOSED_SL' as const,
          pnl: -6, // (16500 - 16600) * 0.06 = -6
          fees: 1,
          entrySignal: { signal: 'BUY', strength: 70, conditions: [], timestamp: 1672538400000 }
        }
      ];

      const equityCurve = [
        { timestamp: 1672531200000, balance: 10000, drawdown: 0 },
        { timestamp: 1672534800000, balance: 10008, drawdown: 0 }, // +9 -1 fees
        { timestamp: 1672538400000, balance: 10008, drawdown: 0 },
        { timestamp: 1672542000000, balance: 10001, drawdown: 0 }  // -6 -1 fees
      ];

      // Access private method for testing
      const calculateMetrics = (backtestingService as any).calculateMetrics;
      const metrics = calculateMetrics.call(backtestingService, trades, equityCurve, 10000);

      expect(metrics.totalTrades).toBe(2);
      expect(metrics.winningTrades).toBe(1);
      expect(metrics.losingTrades).toBe(1);
      expect(metrics.winRate).toBe(50);
      expect(metrics.totalPnl).toBe(3); // 9 + (-6)
      expect(metrics.totalFees).toBe(2);
      expect(metrics.avgWin).toBe(9);
      expect(metrics.avgLoss).toBe(6);
      expect(metrics.profitFactor).toBe(1.5); // 9 / 6
    });
  });
});