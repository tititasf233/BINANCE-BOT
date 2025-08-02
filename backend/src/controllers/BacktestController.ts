import { Response } from 'express';
import { backtestingService, BacktestRequest } from '@/services/BacktestingService';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import Joi from 'joi';

// Validation schemas
const backtestRequestSchema = Joi.object({
  strategyType: Joi.string()
    .valid('RSI', 'MACD', 'CUSTOM')
    .required()
    .messages({
      'any.only': 'Strategy type must be one of: RSI, MACD, CUSTOM',
      'any.required': 'Strategy type is required'
    }),
  strategyParams: Joi.object({
    symbol: Joi.string()
      .uppercase()
      .pattern(/^[A-Z]{2,10}$/)
      .required()
      .messages({
        'string.pattern.base': 'Symbol must be uppercase letters only (e.g., BTCUSDT)',
        'any.required': 'Symbol is required'
      }),
    interval: Joi.string()
      .valid('1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M')
      .required()
      .messages({
        'any.only': 'Invalid interval',
        'any.required': 'Interval is required'
      }),
    entryConditions: Joi.array().required(),
    exitConditions: Joi.array().required(),
    riskParams: Joi.object({
      positionSizeUsd: Joi.number().positive().required(),
      takeProfitPercent: Joi.number().positive().max(50).required(),
      stopLossPercent: Joi.number().positive().max(20).required(),
      maxDrawdownPercent: Joi.number().positive().max(50).required(),
      maxPositions: Joi.number().integer().positive().required()
    }).required(),
    indicatorParams: Joi.object().required()
  }).required(),
  startDate: Joi.date()
    .iso()
    .max('now')
    .required()
    .messages({
      'date.max': 'Start date cannot be in the future',
      'any.required': 'Start date is required'
    }),
  endDate: Joi.date()
    .iso()
    .max('now')
    .greater(Joi.ref('startDate'))
    .required()
    .messages({
      'date.max': 'End date cannot be in the future',
      'date.greater': 'End date must be after start date',
      'any.required': 'End date is required'
    }),
  initialBalance: Joi.number()
    .positive()
    .min(10)
    .max(1000000)
    .required()
    .messages({
      'number.positive': 'Initial balance must be positive',
      'number.min': 'Initial balance must be at least $10',
      'number.max': 'Initial balance cannot exceed $1,000,000',
      'any.required': 'Initial balance is required'
    })
});

export class BacktestController {
  /**
   * Run backtest
   */
  async runBacktest(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate request body
      const { error, value } = backtestRequestSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: error.details[0].message,
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const backtestRequest: BacktestRequest = {
        ...value,
        startDate: new Date(value.startDate),
        endDate: new Date(value.endDate)
      };

      // Additional validation
      const validation = backtestingService.validateBacktestRequest(backtestRequest);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: validation.errors.join(', '),
          code: 'BACKTEST_VALIDATION_ERROR'
        });
        return;
      }

      logger.info('Starting backtest', {
        userId: req.user.id,
        strategyType: backtestRequest.strategyType,
        symbol: backtestRequest.strategyParams.symbol,
        interval: backtestRequest.strategyParams.interval,
        startDate: backtestRequest.startDate,
        endDate: backtestRequest.endDate
      });

      // Run backtest
      const result = await backtestingService.runBacktest(backtestRequest);

      if (result.success) {
        logger.info('Backtest completed successfully', {
          userId: req.user.id,
          totalTrades: result.totalTrades,
          winRate: result.winRate,
          totalPnl: result.totalPnl,
          finalBalance: result.finalBalance
        });

        res.status(200).json({
          success: true,
          message: 'Backtest completed successfully',
          data: {
            summary: {
              startDate: result.startDate,
              endDate: result.endDate,
              initialBalance: result.initialBalance,
              finalBalance: result.finalBalance,
              totalReturn: ((result.finalBalance - result.initialBalance) / result.initialBalance) * 100,
              totalTrades: result.totalTrades,
              winningTrades: result.winningTrades,
              losingTrades: result.losingTrades,
              winRate: result.winRate,
              totalPnl: result.totalPnl,
              totalFees: result.totalFees,
              maxDrawdown: result.maxDrawdown,
              maxDrawdownPercent: result.maxDrawdownPercent,
              sharpeRatio: result.sharpeRatio,
              avgWin: result.avgWin,
              avgLoss: result.avgLoss,
              profitFactor: result.profitFactor
            },
            trades: result.trades,
            equityCurve: result.equityCurve,
            monthlyReturns: result.monthlyReturns
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
          code: 'BACKTEST_FAILED'
        });
      }

    } catch (error) {
      logger.error('Backtest controller error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get backtest templates for different strategy types
   */
  async getBacktestTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const templates = {
        RSI: {
          strategyType: 'RSI',
          strategyParams: {
            symbol: 'BTCUSDT',
            interval: '1h',
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
          initialBalance: 10000,
          description: 'RSI mean reversion strategy - buys when RSI < 30, sells when RSI > 70'
        },
        MACD: {
          strategyType: 'MACD',
          strategyParams: {
            symbol: 'BTCUSDT',
            interval: '1h',
            entryConditions: [
              {
                id: 'macd_bullish_crossover',
                type: 'indicator',
                indicator: 'macd',
                operator: 'cross_above',
                value: 0,
                enabled: true
              }
            ],
            exitConditions: [
              {
                id: 'macd_bearish_crossover',
                type: 'indicator',
                indicator: 'macd',
                operator: 'cross_below',
                value: 0,
                enabled: true
              }
            ],
            riskParams: {
              positionSizeUsd: 1000,
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
          },
          initialBalance: 10000,
          description: 'MACD crossover strategy - buys on bullish crossover, sells on bearish crossover'
        }
      };

      res.status(200).json({
        success: true,
        data: {
          templates
        }
      });

    } catch (error) {
      logger.error('Get backtest templates error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get available symbols for backtesting
   */
  async getAvailableSymbols(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Popular trading pairs for backtesting
      const symbols = [
        { symbol: 'BTCUSDT', name: 'Bitcoin/USDT', category: 'Major' },
        { symbol: 'ETHUSDT', name: 'Ethereum/USDT', category: 'Major' },
        { symbol: 'BNBUSDT', name: 'BNB/USDT', category: 'Major' },
        { symbol: 'ADAUSDT', name: 'Cardano/USDT', category: 'Altcoin' },
        { symbol: 'DOTUSDT', name: 'Polkadot/USDT', category: 'Altcoin' },
        { symbol: 'LINKUSDT', name: 'Chainlink/USDT', category: 'Altcoin' },
        { symbol: 'LTCUSDT', name: 'Litecoin/USDT', category: 'Major' },
        { symbol: 'BCHUSDT', name: 'Bitcoin Cash/USDT', category: 'Major' },
        { symbol: 'XLMUSDT', name: 'Stellar/USDT', category: 'Altcoin' },
        { symbol: 'EOSUSDT', name: 'EOS/USDT', category: 'Altcoin' },
        { symbol: 'TRXUSDT', name: 'TRON/USDT', category: 'Altcoin' },
        { symbol: 'XRPUSDT', name: 'Ripple/USDT', category: 'Major' }
      ];

      const intervals = [
        { interval: '1m', name: '1 Minute', category: 'Short-term' },
        { interval: '3m', name: '3 Minutes', category: 'Short-term' },
        { interval: '5m', name: '5 Minutes', category: 'Short-term' },
        { interval: '15m', name: '15 Minutes', category: 'Short-term' },
        { interval: '30m', name: '30 Minutes', category: 'Short-term' },
        { interval: '1h', name: '1 Hour', category: 'Medium-term' },
        { interval: '2h', name: '2 Hours', category: 'Medium-term' },
        { interval: '4h', name: '4 Hours', category: 'Medium-term' },
        { interval: '6h', name: '6 Hours', category: 'Medium-term' },
        { interval: '8h', name: '8 Hours', category: 'Medium-term' },
        { interval: '12h', name: '12 Hours', category: 'Medium-term' },
        { interval: '1d', name: '1 Day', category: 'Long-term' },
        { interval: '3d', name: '3 Days', category: 'Long-term' },
        { interval: '1w', name: '1 Week', category: 'Long-term' },
        { interval: '1M', name: '1 Month', category: 'Long-term' }
      ];

      res.status(200).json({
        success: true,
        data: {
          symbols,
          intervals
        }
      });

    } catch (error) {
      logger.error('Get available symbols error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get backtest performance metrics explanation
   */
  async getMetricsExplanation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const metrics = {
        totalReturn: {
          name: 'Total Return',
          description: 'The percentage gain or loss from initial balance to final balance',
          formula: '((Final Balance - Initial Balance) / Initial Balance) * 100',
          goodValue: '> 0%',
          unit: '%'
        },
        winRate: {
          name: 'Win Rate',
          description: 'The percentage of profitable trades out of total trades',
          formula: '(Winning Trades / Total Trades) * 100',
          goodValue: '> 50%',
          unit: '%'
        },
        profitFactor: {
          name: 'Profit Factor',
          description: 'The ratio of gross profit to gross loss',
          formula: 'Gross Profit / Gross Loss',
          goodValue: '> 1.5',
          unit: 'ratio'
        },
        sharpeRatio: {
          name: 'Sharpe Ratio',
          description: 'Risk-adjusted return measure (higher is better)',
          formula: '(Average Return - Risk-free Rate) / Standard Deviation of Returns',
          goodValue: '> 1.0',
          unit: 'ratio'
        },
        maxDrawdown: {
          name: 'Maximum Drawdown',
          description: 'The largest peak-to-trough decline in account balance',
          formula: 'Max(Peak Balance - Trough Balance)',
          goodValue: '< 20%',
          unit: '%'
        },
        avgWin: {
          name: 'Average Win',
          description: 'The average profit per winning trade',
          formula: 'Sum of Winning Trades / Number of Winning Trades',
          goodValue: '> Average Loss',
          unit: '$'
        },
        avgLoss: {
          name: 'Average Loss',
          description: 'The average loss per losing trade',
          formula: 'Sum of Losing Trades / Number of Losing Trades',
          goodValue: '< Average Win',
          unit: '$'
        },
        totalFees: {
          name: 'Total Fees',
          description: 'The total trading fees paid during the backtest period',
          formula: 'Sum of all trading fees',
          goodValue: '< 5% of Total PnL',
          unit: '$'
        }
      };

      res.status(200).json({
        success: true,
        data: {
          metrics
        }
      });

    } catch (error) {
      logger.error('Get metrics explanation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

export const backtestController = new BacktestController();