import React, { useState } from 'react';

interface ReportPeriod {
  label: string;
  value: string;
  days: number;
}

interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnL: number;
  totalPnLPercent: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  totalFees: number;
  avgTradeDuration: number;
  bestTrade: number;
  worstTrade: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

export const PerformanceReports: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('30d');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('all');

  const periods: ReportPeriod[] = [
    { label: 'Últimos 7 dias', value: '7d', days: 7 },
    { label: 'Últimos 30 dias', value: '30d', days: 30 },
    { label: 'Últimos 90 dias', value: '90d', days: 90 },
    { label: 'Último ano', value: '1y', days: 365 },
    { label: 'Todo período', value: 'all', days: 0 },
  ];

  const strategies = [
    'Todas as Estratégias',
    'RSI Strategy',
    'MACD Strategy',
    'Bollinger Bands',
    'Custom Strategy',
  ];

  // Mock performance data
  const generateMetrics = (): PerformanceMetrics => {
    return {
      totalTrades: 156,
      winningTrades: 107,
      losingTrades: 49,
      winRate: 68.6,
      totalPnL: 2450.75,
      totalPnLPercent: 24.51,
      avgWin: 85.30,
      avgLoss: -42.15,
      profitFactor: 1.85,
      maxDrawdown: -820.50,
      maxDrawdownPercent: -8.2,
      sharpeRatio: 1.42,
      sortinoRatio: 1.89,
      calmarRatio: 2.99,
      totalFees: 234.80,
      avgTradeDuration: 145, // minutes
      bestTrade: 425.80,
      worstTrade: -185.20,
      consecutiveWins: 8,
      consecutiveLosses: 4,
    };
  };

  const metrics = generateMetrics();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getMetricColor = (value: number, isPositive: boolean = true) => {
    if (isPositive) {
      return value >= 0 ? 'text-green-600' : 'text-red-600';
    } else {
      return value <= 0 ? 'text-green-600' : 'text-red-600';
    }
  };

  const getPerformanceGrade = () => {
    let score = 0;
    
    // Win rate (0-25 points)
    if (metrics.winRate >= 70) score += 25;
    else if (metrics.winRate >= 60) score += 20;
    else if (metrics.winRate >= 50) score += 15;
    else if (metrics.winRate >= 40) score += 10;
    else score += 5;
    
    // Profit factor (0-25 points)
    if (metrics.profitFactor >= 2) score += 25;
    else if (metrics.profitFactor >= 1.5) score += 20;
    else if (metrics.profitFactor >= 1.2) score += 15;
    else if (metrics.profitFactor >= 1) score += 10;
    else score += 5;
    
    // Sharpe ratio (0-25 points)
    if (metrics.sharpeRatio >= 2) score += 25;
    else if (metrics.sharpeRatio >= 1.5) score += 20;
    else if (metrics.sharpeRatio >= 1) score += 15;
    else if (metrics.sharpeRatio >= 0.5) score += 10;
    else score += 5;
    
    // Max drawdown (0-25 points)
    const drawdownPercent = Math.abs(metrics.maxDrawdownPercent);
    if (drawdownPercent <= 5) score += 25;
    else if (drawdownPercent <= 10) score += 20;
    else if (drawdownPercent <= 15) score += 15;
    else if (drawdownPercent <= 20) score += 10;
    else score += 5;
    
    if (score >= 90) return { grade: 'A+', color: 'text-green-600', description: 'Excelente' };
    if (score >= 80) return { grade: 'A', color: 'text-green-600', description: 'Muito Bom' };
    if (score >= 70) return { grade: 'B+', color: 'text-blue-600', description: 'Bom' };
    if (score >= 60) return { grade: 'B', color: 'text-blue-600', description: 'Satisfatório' };
    if (score >= 50) return { grade: 'C', color: 'text-yellow-600', description: 'Regular' };
    return { grade: 'D', color: 'text-red-600', description: 'Precisa Melhorar' };
  };

  const performanceGrade = getPerformanceGrade();

  return (
    <div className="space-y-6">
      {/* Period and Strategy Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Relatórios de Performance
            </h2>
            <p className="text-gray-600 mt-1">
              Análise detalhada do desempenho das suas estratégias
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {periods.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
            
            <select
              value={selectedStrategy}
              onChange={(e) => setSelectedStrategy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {strategies.map((strategy, index) => (
                <option key={index} value={index === 0 ? 'all' : strategy}>
                  {strategy}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Performance Grade */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-900">
              Avaliação Geral da Performance
            </h3>
            <p className="text-blue-700 mt-1">
              Baseada em win rate, profit factor, Sharpe ratio e drawdown
            </p>
          </div>
          <div className="text-center">
            <div className={`text-4xl font-bold ${performanceGrade.color}`}>
              {performanceGrade.grade}
            </div>
            <div className="text-sm text-gray-600">
              {performanceGrade.description}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-2xl font-bold ${getMetricColor(metrics.totalPnL)}`}>
                {formatCurrency(metrics.totalPnL)}
              </div>
              <div className="text-sm text-gray-500">P&L Total</div>
            </div>
            <div className="text-3xl">💰</div>
          </div>
          <div className={`text-sm mt-2 ${getMetricColor(metrics.totalPnLPercent)}`}>
            {formatPercent(metrics.totalPnLPercent)} de retorno
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {metrics.winRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500">Win Rate</div>
            </div>
            <div className="text-3xl">🎯</div>
          </div>
          <div className="text-sm text-gray-600 mt-2">
            {metrics.winningTrades} vitórias / {metrics.losingTrades} derrotas
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {metrics.profitFactor.toFixed(2)}
              </div>
              <div className="text-sm text-gray-500">Profit Factor</div>
            </div>
            <div className="text-3xl">⚖️</div>
          </div>
          <div className="text-sm text-gray-600 mt-2">
            Lucro bruto / Perda bruta
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-2xl font-bold ${getMetricColor(metrics.maxDrawdown, false)}`}>
                {formatPercent(metrics.maxDrawdownPercent)}
              </div>
              <div className="text-sm text-gray-500">Max Drawdown</div>
            </div>
            <div className="text-3xl">📉</div>
          </div>
          <div className="text-sm text-gray-600 mt-2">
            {formatCurrency(metrics.maxDrawdown)}
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trading Metrics */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Métricas de Trading
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total de Trades</span>
              <span className="font-medium">{metrics.totalTrades}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Trades Vencedores</span>
              <span className="font-medium text-green-600">{metrics.winningTrades}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Trades Perdedores</span>
              <span className="font-medium text-red-600">{metrics.losingTrades}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Lucro Médio</span>
              <span className="font-medium text-green-600">{formatCurrency(metrics.avgWin)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Perda Média</span>
              <span className="font-medium text-red-600">{formatCurrency(metrics.avgLoss)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Melhor Trade</span>
              <span className="font-medium text-green-600">{formatCurrency(metrics.bestTrade)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Pior Trade</span>
              <span className="font-medium text-red-600">{formatCurrency(metrics.worstTrade)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Duração Média</span>
              <span className="font-medium">{formatDuration(metrics.avgTradeDuration)}</span>
            </div>
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Métricas de Risco
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Sharpe Ratio</span>
              <span className="font-medium">{metrics.sharpeRatio.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Sortino Ratio</span>
              <span className="font-medium">{metrics.sortinoRatio.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Calmar Ratio</span>
              <span className="font-medium">{metrics.calmarRatio.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Vitórias Consecutivas</span>
              <span className="font-medium text-green-600">{metrics.consecutiveWins}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Derrotas Consecutivas</span>
              <span className="font-medium text-red-600">{metrics.consecutiveLosses}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total em Taxas</span>
              <span className="font-medium text-gray-900">{formatCurrency(metrics.totalFees)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">P&L Líquido</span>
              <span className={`font-medium ${getMetricColor(metrics.totalPnL - metrics.totalFees)}`}>
                {formatCurrency(metrics.totalPnL - metrics.totalFees)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Analysis */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Análise de Performance
        </h3>
        
        <div className="space-y-4 text-sm">
          <div className="flex items-start space-x-2">
            <span className="text-lg">
              {metrics.winRate >= 60 ? '✅' : metrics.winRate >= 50 ? '⚠️' : '❌'}
            </span>
            <div>
              <span className="font-medium">Win Rate: </span>
              <span>
                {metrics.winRate >= 60 
                  ? `Excelente win rate de ${metrics.winRate.toFixed(1)}%. Estratégia consistente.`
                  : metrics.winRate >= 50
                  ? `Win rate equilibrado de ${metrics.winRate.toFixed(1)}%. Considere otimizações.`
                  : `Win rate baixo de ${metrics.winRate.toFixed(1)}%. Necessita revisão urgente.`
                }
              </span>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <span className="text-lg">
              {metrics.profitFactor >= 1.5 ? '✅' : metrics.profitFactor >= 1.2 ? '⚠️' : '❌'}
            </span>
            <div>
              <span className="font-medium">Profit Factor: </span>
              <span>
                {metrics.profitFactor >= 1.5
                  ? `Excelente profit factor de ${metrics.profitFactor.toFixed(2)}. Lucros superam perdas significativamente.`
                  : metrics.profitFactor >= 1.2
                  ? `Profit factor aceitável de ${metrics.profitFactor.toFixed(2)}. Há espaço para melhorias.`
                  : `Profit factor baixo de ${metrics.profitFactor.toFixed(2)}. Perdas muito próximas aos lucros.`
                }
              </span>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <span className="text-lg">
              {Math.abs(metrics.maxDrawdownPercent) <= 10 ? '✅' : Math.abs(metrics.maxDrawdownPercent) <= 20 ? '⚠️' : '❌'}
            </span>
            <div>
              <span className="font-medium">Drawdown: </span>
              <span>
                {Math.abs(metrics.maxDrawdownPercent) <= 10
                  ? `Drawdown controlado de ${formatPercent(metrics.maxDrawdownPercent)}. Risco bem gerenciado.`
                  : Math.abs(metrics.maxDrawdownPercent) <= 20
                  ? `Drawdown moderado de ${formatPercent(metrics.maxDrawdownPercent)}. Monitore o risco.`
                  : `Drawdown elevado de ${formatPercent(metrics.maxDrawdownPercent)}. Risco alto, considere reduzir exposição.`
                }
              </span>
            </div>
          </div>

          <div className="flex items-start space-x-2">
            <span className="text-lg">
              {metrics.sharpeRatio >= 1.5 ? '✅' : metrics.sharpeRatio >= 1 ? '⚠️' : '❌'}
            </span>
            <div>
              <span className="font-medium">Sharpe Ratio: </span>
              <span>
                {metrics.sharpeRatio >= 1.5
                  ? `Excelente relação risco/retorno com Sharpe de ${metrics.sharpeRatio.toFixed(2)}.`
                  : metrics.sharpeRatio >= 1
                  ? `Relação risco/retorno aceitável com Sharpe de ${metrics.sharpeRatio.toFixed(2)}.`
                  : `Relação risco/retorno baixa com Sharpe de ${metrics.sharpeRatio.toFixed(2)}. Alta volatilidade.`
                }
              </span>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Recomendações</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            {metrics.winRate < 50 && (
              <li>• Revise os critérios de entrada das estratégias para melhorar o win rate</li>
            )}
            {metrics.profitFactor < 1.2 && (
              <li>• Otimize os pontos de take profit e stop loss para melhorar o profit factor</li>
            )}
            {Math.abs(metrics.maxDrawdownPercent) > 15 && (
              <li>• Implemente controles de risco mais rigorosos para reduzir o drawdown</li>
            )}
            {metrics.sharpeRatio < 1 && (
              <li>• Considere diversificar estratégias para reduzir a volatilidade</li>
            )}
            {metrics.totalFees / Math.abs(metrics.totalPnL) > 0.1 && (
              <li>• Analise a frequência de trades para otimizar custos com taxas</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};