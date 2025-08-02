import { TechnicalIndicators } from '../../../trading/indicators/TechnicalIndicators';

describe('TechnicalIndicators', () => {
  describe('SMA (Simple Moving Average)', () => {
    it('should calculate SMA correctly', () => {
      const prices = [10, 12, 14, 16, 18, 20];
      const sma = TechnicalIndicators.calculateSMA(prices, 3);
      
      // Last 3 prices: 16, 18, 20 -> (16 + 18 + 20) / 3 = 18
      expect(sma).toBe(18);
    });

    it('should return null for insufficient data', () => {
      const prices = [10, 12];
      const sma = TechnicalIndicators.calculateSMA(prices, 3);
      
      expect(sma).toBeNull();
    });

    it('should handle single period', () => {
      const prices = [15];
      const sma = TechnicalIndicators.calculateSMA(prices, 1);
      
      expect(sma).toBe(15);
    });
  });

  describe('EMA (Exponential Moving Average)', () => {
    it('should calculate EMA correctly', () => {
      const prices = [10, 12, 14, 16, 18];
      const ema = TechnicalIndicators.calculateEMA(prices, 3);
      
      expect(ema).toBeDefined();
      expect(typeof ema).toBe('number');
      expect(ema).toBeGreaterThan(0);
    });

    it('should return null for insufficient data', () => {
      const prices = [10];
      const ema = TechnicalIndicators.calculateEMA(prices, 3);
      
      expect(ema).toBeNull();
    });

    it('should give more weight to recent prices', () => {
      const prices1 = [10, 10, 10, 10, 20]; // Recent spike
      const prices2 = [10, 10, 10, 10, 10]; // Stable
      
      const ema1 = TechnicalIndicators.calculateEMA(prices1, 3);
      const ema2 = TechnicalIndicators.calculateEMA(prices2, 3);
      
      expect(ema1).toBeGreaterThan(ema2);
    });
  });

  describe('RSI (Relative Strength Index)', () => {
    it('should calculate RSI correctly', () => {
      // Create a price series with clear upward trend
      const prices = [
        44, 44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.85, 47.25, 47.92,
        46.23, 46.08, 46.03, 46.83, 47.69, 47.54, 49.25, 49.23, 48.2, 47.8
      ];
      
      const rsi = TechnicalIndicators.calculateRSI(prices, 14);
      
      expect(rsi).toBeDefined();
      expect(rsi).toBeGreaterThan(0);
      expect(rsi).toBeLessThan(100);
    });

    it('should return null for insufficient data', () => {
      const prices = [10, 12, 14];
      const rsi = TechnicalIndicators.calculateRSI(prices, 14);
      
      expect(rsi).toBeNull();
    });

    it('should return 100 for all gains', () => {
      const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
      const rsi = TechnicalIndicators.calculateRSI(prices, 14);
      
      expect(rsi).toBe(100);
    });
  });

  describe('MACD', () => {
    it('should calculate MACD correctly', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.1) * 10);
      const macd = TechnicalIndicators.calculateMACD(prices, 12, 26, 9);
      
      expect(macd).toBeDefined();
      expect(macd).toHaveProperty('macd');
      expect(macd).toHaveProperty('signal');
      expect(macd).toHaveProperty('histogram');
      expect(macd).toHaveProperty('timestamp');
    });

    it('should return null for insufficient data', () => {
      const prices = [10, 12, 14];
      const macd = TechnicalIndicators.calculateMACD(prices, 12, 26, 9);
      
      expect(macd).toBeNull();
    });
  });

  describe('Bollinger Bands', () => {
    it('should calculate Bollinger Bands correctly', () => {
      const prices = [20, 21, 22, 21, 20, 19, 20, 21, 22, 23, 22, 21, 20, 19, 18, 19, 20, 21, 22, 23];
      const bb = TechnicalIndicators.calculateBollingerBands(prices, 20, 2);
      
      expect(bb).toBeDefined();
      expect(bb).toHaveProperty('upper');
      expect(bb).toHaveProperty('middle');
      expect(bb).toHaveProperty('lower');
      expect(bb!.upper).toBeGreaterThan(bb!.middle);
      expect(bb!.middle).toBeGreaterThan(bb!.lower);
    });

    it('should return null for insufficient data', () => {
      const prices = [10, 12, 14];
      const bb = TechnicalIndicators.calculateBollingerBands(prices, 20, 2);
      
      expect(bb).toBeNull();
    });
  });

  describe('Stochastic Oscillator', () => {
    it('should calculate Stochastic correctly', () => {
      const highs = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
      const lows = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
      const closes = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
      
      const stoch = TechnicalIndicators.calculateStochastic(highs, lows, closes, 14, 3);
      
      expect(stoch).toBeDefined();
      expect(stoch).toHaveProperty('k');
      expect(stoch).toHaveProperty('d');
      expect(stoch!.k).toBeGreaterThanOrEqual(0);
      expect(stoch!.k).toBeLessThanOrEqual(100);
    });

    it('should return null for insufficient data', () => {
      const highs = [15, 16];
      const lows = [10, 11];
      const closes = [12, 13];
      
      const stoch = TechnicalIndicators.calculateStochastic(highs, lows, closes, 14, 3);
      
      expect(stoch).toBeNull();
    });

    it('should handle equal high and low', () => {
      const highs = Array(15).fill(20);
      const lows = Array(15).fill(20);
      const closes = Array(15).fill(20);
      
      const stoch = TechnicalIndicators.calculateStochastic(highs, lows, closes, 14, 3);
      
      expect(stoch).toEqual({ k: 50, d: 50 });
    });
  });

  describe('ATR (Average True Range)', () => {
    it('should calculate ATR correctly', () => {
      const highs = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
      const lows = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
      const closes = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
      
      const atr = TechnicalIndicators.calculateATR(highs, lows, closes, 14);
      
      expect(atr).toBeDefined();
      expect(atr).toBeGreaterThan(0);
    });

    it('should return null for insufficient data', () => {
      const highs = [15, 16];
      const lows = [10, 11];
      const closes = [12, 13];
      
      const atr = TechnicalIndicators.calculateATR(highs, lows, closes, 14);
      
      expect(atr).toBeNull();
    });
  });

  describe('Williams %R', () => {
    it('should calculate Williams %R correctly', () => {
      const highs = [15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29];
      const lows = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];
      const closes = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26];
      
      const williamsR = TechnicalIndicators.calculateWilliamsR(highs, lows, closes, 14);
      
      expect(williamsR).toBeDefined();
      expect(williamsR).toBeGreaterThanOrEqual(-100);
      expect(williamsR).toBeLessThanOrEqual(0);
    });

    it('should return null for insufficient data', () => {
      const highs = [15, 16];
      const lows = [10, 11];
      const closes = [12, 13];
      
      const williamsR = TechnicalIndicators.calculateWilliamsR(highs, lows, closes, 14);
      
      expect(williamsR).toBeNull();
    });
  });

  describe('VWAP (Volume Weighted Average Price)', () => {
    it('should calculate VWAP correctly', () => {
      const highs = [15, 16, 17];
      const lows = [10, 11, 12];
      const closes = [12, 13, 14];
      const volumes = [1000, 1500, 2000];
      
      const vwap = TechnicalIndicators.calculateVWAP(highs, lows, closes, volumes);
      
      expect(vwap).toBeDefined();
      expect(vwap).toBeGreaterThan(0);
    });

    it('should return null for empty data', () => {
      const vwap = TechnicalIndicators.calculateVWAP([], [], [], []);
      
      expect(vwap).toBeNull();
    });

    it('should return null for zero volume', () => {
      const highs = [15];
      const lows = [10];
      const closes = [12];
      const volumes = [0];
      
      const vwap = TechnicalIndicators.calculateVWAP(highs, lows, closes, volumes);
      
      expect(vwap).toBeNull();
    });
  });

  describe('OBV (On-Balance Volume)', () => {
    it('should calculate OBV correctly', () => {
      const closes = [10, 11, 10, 12, 11];
      const volumes = [1000, 1500, 1200, 1800, 1300];
      
      const obv = TechnicalIndicators.calculateOBV(closes, volumes);
      
      expect(obv).toBeDefined();
      expect(typeof obv).toBe('number');
    });

    it('should return null for insufficient data', () => {
      const closes = [10];
      const volumes = [1000];
      
      const obv = TechnicalIndicators.calculateOBV(closes, volumes);
      
      expect(obv).toBeNull();
    });

    it('should increase OBV on price increase', () => {
      const closes = [10, 11]; // Price increases
      const volumes = [1000, 1000];
      
      const obv = TechnicalIndicators.calculateOBV(closes, volumes);
      
      expect(obv).toBe(2000); // Initial volume + added volume
    });

    it('should decrease OBV on price decrease', () => {
      const closes = [11, 10]; // Price decreases
      const volumes = [1000, 1000];
      
      const obv = TechnicalIndicators.calculateOBV(closes, volumes);
      
      expect(obv).toBe(0); // Initial volume - subtracted volume
    });
  });
});