import React, { useState } from 'react';
import { BacktestConfig } from './BacktestPage';

interface BacktestConfigurationProps {
  onRunBacktest: (config: BacktestConfig) => void;
  isRunning: boolean;
}

interface Strategy {
  id: string;
  name: string;
  type: string;
  parameters: Record<string, any>;
}

export const BacktestConfiguration: React.FC<BacktestConfigurationProps> = ({
  onRunBacktest,
  isRunning,
}) => {
  const [config, setConfig] = useState<BacktestConfig>({
    strategyId: '',
    symbol: 'BTCUSDT',
    startDate: '2023-01-01',
    endDate: '2023-12-31',
    initialCapital: 10000,
    parameters: {},
  });

  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  // Mock strategies data
  const strategies: Strategy[] = [
    {
      id: '1',
      name: 'RSI Oversold/Overbought',
      type: 'RSI Strategy',
      parameters: {
        rsiPeriod: 14,
        oversoldLevel: 30,
        overboughtLevel: 70,
        stopLoss: 2.0,
        takeProfit: 4.0,
      },
    },
    {
      id: '2',
      name: 'MACD Crossover',
      type: 'MACD Strategy',
      parameters: {
        fastPeriod: 12,
        slowPeriod: 26,
        signalPeriod: 9,
        stopLoss: 1.5,
        takeProfit: 3.0,
      },
    },
    {
      id: '3',
      name: 'Bollinger Bands Mean Reversion',
      type: 'Bollinger Bands',
      parameters: {
        period: 20,
        standardDeviations: 2,
        stopLoss: 2.5,
        takeProfit: 2.0,
      },
    },
  ];

  const symbols = [
    'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT',
    'DOTUSDT', 'LINKUSDT', 'AVAXUSDT', 'MATICUSDT', 'UNIUSDT'
  ];

  const handleStrategyChange = (strategyId: string) => {
    const strategy = strategies.find(s => s.id === strategyId);
    setSelectedStrategy(strategy || null);
    setConfig(prev => ({
      ...prev,
      strategyId,
      parameters: strategy?.parameters || {},
    }));
  };

  const handleParameterChange = (key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [key]: value,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (config.strategyId && config.symbol && config.startDate && config.endDate) {
      onRunBacktest(config);
    }
  };

  const isValidDateRange = () => {
    const start = new Date(config.startDate);
    const end = new Date(config.endDate);
    const now = new Date();
    
    return start < end && end <= now;
  };

  const getEstimatedDuration = () => {
    const start = new Date(config.startDate);
    const end = new Date(config.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (days <= 30) return '~30 segundos';
    if (days <= 90) return '~1-2 minutos';
    if (days <= 365) return '~3-5 minutos';
    return '~5-10 minutos';
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Configuração do Backtest
        </h2>
        <p className="text-gray-600 mt-1">
          Configure os parâmetros para testar sua estratégia
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Strategy Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estratégia
          </label>
          <select
            value={config.strategyId}
            onChange={(e) => handleStrategyChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Selecione uma estratégia</option>
            {strategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.name} ({strategy.type})
              </option>
            ))}
          </select>
        </div>

        {/* Symbol and Period */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Símbolo
            </label>
            <select
              value={config.symbol}
              onChange={(e) => setConfig(prev => ({ ...prev, symbol: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {symbols.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={config.startDate}
              onChange={(e) => setConfig(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data Final
            </label>
            <input
              type="date"
              value={config.endDate}
              onChange={(e) => setConfig(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
        </div>

        {/* Initial Capital */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Capital Inicial (USD)
          </label>
          <input
            type="number"
            value={config.initialCapital}
            onChange={(e) => setConfig(prev => ({ ...prev, initialCapital: parseFloat(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="100"
            step="100"
            required
          />
        </div>

        {/* Strategy Parameters */}
        {selectedStrategy && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Parâmetros da Estratégia
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(selectedStrategy.parameters).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </label>
                  <input
                    type="number"
                    value={config.parameters[key] || value}
                    onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    step="0.1"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation Messages */}
        {!isValidDateRange() && config.startDate && config.endDate && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="text-red-600 mr-2">⚠️</div>
              <div className="text-sm text-red-700">
                Período inválido. A data inicial deve ser anterior à data final e não pode ser futura.
              </div>
            </div>
          </div>
        )}

        {/* Backtest Info */}
        {isValidDateRange() && config.strategyId && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="text-blue-600 mr-2">ℹ️</div>
              <div>
                <div className="font-medium text-blue-800">Informações do Backtest</div>
                <div className="text-sm text-blue-700 mt-1">
                  <p>Período: {Math.ceil((new Date(config.endDate).getTime() - new Date(config.startDate).getTime()) / (1000 * 60 * 60 * 24))} dias</p>
                  <p>Tempo estimado: {getEstimatedDuration()}</p>
                  <p>Capital inicial: ${config.initialCapital.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isRunning || !config.strategyId || !isValidDateRange()}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Executando Backtest...
              </div>
            ) : (
              '🚀 Executar Backtest'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};