import { StrategyParams, Condition, RiskParams, IndicatorParams } from './BaseStrategy';
// Logger import removed as it's not used

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class StrategyValidator {
  /**
   * Validate complete strategy parameters
   */
  static validateStrategy(params: StrategyParams): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate basic parameters
    const basicValidation = this.validateBasicParams(params);
    errors.push(...basicValidation.errors);
    warnings.push(...basicValidation.warnings);

    // Validate conditions
    const conditionsValidation = this.validateConditions(params.entryConditions, params.exitConditions);
    errors.push(...conditionsValidation.errors);
    warnings.push(...conditionsValidation.warnings);

    // Validate risk parameters
    const riskValidation = this.validateRiskParams(params.riskParams);
    errors.push(...riskValidation.errors);
    warnings.push(...riskValidation.warnings);

    // Validate indicator parameters
    const indicatorValidation = this.validateIndicatorParams(params.indicatorParams);
    errors.push(...indicatorValidation.errors);
    warnings.push(...indicatorValidation.warnings);

    // Cross-validation between conditions and indicators
    const crossValidation = this.validateConditionIndicatorConsistency(
      params.entryConditions.concat(params.exitConditions),
      params.indicatorParams
    );
    errors.push(...crossValidation.errors);
    warnings.push(...crossValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate basic strategy parameters
   */
  private static validateBasicParams(params: StrategyParams): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Symbol validation
    if (!params.symbol || typeof params.symbol !== 'string') {
      errors.push('Symbol is required and must be a string');
    } else if (!/^[A-Z]{2,10}$/.test(params.symbol)) {
      warnings.push('Symbol should be uppercase letters only (e.g., BTCUSDT)');
    }

    // Interval validation
    const validIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
    if (!params.interval || !validIntervals.includes(params.interval)) {
      errors.push(`Interval must be one of: ${validIntervals.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate entry and exit conditions
   */
  private static validateConditions(entryConditions: Condition[], exitConditions: Condition[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if conditions exist
    if (!entryConditions || entryConditions.length === 0) {
      errors.push('At least one entry condition is required');
    }

    if (!exitConditions || exitConditions.length === 0) {
      warnings.push('No exit conditions defined - strategy will rely on risk management only');
    }

    // Validate individual conditions
    const allConditions = [...entryConditions, ...exitConditions];
    for (const condition of allConditions) {
      const conditionValidation = this.validateCondition(condition);
      errors.push(...conditionValidation.errors);
      warnings.push(...conditionValidation.warnings);
    }

    // Check for duplicate condition IDs
    const conditionIds = allConditions.map(c => c.id);
    const duplicateIds = conditionIds.filter((id, index) => conditionIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate condition IDs found: ${duplicateIds.join(', ')}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate individual condition
   */
  private static validateCondition(condition: Condition): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!condition.id) {
      errors.push('Condition ID is required');
    }

    if (!condition.type) {
      errors.push('Condition type is required');
    } else if (!['indicator', 'price', 'time', 'custom'].includes(condition.type)) {
      errors.push(`Invalid condition type: ${condition.type}`);
    }

    if (!condition.operator) {
      errors.push('Condition operator is required');
    } else if (!['gt', 'lt', 'gte', 'lte', 'eq', 'cross_above', 'cross_below'].includes(condition.operator)) {
      errors.push(`Invalid condition operator: ${condition.operator}`);
    }

    if (condition.value === undefined || condition.value === null) {
      errors.push('Condition value is required');
    }

    // Type-specific validation
    if (condition.type === 'indicator') {
      if (!condition.indicator) {
        errors.push('Indicator name is required for indicator conditions');
      }

      // Validate crossover operators
      if (['cross_above', 'cross_below'].includes(condition.operator)) {
        if (typeof condition.value !== 'number') {
          errors.push('Crossover conditions require numeric values');
        }
      }
    }

    if (condition.type === 'price') {
      if (typeof condition.value !== 'number' || condition.value <= 0) {
        errors.push('Price conditions require positive numeric values');
      }
    }

    // Enabled field
    if (typeof condition.enabled !== 'boolean') {
      warnings.push(`Condition ${condition.id}: enabled field should be boolean, defaulting to true`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate risk parameters
   */
  private static validateRiskParams(riskParams: RiskParams): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Position size
    if (!riskParams.positionSizeUsd || riskParams.positionSizeUsd <= 0) {
      errors.push('Position size must be greater than 0');
    } else if (riskParams.positionSizeUsd < 10) {
      warnings.push('Position size is very small, may not be practical for trading');
    } else if (riskParams.positionSizeUsd > 10000) {
      warnings.push('Position size is very large, ensure adequate risk management');
    }

    // Take profit
    if (!riskParams.takeProfitPercent || riskParams.takeProfitPercent <= 0) {
      errors.push('Take profit percentage must be greater than 0');
    } else if (riskParams.takeProfitPercent > 50) {
      warnings.push('Take profit percentage is very high (>50%)');
    } else if (riskParams.takeProfitPercent < 0.5) {
      warnings.push('Take profit percentage is very low (<0.5%)');
    }

    // Stop loss
    if (!riskParams.stopLossPercent || riskParams.stopLossPercent <= 0) {
      errors.push('Stop loss percentage must be greater than 0');
    } else if (riskParams.stopLossPercent > 20) {
      warnings.push('Stop loss percentage is very high (>20%)');
    } else if (riskParams.stopLossPercent < 0.5) {
      warnings.push('Stop loss percentage is very low (<0.5%)');
    }

    // Risk-reward ratio
    if (riskParams.takeProfitPercent && riskParams.stopLossPercent) {
      const riskRewardRatio = riskParams.takeProfitPercent / riskParams.stopLossPercent;
      if (riskRewardRatio < 1) {
        warnings.push(`Risk-reward ratio is unfavorable (${riskRewardRatio.toFixed(2)}:1)`);
      } else if (riskRewardRatio > 5) {
        warnings.push(`Risk-reward ratio is very high (${riskRewardRatio.toFixed(2)}:1), may be unrealistic`);
      }
    }

    // Max drawdown
    if (!riskParams.maxDrawdownPercent || riskParams.maxDrawdownPercent <= 0) {
      errors.push('Max drawdown percentage must be greater than 0');
    } else if (riskParams.maxDrawdownPercent > 50) {
      warnings.push('Max drawdown percentage is very high (>50%)');
    }

    // Max positions
    if (!riskParams.maxPositions || riskParams.maxPositions < 1) {
      errors.push('Max positions must be at least 1');
    } else if (riskParams.maxPositions > 10) {
      warnings.push('Max positions is very high (>10), ensure adequate capital');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate indicator parameters
   */
  private static validateIndicatorParams(indicatorParams: IndicatorParams): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // SMA validation
    if (indicatorParams.sma) {
      if (!indicatorParams.sma.periods || indicatorParams.sma.periods.length === 0) {
        errors.push('SMA periods array cannot be empty');
      } else {
        for (const period of indicatorParams.sma.periods) {
          if (period < 2 || period > 200) {
            errors.push(`SMA period ${period} must be between 2 and 200`);
          }
        }
      }
    }

    // EMA validation
    if (indicatorParams.ema) {
      if (!indicatorParams.ema.periods || indicatorParams.ema.periods.length === 0) {
        errors.push('EMA periods array cannot be empty');
      } else {
        for (const period of indicatorParams.ema.periods) {
          if (period < 2 || period > 200) {
            errors.push(`EMA period ${period} must be between 2 and 200`);
          }
        }
      }
    }

    // RSI validation
    if (indicatorParams.rsi) {
      const rsi = indicatorParams.rsi;
      if (rsi.period < 2 || rsi.period > 50) {
        errors.push('RSI period must be between 2 and 50');
      }
      if (rsi.overbought < 50 || rsi.overbought > 95) {
        errors.push('RSI overbought level must be between 50 and 95');
      }
      if (rsi.oversold < 5 || rsi.oversold > 50) {
        errors.push('RSI oversold level must be between 5 and 50');
      }
      if (rsi.oversold >= rsi.overbought) {
        errors.push('RSI oversold level must be less than overbought level');
      }
    }

    // MACD validation
    if (indicatorParams.macd) {
      const macd = indicatorParams.macd;
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

    // Bollinger Bands validation
    if (indicatorParams.bollinger) {
      const bb = indicatorParams.bollinger;
      if (bb.period < 2 || bb.period > 100) {
        errors.push('Bollinger Bands period must be between 2 and 100');
      }
      if (bb.standardDeviations < 0.5 || bb.standardDeviations > 5) {
        errors.push('Bollinger Bands standard deviations must be between 0.5 and 5');
      }
    }

    // Stochastic validation
    if (indicatorParams.stochastic) {
      const stoch = indicatorParams.stochastic;
      if (stoch.kPeriod < 1 || stoch.kPeriod > 50) {
        errors.push('Stochastic K period must be between 1 and 50');
      }
      if (stoch.dPeriod < 1 || stoch.dPeriod > 20) {
        errors.push('Stochastic D period must be between 1 and 20');
      }
    }

    // ATR validation
    if (indicatorParams.atr) {
      if (indicatorParams.atr.period < 1 || indicatorParams.atr.period > 50) {
        errors.push('ATR period must be between 1 and 50');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate consistency between conditions and indicators
   */
  private static validateConditionIndicatorConsistency(
    conditions: Condition[],
    indicatorParams: IndicatorParams
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Get all indicator conditions
    const indicatorConditions = conditions.filter(c => c.type === 'indicator');

    // Check if required indicators are configured
    const requiredIndicators = new Set(indicatorConditions.map(c => c.indicator).filter(Boolean));

    for (const indicator of requiredIndicators) {
      switch (indicator) {
        case 'sma':
          if (!indicatorParams.sma) {
            errors.push('SMA indicator is used in conditions but not configured');
          }
          break;
        case 'ema':
          if (!indicatorParams.ema) {
            errors.push('EMA indicator is used in conditions but not configured');
          }
          break;
        case 'rsi':
          if (!indicatorParams.rsi) {
            errors.push('RSI indicator is used in conditions but not configured');
          }
          break;
        case 'macd':
        case 'macd_signal':
        case 'macd_histogram':
          if (!indicatorParams.macd) {
            errors.push('MACD indicator is used in conditions but not configured');
          }
          break;
        case 'bb_upper':
        case 'bb_middle':
        case 'bb_lower':
          if (!indicatorParams.bollinger) {
            errors.push('Bollinger Bands indicator is used in conditions but not configured');
          }
          break;
        case 'stoch_k':
        case 'stoch_d':
          if (!indicatorParams.stochastic) {
            errors.push('Stochastic indicator is used in conditions but not configured');
          }
          break;
        case 'atr':
          if (!indicatorParams.atr) {
            errors.push('ATR indicator is used in conditions but not configured');
          }
          break;
        default:
          if (indicator && !indicator.startsWith('sma_') && !indicator.startsWith('ema_')) {
            warnings.push(`Unknown indicator referenced in conditions: ${indicator}`);
          }
      }
    }

    // Check for unused indicators
    const configuredIndicators = Object.keys(indicatorParams);
    const usedIndicatorTypes = new Set();

    for (const indicator of requiredIndicators) {
      if (indicator?.startsWith('sma') || indicator?.includes('sma')) {
        usedIndicatorTypes.add('sma');
      } else if (indicator?.startsWith('ema') || indicator?.includes('ema')) {
        usedIndicatorTypes.add('ema');
      } else if (indicator?.includes('rsi')) {
        usedIndicatorTypes.add('rsi');
      } else if (indicator?.includes('macd')) {
        usedIndicatorTypes.add('macd');
      } else if (indicator?.includes('bb_') || indicator?.includes('bollinger')) {
        usedIndicatorTypes.add('bollinger');
      } else if (indicator?.includes('stoch')) {
        usedIndicatorTypes.add('stochastic');
      } else if (indicator?.includes('atr')) {
        usedIndicatorTypes.add('atr');
      }
    }

    for (const configuredIndicator of configuredIndicators) {
      if (!usedIndicatorTypes.has(configuredIndicator)) {
        warnings.push(`Indicator ${configuredIndicator} is configured but not used in any conditions`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate strategy for specific market conditions
   */
  static validateForMarket(params: StrategyParams, marketType: 'SPOT' | 'FUTURES' = 'SPOT'): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Market-specific validations
    if (marketType === 'FUTURES') {
      // Futures-specific validations
      if (params.riskParams.stopLossPercent > 10) {
        warnings.push('Stop loss percentage is high for futures trading');
      }
    } else {
      // Spot-specific validations
      const hasShortConditions = params.entryConditions.some(c => 
        c.type === 'custom' && String(c.value).toLowerCase().includes('short')
      );
      
      if (hasShortConditions) {
        warnings.push('Short conditions detected but spot trading does not support short positions');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Get validation summary
   */
  static getValidationSummary(result: ValidationResult): string {
    let summary = '';
    
    if (result.isValid) {
      summary = '✅ Strategy validation passed';
    } else {
      summary = `❌ Strategy validation failed with ${result.errors.length} error(s)`;
    }

    if (result.warnings.length > 0) {
      summary += ` and ${result.warnings.length} warning(s)`;
    }

    return summary;
  }
}

export default StrategyValidator;