import { BaseStrategy, StrategyParams, SignalResult } from './BaseStrategy';
import { logger } from '@/utils/logger';

/**
 * MACD Strategy Implementation
 * 
 * Entry Conditions:
 * - MACD line crosses above signal line (bullish crossover) for BUY
 * - MACD line crosses below signal line (bearish crossover) for SELL
 * - Optional: MACD histogram confirmation
 * 
 * Exit Conditions:
 * - Opposite crossover occurs
 * - Stop loss or take profit hit
 */
export class MACDStrategy extends BaseStrategy {
  private readonly fastPeriod: number;
  private readonly slowPeriod: number;
  private readonly signalPeriod: number;
  private readonly requireHistogramConfirmation: boolean;

  constructor(params: StrategyParams) {
    super(params);
    
    // Extract MACD-specific parameters
    this.fastPeriod = params.indicatorParams.macd?.fastPeriod || 12;
    this.slowPeriod = params.indicatorParams.macd?.slowPeriod || 26;
    this.signalPeriod = params.indicatorParams.macd?.signalPeriod || 9;
    this.requireHistogramConfirmation = true; // Can be made configurable

    // Ensure MACD indicator is configured
    if (!params.indicatorParams.macd) {
      params.indicatorParams.macd = {
        fastPeriod: this.fastPeriod,
        slowPeriod: this.slowPeriod,
        signalPeriod: this.signalPeriod
      };
    }

    logger.info('MACD Strategy initialized', {
      symbol: params.symbol,
      interval: params.interval,
      fastPeriod: this.fastPeriod,
      slowPeriod: this.slowPeriod,
      signalPeriod: this.signalPeriod
    });
  }

  getName(): string {
    return 'MACD Strategy';
  }

  getDescription(): string {
    return `MACD crossover strategy with ${this.fastPeriod}/${this.slowPeriod}/${this.signalPeriod} periods. ` +
           `Buys on bullish crossover, sells on bearish crossover.`;
  }

  /**
   * Override signal checking to implement MACD-specific logic
   */
  protected async checkSignals(): Promise<SignalResult> {
    const macdValues = this.state.indicators.get('macd');
    const signalValues = this.state.indicators.get('macd_signal');
    const histogramValues = this.state.indicators.get('macd_histogram');
    
    if (!macdValues || !signalValues || macdValues.length < 2 || signalValues.length < 2) {
      return {
        signal: 'HOLD',
        strength: 0,
        conditions: [],
        timestamp: Date.now()
      };
    }

    const currentMACD = macdValues[macdValues.length - 1];
    const previousMACD = macdValues[macdValues.length - 2];
    const currentSignal = signalValues[signalValues.length - 1];
    const previousSignal = signalValues[signalValues.length - 2];
    const currentHistogram = histogramValues ? histogramValues[histogramValues.length - 1] : 0;
    const currentPrice = this.getCurrentPrice();

    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let strength = 0;
    const conditions = [];

    // Check for crossovers
    const bullishCrossover = previousMACD <= previousSignal && currentMACD > currentSignal;
    const bearishCrossover = previousMACD >= previousSignal && currentMACD < currentSignal;

    // Entry logic
    if (this.state.currentPosition === 'NONE') {
      // Bullish crossover - Buy signal
      if (bullishCrossover) {
        let confirmationMet = true;
        
        // Optional histogram confirmation
        if (this.requireHistogramConfirmation && currentHistogram <= 0) {
          confirmationMet = false;
        }

        if (confirmationMet) {
          signal = 'BUY';
          strength = Math.min(100, Math.abs(currentMACD - currentSignal) * 100);
          
          conditions.push({
            conditionId: 'macd_bullish_crossover',
            met: true,
            currentValue: currentMACD,
            targetValue: currentSignal,
            description: `MACD bullish crossover (${currentMACD.toFixed(4)} > ${currentSignal.toFixed(4)})`
          });

          if (this.requireHistogramConfirmation) {
            conditions.push({
              conditionId: 'macd_histogram_positive',
              met: currentHistogram > 0,
              currentValue: currentHistogram,
              targetValue: 0,
              description: `MACD histogram confirmation (${currentHistogram.toFixed(4)} > 0)`
            });
          }

          logger.info('MACD Buy signal generated', {
            symbol: this.params.symbol,
            macd: currentMACD,
            signal: currentSignal,
            histogram: currentHistogram,
            price: currentPrice,
            strength
          });
        }
      }
      // Bearish crossover - Sell signal (for short positions)
      else if (bearishCrossover) {
        let confirmationMet = true;
        
        // Optional histogram confirmation
        if (this.requireHistogramConfirmation && currentHistogram >= 0) {
          confirmationMet = false;
        }

        if (confirmationMet) {
          signal = 'SELL';
          strength = Math.min(100, Math.abs(currentMACD - currentSignal) * 100);
          
          conditions.push({
            conditionId: 'macd_bearish_crossover',
            met: true,
            currentValue: currentMACD,
            targetValue: currentSignal,
            description: `MACD bearish crossover (${currentMACD.toFixed(4)} < ${currentSignal.toFixed(4)})`
          });

          if (this.requireHistogramConfirmation) {
            conditions.push({
              conditionId: 'macd_histogram_negative',
              met: currentHistogram < 0,
              currentValue: currentHistogram,
              targetValue: 0,
              description: `MACD histogram confirmation (${currentHistogram.toFixed(4)} < 0)`
            });
          }

          logger.info('MACD Sell signal generated', {
            symbol: this.params.symbol,
            macd: currentMACD,
            signal: currentSignal,
            histogram: currentHistogram,
            price: currentPrice,
            strength
          });
        }
      }
    }
    // Exit logic
    else if (this.state.currentPosition === 'LONG') {
      // Exit long position on bearish crossover
      if (bearishCrossover) {
        signal = 'SELL';
        strength = 80;
        
        conditions.push({
          conditionId: 'macd_long_exit',
          met: true,
          currentValue: currentMACD,
          targetValue: currentSignal,
          description: `MACD bearish crossover - exit long (${currentMACD.toFixed(4)} < ${currentSignal.toFixed(4)})`
        });

        logger.info('MACD Long exit signal generated', {
          symbol: this.params.symbol,
          macd: currentMACD,
          signal: currentSignal,
          price: currentPrice,
          entryPrice: this.state.entryPrice
        });
      }
    }
    else if (this.state.currentPosition === 'SHORT') {
      // Exit short position on bullish crossover
      if (bullishCrossover) {
        signal = 'BUY'; // Buy to close short position
        strength = 80;
        
        conditions.push({
          conditionId: 'macd_short_exit',
          met: true,
          currentValue: currentMACD,
          targetValue: currentSignal,
          description: `MACD bullish crossover - exit short (${currentMACD.toFixed(4)} > ${currentSignal.toFixed(4)})`
        });

        logger.info('MACD Short exit signal generated', {
          symbol: this.params.symbol,
          macd: currentMACD,
          signal: currentSignal,
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
   * Get MACD-specific metrics
   */
  public getMACDMetrics(): {
    currentMACD: number | null;
    currentSignal: number | null;
    currentHistogram: number | null;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    crossoverType: 'BULLISH' | 'BEARISH' | 'NONE';
  } {
    const macdValues = this.state.indicators.get('macd');
    const signalValues = this.state.indicators.get('macd_signal');
    const histogramValues = this.state.indicators.get('macd_histogram');
    
    if (!macdValues || !signalValues || macdValues.length === 0) {
      return {
        currentMACD: null,
        currentSignal: null,
        currentHistogram: null,
        trend: 'NEUTRAL',
        crossoverType: 'NONE'
      };
    }

    const currentMACD = macdValues[macdValues.length - 1];
    const currentSignal = signalValues[signalValues.length - 1];
    const currentHistogram = histogramValues ? histogramValues[histogramValues.length - 1] : null;

    // Determine trend
    let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (currentMACD > currentSignal) {
      trend = 'BULLISH';
    } else if (currentMACD < currentSignal) {
      trend = 'BEARISH';
    }

    // Check for recent crossover
    let crossoverType: 'BULLISH' | 'BEARISH' | 'NONE' = 'NONE';
    if (macdValues.length >= 2 && signalValues.length >= 2) {
      const previousMACD = macdValues[macdValues.length - 2];
      const previousSignal = signalValues[signalValues.length - 2];

      if (previousMACD <= previousSignal && currentMACD > currentSignal) {
        crossoverType = 'BULLISH';
      } else if (previousMACD >= previousSignal && currentMACD < currentSignal) {
        crossoverType = 'BEARISH';
      }
    }

    return {
      currentMACD,
      currentSignal,
      currentHistogram,
      trend,
      crossoverType
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
    macdMetrics: ReturnType<MACDStrategy['getMACDMetrics']>;
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
      macdMetrics: this.getMACDMetrics(),
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

    // Check MACD parameters
    if (!params.indicatorParams.macd) {
      errors.push('MACD parameters are required');
    } else {
      const macd = params.indicatorParams.macd;
      
      if (macd.fastPeriod < 1 || macd.fastPeriod > 50) {
        errors.push('MACD fast period must be between 1 and 50');
      }
      
      if (macd.slowPeriod < 1 || macd.slowPeriod > 100) {
        errors.push('MACD slow period must be between 1 and 100');
      }
      
      if (macd.signalPeriod < 1 || macd.signalPeriod > 50) {
        errors.push('MACD signal period must be between 1 and 50');
      }
      
      if (macd.fastPeriod >= macd.slowPeriod) {
        errors.push('MACD fast period must be less than slow period');
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
   * Create default MACD strategy parameters
   */
  public static createDefaultParams(symbol: string, interval: string): StrategyParams {
    return {
      symbol,
      interval,
      entryConditions: [
        {
          id: 'macd_bullish_crossover',
          type: 'indicator',
          indicator: 'macd',
          operator: 'cross_above',
          value: 0, // Will be compared against signal line
          enabled: true
        }
      ],
      exitConditions: [
        {
          id: 'macd_bearish_crossover',
          type: 'indicator',
          indicator: 'macd',
          operator: 'cross_below',
          value: 0, // Will be compared against signal line
          enabled: true
        }
      ],
      riskParams: {
        positionSizeUsd: 100,
        takeProfitPercent: 4,
        stopLossPercent: 2,
        maxDrawdownPercent: 10,
        maxPositions: 1
      },
      indicatorParams: {
        macd: {
          fastPeriod: 12,
          slowPeriod: 26,
          signalPeriod: 9
        }
      }
    };
  }
}

export default MACDStrategy;