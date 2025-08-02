import React, { useState } from 'react';
import { BacktestResult } from './BacktestPage';

interface StrategyComparisonProps {
  onBack: () => void;
}

export const StrategyComparison: React.FC<StrategyComparisonProps> = ({ onBack }) => {
  const [selectedResults, setSelectedResults] = useState<string[]>([]);

  // Mock backtest results for comparison
  const availableResults: BacktestResult[] = [
    {
      id: '1',
      strategyName: 'RSI Oversold/Overbought',
      symbol: 'BTCUSDT',
      period: '2023-01-01 - 2023-12-31',
      totalReturn: 2450.75,
      totalReturnPercent: 24.51,
      totalTrades: 156,
      winRate: 68.5,
      profitFactor: 1.85,
      maxDrawdown: -8.2,
      sharpeRatio: 1.42,
      sortinoRatio: 1.89,
      calmarRatio: 2.99,
      trades: [],
      equityCurve: [],
      createdAt: '2024-01-15T10:30:00Z',
    },
    {
      id: '2',
      strategyName: 'MACD Crossover',
      symbol: 'ETHUSDT',
      period: '2023-01-01 - 2023-12-31',
      totalReturn: 1890.25,
      totalReturnPercent: 18.90,
      totalTrades: 89,
      winRate: 71.9,
      profitFactor: 2.15,
      maxDrawdown: -5.8,
      sharpeRatio: 1.67,
      sortinoRatio: 2.12,
      calmarRatio: 3.26,
      trades: [],
      equityCurve: [],
      createdAt: '2024-01-14T15:45:00Z',
    },
    {
      id: '3',
      strategyName: 'Bollinger Bands Mean Reversion',
      symbol: 'ADAUSDT',
      period: '2023-06-01 - 2023-12-31',
      totalReturn: -325.50,
      totalReturnPercent: -3.26,
      totalTrades: 67,
      winRate: 44.8,
      profitFactor: 0.87,
      maxDrawdown: -12.4,
      sharpeRatio: -0.23,
      sortinoRatio: -0.31,
      calmarRatio: -0.26,
      trades: [],
      equityCurve: [],
      createdAt: '2024-01-13T09:15:00Z',
    },
  ];

  const comparisonResults = availableResults.filter(result => 
    selectedResults.includes(result.id)
  );

  const handleToggleResult = (resultId: string) => {
    setSelectedResults(prev => {
      if (prev.includes(resultId)) {
        return prev.filter(id => id !== resultId);
      } else if (prev.length < 3) {
        return [...prev, resultId];
      }
      return prev;
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getPerformanceColor = (value: number) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getBestPerformer = (metric: keyof BacktestResult) => {
    if (comparisonResults.length === 0) return null;
    
    return comparisonResults.reduce((best, current) => {
      const currentValue = current[metric] as number;
      const bestValue = best[metric] as number;
      
      // For maxDrawdown, we want the least negative (closest to 0)
      if (metric === 'maxDrawdown') {
        return currentValue > bestValue ? current : best;
      }
      
      return currentValue > bestValue ? current : best;
    });
  };

  const metrics = [
    { key: 'totalReturnPercent', label: 'Retorno %', format: formatPercent },
    { key: 'totalReturn', label: 'Retorno Absoluto', format: formatCurrency },
    { key: 'totalTrades', label: 'Total de Trades', format: (v: number) => v.toString() },
    { key: 'winRate', label: 'Win Rate', format: (v: number) => `${v.toFixed(1)}%` },
    { key: 'profitFactor', label: 'Profit Factor', format: (v: number) => v.toFixed(2) },
    { key: 'maxDrawdown', label: 'Max Drawdown', format: formatPercent },
    { key: 'sharpeRatio', label: 'Sharpe Ratio', format: (v: number) => v.toFixed(2) },
    { key: 'sortinoRatio', label: 'Sortino Ratio', format: (v: number) => v.toFixed(2) },
    { key: 'calmarRatio', label: 'Calmar Ratio', format: (v: number) => v.toFixed(2) },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="text-gray-500 hover:text-gray-700"
            >
              ← Voltar
            </button>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Comparação de Estratégias
              </h2>
              <p className="text-gray-600 mt-1">
                Compare até 3 backtests lado a lado
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Selecionar Backtests para Comparar
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableResults.map((result) => (
            <div
              key={result.id}
              className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                selectedResults.includes(result.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => handleToggleResult(result.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">
                  {result.strategyName}
                </h4>
                <input
                  type="checkbox"
                  checked={selectedResults.includes(result.id)}
                  onChange={() => handleToggleResult(result.id)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
              </div>
              
              <div className="text-sm text-gray-600 space-y-1">
                <div>{result.symbol} • {result.period}</div>
                <div className={`font-medium ${getPerformanceColor(result.totalReturnPercent)}`}>
                  {formatPercent(result.totalReturnPercent)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {selectedResults.length >= 3 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm text-yellow-800">
              ⚠️ Máximo de 3 backtests podem ser comparados simultaneamente.
            </div>
          </div>
        )}
      </div>

      {/* Comparison Results */}
      {comparisonResults.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Comparação Detalhada
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Métrica
                  </th>
                  {comparisonResults.map((result) => (
                    <th key={result.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div>{result.strategyName}</div>
                      <div className="text-xs text-gray-400 normal-case">
                        {result.symbol}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metrics.map((metric) => {
                  const bestPerformer = getBestPerformer(metric.key as keyof BacktestResult);
                  
                  return (
                    <tr key={metric.key}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {metric.label}
                      </td>
                      {comparisonResults.map((result) => {
                        const value = result[metric.key as keyof BacktestResult] as number;
                        const isBest = bestPerformer?.id === result.id;
                        
                        return (
                          <td key={result.id} className="px-6 py-4 whitespace-nowrap">
                            <div className={`text-sm font-medium ${
                              isBest ? 'text-green-600' : 'text-gray-900'
                            }`}>
                              {isBest && '🏆 '}
                              {metric.format(value)}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Analysis */}
      {comparisonResults.length > 1 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            Análise Comparativa
          </h3>
          
          <div className="space-y-3 text-sm">
            {/* Best Overall Performer */}
            <div className="flex items-start space-x-2">
              <span className="text-lg">🏆</span>
              <div>
                <span className="font-medium text-blue-900">Melhor Performance Geral: </span>
                <span className="text-blue-800">
                  {getBestPerformer('totalReturnPercent')?.strategyName} com {
                    formatPercent(getBestPerformer('totalReturnPercent')?.totalReturnPercent || 0)
                  }
                </span>
              </div>
            </div>

            {/* Most Consistent */}
            <div className="flex items-start space-x-2">
              <span className="text-lg">🎯</span>
              <div>
                <span className="font-medium text-blue-900">Mais Consistente: </span>
                <span className="text-blue-800">
                  {getBestPerformer('winRate')?.strategyName} com {
                    getBestPerformer('winRate')?.winRate.toFixed(1)
                  }% de win rate
                </span>
              </div>
            </div>

            {/* Lowest Risk */}
            <div className="flex items-start space-x-2">
              <span className="text-lg">🛡️</span>
              <div>
                <span className="font-medium text-blue-900">Menor Risco: </span>
                <span className="text-blue-800">
                  {getBestPerformer('maxDrawdown')?.strategyName} com {
                    formatPercent(getBestPerformer('maxDrawdown')?.maxDrawdown || 0)
                  } de drawdown máximo
                </span>
              </div>
            </div>

            {/* Best Risk-Adjusted Return */}
            <div className="flex items-start space-x-2">
              <span className="text-lg">⚖️</span>
              <div>
                <span className="font-medium text-blue-900">Melhor Retorno Ajustado ao Risco: </span>
                <span className="text-blue-800">
                  {getBestPerformer('sharpeRatio')?.strategyName} com Sharpe Ratio de {
                    getBestPerformer('sharpeRatio')?.sharpeRatio.toFixed(2)
                  }
                </span>
              </div>
            </div>

            {/* Recommendation */}
            <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
              <div className="flex items-start space-x-2">
                <span className="text-lg">💡</span>
                <div>
                  <span className="font-medium text-blue-900">Recomendação: </span>
                  <span className="text-blue-800">
                    {(() => {
                      const bestReturn = getBestPerformer('totalReturnPercent');
                      const bestSharpe = getBestPerformer('sharpeRatio');
                      
                      if (bestReturn?.id === bestSharpe?.id) {
                        return `${bestReturn?.strategyName} oferece a melhor combinação de retorno e controle de risco.`;
                      } else {
                        return `Para máximo retorno, escolha ${bestReturn?.strategyName}. Para melhor relação risco/retorno, escolha ${bestSharpe?.strategyName}.`;
                      }
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {comparisonResults.length === 0 && (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-sm">Selecione pelo menos um backtest para comparar</div>
        </div>
      )}
    </div>
  );
};