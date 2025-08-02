import { EventEmitter } from 'events';
import { KlineData } from '@/services/DataIngestorService';
import { TechnicalIndicators } from '../indicators/TechnicalIndicators';
import { logger } from '@/utils/logger';

export interface StrategyParams {
  symbol: string;
  interval: string;
  entryConditions: Condition[];
  exitConditions: Condition[];
  riskParams: RiskParams;
  indicatorParams: IndicatorParams;
}

export interface RiskParams {
  positionSizeUsd: number;
  takeProfitPercent: number;
  stopLossPercent: number;
  maxDrawdownPercent: number;
  maxPositions: number;
}

export interface IndicatorParams {
  sma?: { periods: number[] };
  ema?: { periods: number[] };
  rsi?: { period: number; overbought: number; oversold: number };
  macd?: { fastPeriod: number; slowPeriod: number; signalPeriod: number };
  bollinger?: { period: number; standardDeviations: number };
  stochastic?: { kPeriod: number; dPeriod: number };
  atr?: { period: number };
}

export interface Condition {
  id: string;
  type: 'indicator' | 'price' | 'time' | 'custom';
  indicator?: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'cross_above' | 'cross_below';
  value: number | string;
  timeframe?: string;
  enabled: boolean;
}

export interface SignalResult {
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-100
  conditions: ConditionResult[];
  timestamp: number;
}

export interface ConditionResult {
  conditionId: string;
  met: boolean;
  currentValue: number;
  targetValue: number;
  description: string;
}

export interface StrategyState {
  isActive: boolean;
  currentPosition: 'LONG' | 'SHORT' | 'NONE';
  entryPrice?: number;
  entryTime?: number;
  unrealizedPnl?: number;
  indicators: Map<string, number[]>;
  klineHistory: KlineData[];
  lastUpdate: number;
}

export abstract class BaseStrategy extends EventEmitter {
  protected params: StrategyParams;
  protected state: StrategyState;
  protected maxHistoryLength = 500; // Maximum number of klines to keep in memory

  constructor(params: StrategyParams) {
    super();
    this.params = params;
    this.state = {
      isActive: false,
      currentPosition: 'NONE',
      indicators: new Map(),
      klineHistory: [],
      lastUpdate: 0
    };

    this.initializeIndicators();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('signal_generated', (signal: SignalResult) => {
      logger.debug('Strategy signal generated', {
        strategy: this.constructor.name,
        symbol: this.params.symbol,
        signal: signal.signal,
        strength: signal.strength
      });
    });

    this.on('error', (error) => {
      logger.error('Strategy error:', {
        strategy: this.constructor.name,
        symbol: this.params.symbol,
        error
      });
    });
  }

  private initializeIndicators(): void {
    const { indicatorParams } = this.params;

    // Initialize indicator arrays
    if (indicatorParams.sma?.periods) {
      indicatorParams.sma.periods.forEach(period => {
        this.state.indicators.set(`sma_${period}`, []);
      });
    }

    if (indicatorParams.ema?.periods) {
      indicatorParams.ema.periods.forEach(period => {
        this.state.indicators.set(`ema_${period}`, []);
      });
    }

    if (indicatorParams.rsi) {
      this.state.indicators.set('rsi', []);
    }

    if (indicatorParams.macd) {
      this.state.indicators.set('macd', []);
      this.state.indicators.set('macd_signal', []);
      this.state.indicators.set('macd_histogram', []);
    }

    if (indicatorParams.bollinger) {
      this.state.indicators.set('bb_upper', []);
      this.state.indicators.set('bb_middle', []);
      this.state.indicators.set('bb_lower', []);
    }

    if (indicatorParams.stochastic) {
      this.state.indicators.set('stoch_k', []);
      this.state.indicators.set('stoch_d', []);
    }

    if (indicatorParams.atr) {
      this.state.indicators.set('atr', []);
    }
  }

  /**
   * Process new kline data
   */
  async onKline(kline: KlineData): Promise<void> {
    try {
      if (!kline.isFinal) {
        return; // Only process closed klines
      }

      // Add to history
      this.state.klineHistory.push(kline);
      
      // Trim history if too long
      if (this.state.klineHistory.length > this.maxHistoryLength) {
        this.state.klineHistory = this.state.klineHistory.slice(-this.maxHistoryLength);
      }

      // Update indicators
      await this.updateIndicators();

      // Check for signals
      const signal = await this.checkSignals();
      
      if (signal.signal !== 'HOLD') {
        this.emit('signal_generated', signal);
      }

      this.state.lastUpdate = Date.now();

    } catch (error) {
      logger.error('Error processing kline in strategy:', error);
      this.emit('error', error);
    }
  }

  /**
   * Update all indicators based on current kline history
   */
  protected async updateIndicators(): Promise<void> {
    const closes = this.getCloses();
    const highs = this.getHighs();
    const lows = this.getLows();
    // const volumes = this.getVolumes(); // TODO: Use volumes in analysis

    const { indicatorParams } = this.params;

    // Update SMA indicators
    if (indicatorParams.sma?.periods) {
      for (const period of indicatorParams.sma.periods) {
        const sma = TechnicalIndicators.calculateSMA(closes, period);
        if (sma !== null) {
          this.updateIndicatorValue(`sma_${period}`, sma);
        }
      }
    }

    // Update EMA indicators
    if (indicatorParams.ema?.periods) {
      for (const period of indicatorParams.ema.periods) {
        const ema = TechnicalIndicators.calculateEMA(closes, period);
        if (ema !== null) {
          this.updateIndicatorValue(`ema_${period}`, ema);
        }
      }
    }

    // Update RSI
    if (indicatorParams.rsi) {
      const rsi = TechnicalIndicators.calculateRSI(closes, indicatorParams.rsi.period);
      if (rsi !== null) {
        this.updateIndicatorValue('rsi', rsi);
      }
    }

    // Update MACD
    if (indicatorParams.macd) {
      const { fastPeriod, slowPeriod, signalPeriod } = indicatorParams.macd;
      const macd = TechnicalIndicators.calculateMACD(closes, fastPeriod, slowPeriod, signalPeriod);
      if (macd !== null) {
        this.updateIndicatorValue('macd', macd.macd);
        this.updateIndicatorValue('macd_signal', macd.signal);
        this.updateIndicatorValue('macd_histogram', macd.histogram);
      }
    }

    // Update Bollinger Bands
    if (indicatorParams.bollinger) {
      const { period, standardDeviations } = indicatorParams.bollinger;
      const bb = TechnicalIndicators.calculateBollingerBands(closes, period, standardDeviations);
      if (bb !== null) {
        this.updateIndicatorValue('bb_upper', bb.upper);
        this.updateIndicatorValue('bb_middle', bb.middle);
        this.updateIndicatorValue('bb_lower', bb.lower);
      }
    }

    // Update Stochastic
    if (indicatorParams.stochastic) {
      const { kPeriod, dPeriod } = indicatorParams.stochastic;
      const stoch = TechnicalIndicators.calculateStochastic(highs, lows, closes, kPeriod, dPeriod);
      if (stoch !== null) {
        this.updateIndicatorValue('stoch_k', stoch.k);
        this.updateIndicatorValue('stoch_d', stoch.d);
      }
    }

    // Update ATR
    if (indicatorParams.atr) {
      const atr = TechnicalIndicators.calculateATR(highs, lows, closes, indicatorParams.atr.period);
      if (atr !== null) {
        this.updateIndicatorValue('atr', atr);
      }
    }
  }

  /**
   * Update indicator value and maintain history
   */
  protected updateIndicatorValue(indicator: string, value: number): void {
    const values = this.state.indicators.get(indicator) || [];
    values.push(value);
    
    // Trim to max length
    if (values.length > this.maxHistoryLength) {
      values.splice(0, values.length - this.maxHistoryLength);
    }
    
    this.state.indicators.set(indicator, values);
  }

  /**
   * Check all conditions and generate signals
   */
  protected async checkSignals(): Promise<SignalResult> {
    const entrySignal = await this.checkConditions(this.params.entryConditions);
    const exitSignal = await this.checkConditions(this.params.exitConditions);

    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let strength = 0;
    let conditions: ConditionResult[] = [];

    // Check entry conditions if no position
    if (this.state.currentPosition === 'NONE' && entrySignal.allMet) {
      signal = 'BUY'; // Simplified - could be BUY or SELL based on conditions
      strength = entrySignal.strength;
      conditions = entrySignal.results;
    }
    // Check exit conditions if in position
    else if (this.state.currentPosition !== 'NONE' && exitSignal.allMet) {
      signal = 'SELL';
      strength = exitSignal.strength;
      conditions = exitSignal.results;
    }

    return {
      signal,
      strength,
      conditions,
      timestamp: Date.now()
    };
  }

  /**
   * Check a set of conditions
   */
  protected async checkConditions(conditions: Condition[]): Promise<{
    allMet: boolean;
    strength: number;
    results: ConditionResult[];
  }> {
    const results: ConditionResult[] = [];
    let metCount = 0;

    for (const condition of conditions) {
      if (!condition.enabled) {
        continue;
      }

      const result = await this.evaluateCondition(condition);
      results.push(result);
      
      if (result.met) {
        metCount++;
      }
    }

    const enabledConditions = conditions.filter(c => c.enabled);
    const allMet = enabledConditions.length > 0 && metCount === enabledConditions.length;
    const strength = enabledConditions.length > 0 ? (metCount / enabledConditions.length) * 100 : 0;

    return { allMet, strength, results };
  }

  /**
   * Evaluate a single condition
   */
  protected async evaluateCondition(condition: Condition): Promise<ConditionResult> {
    let currentValue = 0;
    const targetValue = typeof condition.value === 'number' ? condition.value : parseFloat(condition.value);
    let met = false;
    let description = '';

    try {
      if (condition.type === 'indicator' && condition.indicator) {
        const indicatorValues = this.state.indicators.get(condition.indicator);
        if (indicatorValues && indicatorValues.length > 0) {
          currentValue = indicatorValues[indicatorValues.length - 1];
          
          switch (condition.operator) {
            case 'gt':
              met = currentValue > targetValue;
              description = `${condition.indicator} (${currentValue.toFixed(2)}) > ${targetValue}`;
              break;
            case 'lt':
              met = currentValue < targetValue;
              description = `${condition.indicator} (${currentValue.toFixed(2)}) < ${targetValue}`;
              break;
            case 'gte':
              met = currentValue >= targetValue;
              description = `${condition.indicator} (${currentValue.toFixed(2)}) >= ${targetValue}`;
              break;
            case 'lte':
              met = currentValue <= targetValue;
              description = `${condition.indicator} (${currentValue.toFixed(2)}) <= ${targetValue}`;
              break;
            case 'eq':
              met = Math.abs(currentValue - targetValue) < 0.001;
              description = `${condition.indicator} (${currentValue.toFixed(2)}) ≈ ${targetValue}`;
              break;
            case 'cross_above':
              met = this.checkCrossAbove(condition.indicator, targetValue);
              description = `${condition.indicator} crossed above ${targetValue}`;
              break;
            case 'cross_below':
              met = this.checkCrossBelow(condition.indicator, targetValue);
              description = `${condition.indicator} crossed below ${targetValue}`;
              break;
          }
        }
      } else if (condition.type === 'price') {
        const currentPrice = this.getCurrentPrice();
        currentValue = currentPrice;
        
        switch (condition.operator) {
          case 'gt':
            met = currentValue > targetValue;
            description = `Price (${currentValue.toFixed(2)}) > ${targetValue}`;
            break;
          case 'lt':
            met = currentValue < targetValue;
            description = `Price (${currentValue.toFixed(2)}) < ${targetValue}`;
            break;
          // Add other operators as needed
        }
      }

    } catch (error) {
      logger.error('Error evaluating condition:', { condition, error });
    }

    return {
      conditionId: condition.id,
      met,
      currentValue,
      targetValue,
      description
    };
  }

  /**
   * Check if indicator crossed above a value
   */
  protected checkCrossAbove(indicator: string, value: number): boolean {
    const values = this.state.indicators.get(indicator);
    if (!values || values.length < 2) {
      return false;
    }

    const current = values[values.length - 1];
    const previous = values[values.length - 2];

    return previous <= value && current > value;
  }

  /**
   * Check if indicator crossed below a value
   */
  protected checkCrossBelow(indicator: string, value: number): boolean {
    const values = this.state.indicators.get(indicator);
    if (!values || values.length < 2) {
      return false;
    }

    const current = values[values.length - 1];
    const previous = values[values.length - 2];

    return previous >= value && current < value;
  }

  // Helper methods to extract data from kline history
  protected getCloses(): number[] {
    return this.state.klineHistory.map(k => parseFloat(k.close));
  }

  protected getHighs(): number[] {
    return this.state.klineHistory.map(k => parseFloat(k.high));
  }

  protected getLows(): number[] {
    return this.state.klineHistory.map(k => parseFloat(k.low));
  }

  protected getOpens(): number[] {
    return this.state.klineHistory.map(k => parseFloat(k.open));
  }

  protected getVolumes(): number[] {
    return this.state.klineHistory.map(k => parseFloat(k.volume));
  }

  protected getCurrentPrice(): number {
    if (this.state.klineHistory.length === 0) {
      return 0;
    }
    return parseFloat(this.state.klineHistory[this.state.klineHistory.length - 1].close);
  }

  // Abstract methods to be implemented by concrete strategies
  abstract getName(): string;
  abstract getDescription(): string;

  // Public methods
  public activate(): void {
    this.state.isActive = true;
    logger.info('Strategy activated', {
      strategy: this.getName(),
      symbol: this.params.symbol
    });
  }

  public deactivate(): void {
    this.state.isActive = false;
    logger.info('Strategy deactivated', {
      strategy: this.getName(),
      symbol: this.params.symbol
    });
  }

  public isActive(): boolean {
    return this.state.isActive;
  }

  public getState(): StrategyState {
    return { ...this.state };
  }

  public getParams(): StrategyParams {
    return { ...this.params };
  }

  public updatePosition(position: 'LONG' | 'SHORT' | 'NONE', entryPrice?: number): void {
    this.state.currentPosition = position;
    if (position !== 'NONE' && entryPrice) {
      this.state.entryPrice = entryPrice;
      this.state.entryTime = Date.now();
    } else {
      this.state.entryPrice = undefined;
      this.state.entryTime = undefined;
    }
  }

  public getIndicatorValue(indicator: string): number | null {
    const values = this.state.indicators.get(indicator);
    return values && values.length > 0 ? values[values.length - 1] : null;
  }

  public getIndicatorHistory(indicator: string, length?: number): number[] {
    const values = this.state.indicators.get(indicator) || [];
    return length ? values.slice(-length) : [...values];
  }
}

export default BaseStrategy;