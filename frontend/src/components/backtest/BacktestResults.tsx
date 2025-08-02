import React, { useState } from 'react';
import { BacktestResult } from './BacktestPage';
import { TradesList } from './TradesList';
import { EquityCurveChart } from './EquityCurveChart';
import { MetricsBreakdown } from './MetricsBreakdown';

interface BacktestResultsProps {
  result: BacktestResult | null;
  onBack: () => void;
  onNewBacktest: () => void;
}

export const BacktestResults: React.FC<BacktestResultsProps> = ({
  result,
  onBack,
  onNewBacktest,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trades' | 'metrics' | 'chart'>('overview');

  if (!result) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <div>Nenhum resultado disponível</div>
        </div>
      </div>
    );
  }

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

  const getPerformanceIcon = (value: number) => {
    return value >= 0 ? '📈' : '📉';
  };

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
                Resultados do Backtest
              </h2>
              <div className="flex items-center space-x-2 mt-1 text-sm text-gray-600">
                <span>{result.strategyName}</span>
                <span>•</span>
                <span>{result.symbol}</span>
                <span>•</span>
                <span>{result.period}</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={onNewBacktest}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            Novo Backtest
          </button>
        </div>
      </div>

      {/* Performance Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            Resumo da Performance
          </h3>
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{getPerformanceIcon(result.totalReturnPercent)}</span>
            <span className={`text-lg font-bold ${getPerformanceColor(result.totalReturnPercent)}`}>
              {formatPercent(result.totalReturnPercent)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getPerformanceColor(result.totalReturn)}`}>
              {formatCurrency(result.totalReturn)}
            </div>
            <div className="text-sm text-gray-500 mt-1">Retorno Total</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {result.totalTrades}
            </div>
            <div className="text-sm text-gray-500 mt-1">Total de Trades</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {result.winRate.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 mt-1">Win Rate</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {result.sharpeRatio.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 mt-1">Sharpe Ratio</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Visão Geral', icon: '📊' },
              { id: 'chart', label: 'Gráfico', icon: '📈' },
              { id: 'trades', label: 'Trades', icon: '💼' },
              { id: 'metrics', label: 'Métricas', icon: '📋' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-lg font-semibold text-gray-900">
                    {result.profitFactor.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">Profit Factor</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Lucro bruto / Perda bruta
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className={`text-lg font-semibold ${getPerformanceColor(result.maxDrawdown)}`}>
                    {formatPercent(result.maxDrawdown)}
                  </div>
                  <div className="text-sm text-gray-500">Max Drawdown</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Maior perda consecutiva
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-lg font-semibold text-gray-900">
                    {result.sortinoRatio.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">Sortino Ratio</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Retorno ajustado ao risco negativo
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-lg font-semibold text-gray-900">
                    {result.calmarRatio.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-500">Calmar Ratio</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Retorno anual / Max Drawdown
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-lg font-semibold text-gray-900">
                    {(result.totalTrades * (result.winRate / 100)).toFixed(0)}
                  </div>
                  <div className="text-sm text-gray-500">Trades Vencedores</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {result.winRate.toFixed(1)}% do total
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-lg font-semibold text-gray-900">
                    {(result.totalTrades * (1 - result.winRate / 100)).toFixed(0)}
                  </div>
                  <div className="text-sm text-gray-500">Trades Perdedores</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {(100 - result.winRate).toFixed(1)}% do total
                  </div>
                </div>
              </div>

              {/* Performance Analysis */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Análise da Performance</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  {result.totalReturnPercent > 0 ? (
                    <p>✅ Estratégia apresentou retorno positivo de {formatPercent(result.totalReturnPercent)}</p>
                  ) : (
                    <p>❌ Estratégia apresentou retorno negativo de {formatPercent(result.totalReturnPercent)}</p>
                  )}
                  
                  {result.winRate > 50 ? (
                    <p>✅ Win rate acima de 50% ({result.winRate.toFixed(1)}%)</p>
                  ) : (
                    <p>⚠️ Win rate abaixo de 50% ({result.winRate.toFixed(1)}%)</p>
                  )}
                  
                  {result.sharpeRatio > 1 ? (
                    <p>✅ Sharpe ratio indica boa relação risco/retorno ({result.sharpeRatio.toFixed(2)})</p>
                  ) : (
                    <p>⚠️ Sharpe ratio baixo indica alta volatilidade ({result.sharpeRatio.toFixed(2)})</p>
                  )}
                  
                  {Math.abs(result.maxDrawdown) < 10 ? (
                    <p>✅ Drawdown máximo controlado ({formatPercent(result.maxDrawdown)})</p>
                  ) : (
                    <p>⚠️ Drawdown máximo elevado ({formatPercent(result.maxDrawdown)})</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Chart Tab */}
          {activeTab === 'chart' && (
            <EquityCurveChart result={result} />
          )}

          {/* Trades Tab */}
          {activeTab === 'trades' && (
            <TradesList result={result} />
          )}

          {/* Metrics Tab */}
          {activeTab === 'metrics' && (
            <MetricsBreakdown result={result} />
          )}
        </div>
      </div>
    </div>
  );
};