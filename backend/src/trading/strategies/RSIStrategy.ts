import { BaseStrategy, StrategyParams, SignalResult } from './BaseStrategy';
import { logger } from '@/utils/logger';

/**
 * RSI Strategy Implementation
 * 
 * Entry Conditions:
 * - RSI crosses below oversold level (default 30) for BUY signal
 * - RSI crosses above overbought level (default 70) for SELL signal
 * 
 * Exit Conditions:
 * - RSI crosses back to neutral zone (30-70)
 * - Stop loss or take profit hit
 */
export class RSIStrategy extends BaseStrategy {
  private readonly oversoldLevel: number;
  private readonly overboughtLevel: number;
  private readonly rsiPeriod: number;

  constructor(params: StrategyParams) {
    super(params);
    
    // Extract RSI-specific parameters
    this.rsiPeriod = params.indicatorParams.rsi?.period || 14;
    this.oversoldLevel = params.indicatorParams.rsi?.oversold || 30;
    this.overboughtLevel = params.indicatorParams.rsi?.overbought || 70;

    // Ensure RSI indicator is configured
    if (!params.indicatorParams.rsi) {
      params.indicatorParams.rsi = {
        period: this.rsiPeriod,
        overbought: this.overboughtLevel,
        oversold: this.oversoldLevel
      };
    }

    logger.info('RSI Strategy initialized', {
      symbol: params.symbol,
      interval: params.interval,
      rsiPeriod: this.rsiPeriod,
      oversoldLevel: this.oversoldLevel,
      overboughtLevel: this.overboughtLevel
    });
  }

  getName(): string {
    return 'RSI Strategy';
  }

  getDescription(): string {
    return `RSI-based mean reversion strategy with ${this.rsiPeriod}-period RSI. ` +
           `Buys when RSI < ${this.oversoldLevel}, sells when RSI > ${this.overboughtLevel}.`;
  }

  /**
   * Override signal checking to implement RSI-specific logic
   */
  protected async checkSignals(): Promise<SignalResult> {
    const rsiValues = this.state.indicators.get('rsi');
    
    if (!rsiValues || rsiValues.length < 2) {
      return {
        signal: 'HOLD',
        strength: 0,
        conditions: [],
        timestamp: Date.now()
      };
    }

    const currentRSI = rsiValues[rsiValues.length - 1];
    const previousRSI = rsiValues[rsiValues.length - 2];
    const currentPrice = this.getCurrentPrice();

    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let strength = 0;
    const conditions = [];

    // Entry logic
    if (this.state.currentPosition === 'NONE') {
      // Buy signal: RSI crosses below oversold level
      if (previousRSI >= this.oversoldLevel && currentRSI < this.oversoldLevel) {
        signal = 'BUY';
        strength = Math.max(0, (this.oversoldLevel - currentRSI) / this.oversoldLevel * 100);
        
        conditions.push({
          conditionId: 'rsi_oversold_entry',
          met: true,
          currentValue: currentRSI,
          targetValue: this.oversoldLevel,
          description: `RSI crossed below oversold level (${currentRSI.toFixed(2)} < ${this.oversoldLevel})`
        });

        logger.info('RSI Buy signal generated', {
          symbol: this.params.symbol,
          rsi: currentRSI,
          price: currentPrice,
          strength
        });
      }
      // Sell signal: RSI crosses above overbought level (for short positions)
      else if (previousRSI <= this.overboughtLevel && currentRSI > this.overboughtLevel) {
        signal = 'SELL';
        strength = Math.max(0, (currentRSI - this.overboughtLevel) / (100 - this.overboughtLevel) * 100);
        
        conditions.push({
          conditionId: 'rsi_overbought_entry',
          met: true,
          currentValue: currentRSI,
          targetValue: this.overboughtLevel,
          description: `RSI crossed above overbought level (${currentRSI.toFixed(2)} > ${this.overboughtLevel})`
        });

        logger.info('RSI Sell signal generated', {
          symbol: this.params.symbol,
          rsi: currentRSI,
          price: currentPrice,
          strength
        });
      }
    }
    // Exit logic
    else if (this.state.currentPosition === 'LONG') {
      // Exit long position when RSI crosses back above oversold or hits overbought
      if (currentRSI > this.oversoldLevel + 10 || currentRSI > this.overboughtLevel) {
        signal = 'SELL';
        strength = currentRSI > this.overboughtLevel ? 90 : 60;
        
        conditions.push({
          conditionId: 'rsi_long_exit',
          met: true,
          currentValue: currentRSI,
          targetValue: this.overboughtLevel,
          description: `RSI exit signal for long position (${currentRSI.toFixed(2)})`
        });

        logger.info('RSI Long exit signal generated', {
          symbol: this.params.symbol,
          rsi: currentRSI,
          price: currentPrice,
          entryPrice: this.state.entryPrice
        });
      }
    }
    else if (this.state.currentPosition === 'SHORT') {
      // Exit short position when RSI crosses back below overbought or hits oversold
      if (currentRSI < this.overboughtLevel - 10 || currentRSI < this.oversoldLevel) {
        signal = 'BUY'; // Buy to close short position
        strength = currentRSI < this.oversoldLevel ? 90 : 60;
        
        conditions.push({
          conditionId: 'rsi_short_exit',
          met: true,
          currentValue: currentRSI,
          targetValue: this.oversoldLevel,
          description: `RSI exit signal for short position (${currentRSI.toFixed(2)})`
        });

        logger.info('RSI Short exit signal generated', {
          symbol: this.params.symbol,
          rsi: currentRSI,
          price: currentPrice,
          entryPrice: this.state.entryPrice
        });
      }
    }

    return {
      signal,
      strength,
      conditions,
      timestamp: Date.now()
    };
  }

  /**
   * Get RSI-specific metrics
   */
  public getRSIMetrics(): {
    currentRSI: number | null;
    isOversold: boolean;
    isOverbought: boolean;
    trend: 'RISING' | 'FALLING' | 'NEUTRAL';
  } {
    const rsiValues = this.state.indicators.get('rsi');
    
    if (!rsiValues || rsiValues.length === 0) {
      return {
        currentRSI: null,
        isOversold: false,
        isOverbought: false,
        trend: 'NEUTRAL'
      };
    }

    const currentRSI = rsiValues[rsiValues.length - 1];
    const previousRSI = rsiValues.length > 1 ? rsiValues[rsiValues.length - 2] : currentRSI;

    let trend: 'RISING' | 'FALLING' | 'NEUTRAL' = 'NEUTRAL';
    if (currentRSI > previousRSI + 1) {
      trend = 'RISING';
    } else if (currentRSI < previousRSI - 1) {
      trend = 'FALLING';
    }

    return {
      currentRSI,
      isOversold: currentRSI < this.oversoldLevel,
      isOverbought: currentRSI > this.overboughtLevel,
      trend
    };
  }

  /**
   * Get strategy-specific status
   */
  public getStrategyStatus(): {
    name: string;
    description: string;
    isActive: boolean;
    currentPosition: string;
    rsiMetrics: ReturnType<RSIStrategy['getRSIMetrics']>;
    lastSignal?: {
      signal: string;
      timestamp: number;
      strength: number;
    };
  } {
    return {
      name: this.getName(),
      description: this.getDescription(),
      isActive: this.isActive(),
      currentPosition: this.state.currentPosition,
      rsiMetrics: this.getRSIMetrics(),
      lastSignal: this.state.lastUpdate ? {
        signal: 'HOLD', // This would be stored from last signal
        timestamp: this.state.lastUpdate,
        strength: 0
      } : undefined
    };
  }

  /**
   * Validate strategy parameters
   */
  public static validateParams(params: StrategyParams): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check RSI parameters
    if (!params.indicatorParams.rsi) {
      errors.push('RSI parameters are required');
    } else {
      const rsi = params.indicatorParams.rsi;
      
      if (rsi.period < 2 || rsi.period > 50) {
        errors.push('RSI period must be between 2 and 50');
      }
      
      if (rsi.oversold < 10 || rsi.oversold > 40) {
        errors.push('RSI oversold level must be between 10 and 40');
      }
      
      if (rsi.overbought < 60 || rsi.overbought > 90) {
        errors.push('RSI overbought level must be between 60 and 90');
      }
      
      if (rsi.oversold >= rsi.overbought) {
        errors.push('RSI oversold level must be less than overbought level');
      }
    }

    // Check risk parameters
    if (params.riskParams.positionSizeUsd <= 0) {
      errors.push('Position size must be greater than 0');
    }

    if (params.riskParams.takeProfitPercent <= 0 || params.riskParams.takeProfitPercent > 50) {
      errors.push('Take profit percent must be between 0 and 50');
    }

    if (params.riskParams.stopLossPercent <= 0 || params.riskParams.stopLossPercent > 20) {
      errors.push('Stop loss percent must be between 0 and 20');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Create default RSI strategy parameters
   */
  public static createDefaultParams(symbol: string, interval: string): StrategyParams {
    return {
      symbol,
      interval,
      entryConditions: [
        {
          id: 'rsi_oversold',
          type: 'indicator',
          indicator: 'rsi',
          operator: 'lt',
          value: 30,
          enabled: true
        }
      ],
      exitConditions: [
        {
          id: 'rsi_overbought',
          type: 'indicator',
          indicator: 'rsi',
          operator: 'gt',
          value: 70,
          enabled: true
        }
      ],
      riskParams: {
        positionSizeUsd: 100,
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
    };
  }
}

export default RSIStrategy;