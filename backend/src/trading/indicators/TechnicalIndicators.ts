/**
 * Technical Indicators Library
 * Implements common trading indicators used in algorithmic trading strategies
 */

export interface IndicatorResult {
  value: number;
  timestamp: number;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  timestamp: number;
}

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  timestamp: number;
}

export class TechnicalIndicators {
  /**
   * Simple Moving Average (SMA)
   */
  static calculateSMA(prices: number[], period: number): number | null {
    if (prices.length < period) {
      return null;
    }

    const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0);
    return sum / period;
  }

  /**
   * Exponential Moving Average (EMA)
   */
  static calculateEMA(prices: number[], period: number): number | null {
    if (prices.length < period) {
      return null;
    }

    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  /**
   * Relative Strength Index (RSI)
   */
  static calculateRSI(prices: number[], period: number = 14): number | null {
    if (prices.length < period + 1) {
      return null;
    }

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);

    const avgGain = this.calculateSMA(gains.slice(-period), period) || 0;
    const avgLoss = this.calculateSMA(losses.slice(-period), period) || 0;

    if (avgLoss === 0) {
      return 100;
    }

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Moving Average Convergence Divergence (MACD)
   */
  static calculateMACD(
    prices: number[], 
    fastPeriod: number = 12, 
    slowPeriod: number = 26, 
    _signalPeriod: number = 9 // TODO: Use signal period in calculation
  ): MACDResult | null {
    if (prices.length < slowPeriod) {
      return null;
    }

    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);

    if (fastEMA === null || slowEMA === null) {
      return null;
    }

    const macd = fastEMA - slowEMA;

    // For signal line, we need historical MACD values
    // This is a simplified version - in practice, you'd maintain MACD history
    const signal = macd; // Simplified - should be EMA of MACD values
    const histogram = macd - signal;

    return {
      macd,
      signal,
      histogram,
      timestamp: Date.now()
    };
  }

  /**
   * Bollinger Bands
   */
  static calculateBollingerBands(
    prices: number[], 
    period: number = 20, 
    standardDeviations: number = 2
  ): BollingerBandsResult | null {
    if (prices.length < period) {
      return null;
    }

    const sma = this.calculateSMA(prices, period);
    if (sma === null) {
      return null;
    }

    const recentPrices = prices.slice(-period);
    const variance = recentPrices.reduce((acc, price) => {
      return acc + Math.pow(price - sma, 2);
    }, 0) / period;

    const standardDeviation = Math.sqrt(variance);

    return {
      upper: sma + (standardDeviations * standardDeviation),
      middle: sma,
      lower: sma - (standardDeviations * standardDeviation),
      timestamp: Date.now()
    };
  }

  /**
   * Stochastic Oscillator
   */
  static calculateStochastic(
    highs: number[], 
    lows: number[], 
    closes: number[], 
    kPeriod: number = 14,
    _dPeriod: number = 3 // TODO: Use D period in calculation
  ): { k: number; d: number } | null {
    if (highs.length < kPeriod || lows.length < kPeriod || closes.length < kPeriod) {
      return null;
    }

    const recentHighs = highs.slice(-kPeriod);
    const recentLows = lows.slice(-kPeriod);
    const currentClose = closes[closes.length - 1];

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    if (highestHigh === lowestLow) {
      return { k: 50, d: 50 };
    }

    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    // For %D, we need historical %K values
    // This is simplified - should be SMA of %K values
    const d = k; // Simplified

    return { k, d };
  }

  /**
   * Average True Range (ATR)
   */
  static calculateATR(
    highs: number[], 
    lows: number[], 
    closes: number[], 
    period: number = 14
  ): number | null {
    if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
      return null;
    }

    const trueRanges: number[] = [];

    for (let i = 1; i < highs.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);

      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    return this.calculateSMA(trueRanges.slice(-period), period);
  }

  /**
   * Williams %R
   */
  static calculateWilliamsR(
    highs: number[], 
    lows: number[], 
    closes: number[], 
    period: number = 14
  ): number | null {
    if (highs.length < period || lows.length < period || closes.length < period) {
      return null;
    }

    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    if (highestHigh === lowestLow) {
      return -50;
    }

    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  }

  /**
   * Commodity Channel Index (CCI)
   */
  static calculateCCI(
    highs: number[], 
    lows: number[], 
    closes: number[], 
    period: number = 20
  ): number | null {
    if (highs.length < period || lows.length < period || closes.length < period) {
      return null;
    }

    // Calculate Typical Price
    const typicalPrices: number[] = [];
    for (let i = 0; i < highs.length; i++) {
      typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
    }

    const smaTP = this.calculateSMA(typicalPrices, period);
    if (smaTP === null) {
      return null;
    }

    const recentTP = typicalPrices.slice(-period);
    const meanDeviation = recentTP.reduce((acc, tp) => {
      return acc + Math.abs(tp - smaTP);
    }, 0) / period;

    const currentTP = typicalPrices[typicalPrices.length - 1];

    if (meanDeviation === 0) {
      return 0;
    }

    return (currentTP - smaTP) / (0.015 * meanDeviation);
  }

  /**
   * Money Flow Index (MFI)
   */
  static calculateMFI(
    highs: number[], 
    lows: number[], 
    closes: number[], 
    volumes: number[], 
    period: number = 14
  ): number | null {
    if (highs.length < period + 1 || volumes.length < period + 1) {
      return null;
    }

    const typicalPrices: number[] = [];
    const rawMoneyFlows: number[] = [];

    for (let i = 0; i < highs.length; i++) {
      const tp = (highs[i] + lows[i] + closes[i]) / 3;
      typicalPrices.push(tp);
      rawMoneyFlows.push(tp * volumes[i]);
    }

    let positiveFlow = 0;
    let negativeFlow = 0;

    for (let i = 1; i <= period; i++) {
      const index = typicalPrices.length - i;
      const prevIndex = index - 1;

      if (typicalPrices[index] > typicalPrices[prevIndex]) {
        positiveFlow += rawMoneyFlows[index];
      } else if (typicalPrices[index] < typicalPrices[prevIndex]) {
        negativeFlow += rawMoneyFlows[index];
      }
    }

    if (negativeFlow === 0) {
      return 100;
    }

    const moneyFlowRatio = positiveFlow / negativeFlow;
    return 100 - (100 / (1 + moneyFlowRatio));
  }

  /**
   * Parabolic SAR
   */
  static calculateParabolicSAR(
    highs: number[], 
    lows: number[], 
    acceleration: number = 0.02, 
    _maximum: number = 0.2 // TODO: Use maximum in calculation
  ): number | null {
    if (highs.length < 2 || lows.length < 2) {
      return null;
    }

    // This is a simplified version
    // Full implementation would require maintaining state across multiple periods
    const currentHigh = highs[highs.length - 1];
    const currentLow = lows[lows.length - 1];
    const prevHigh = highs[highs.length - 2];
    const prevLow = lows[lows.length - 2];

    // Simplified calculation - in practice, this needs more complex state management
    const isUptrend = currentHigh > prevHigh;
    
    if (isUptrend) {
      return Math.min(currentLow, prevLow) * (1 - acceleration);
    } else {
      return Math.max(currentHigh, prevHigh) * (1 + acceleration);
    }
  }

  /**
   * Volume Weighted Average Price (VWAP)
   */
  static calculateVWAP(
    highs: number[], 
    lows: number[], 
    closes: number[], 
    volumes: number[]
  ): number | null {
    if (highs.length === 0 || volumes.length === 0) {
      return null;
    }

    let totalVolumePrice = 0;
    let totalVolume = 0;

    for (let i = 0; i < highs.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      totalVolumePrice += typicalPrice * volumes[i];
      totalVolume += volumes[i];
    }

    if (totalVolume === 0) {
      return null;
    }

    return totalVolumePrice / totalVolume;
  }

  /**
   * On-Balance Volume (OBV)
   */
  static calculateOBV(closes: number[], volumes: number[]): number | null {
    if (closes.length < 2 || volumes.length < 2) {
      return null;
    }

    let obv = volumes[0];

    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv += volumes[i];
      } else if (closes[i] < closes[i - 1]) {
        obv -= volumes[i];
      }
      // If closes[i] === closes[i-1], OBV remains unchanged
    }

    return obv;
  }
}

export default TechnicalIndicators;