import React from 'react';
import { BacktestResult } from './BacktestPage';

interface MetricsBreakdownProps {
  result: BacktestResult;
}

export const MetricsBreakdown: React.FC<MetricsBreakdownProps> = ({ result }) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const getMetricColor = (value: number, thresholds: { good: number; bad: number }) => {
    if (value >= thresholds.good) return 'text-green-600';
    if (value <= thresholds.bad) return 'text-red-600';
    return 'text-yellow-600';
  };

  const getMetricIcon = (value: number, thresholds: { good: number; bad: number }) => {
    if (value >= thresholds.good) return '✅';
    if (value <= thresholds.bad) return '❌';
    return '⚠️';
  };

  const metrics = [
    {
      category: 'Retorno e Rentabilidade',
      items: [
        {
          name: 'Retorno Total',
          value: formatCurrency(result.totalReturn),
          description: 'Lucro ou prejuízo absoluto do período',
          color: result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600',
          icon: result.totalReturn >= 0 ? '📈' : '📉',
        },
        {
          name: 'Retorno Percentual',
          value: formatPercent(result.totalReturnPercent),
          description: 'Percentual de retorno sobre o capital inicial',
          color: result.totalReturnPercent >= 0 ? 'text-green-600' : 'text-red-600',
          icon: result.totalReturnPercent >= 0 ? '📈' : '📉',
        },
        {
          name: 'Retorno Anualizado',
          value: formatPercent(result.totalReturnPercent * (365 / 365)), // Assuming 1 year period
          description: 'Retorno projetado para um ano completo',
          color: getMetricColor(result.totalReturnPercent, { good: 15, bad: 0 }),
          icon: getMetricIcon(result.totalReturnPercent, { good: 15, bad: 0 }),
        },
      ],
    },
    {
      category: 'Análise de Risco',
      items: [
        {
          name: 'Máximo Drawdown',
          value: formatPercent(result.maxDrawdown),
          description: 'Maior perda consecutiva durante o período',
          color: getMetricColor(-Math.abs(result.maxDrawdown), { good: -5, bad: -20 }),
          icon: getMetricIcon(-Math.abs(result.maxDrawdown), { good: -5, bad: -20 }),
        },
        {
          name: 'Sharpe Ratio',
          value: result.sharpeRatio.toFixed(2),
          description: 'Retorno ajustado ao risco (>1 é bom, >2 é excelente)',
          color: getMetricColor(result.sharpeRatio, { good: 1.5, bad: 0.5 }),
          icon: getMetricIcon(result.sharpeRatio, { good: 1.5, bad: 0.5 }),
        },
        {
          name: 'Sortino Ratio',
          value: result.sortinoRatio.toFixed(2),
          description: 'Similar ao Sharpe, mas considera apenas volatilidade negativa',
          color: getMetricColor(result.sortinoRatio, { good: 2, bad: 1 }),
          icon: getMetricIcon(result.sortinoRatio, { good: 2, bad: 1 }),
        },
        {
          name: 'Calmar Ratio',
          value: result.calmarRatio.toFixed(2),
          description: 'Retorno anual dividido pelo máximo drawdown',
          color: getMetricColor(result.calmarRatio, { good: 3, bad: 1 }),
          icon: getMetricIcon(result.calmarRatio, { good: 3, bad: 1 }),
        },
      ],
    },
    {
      category: 'Análise de Trades',
      items: [
        {
          name: 'Total de Trades',
          value: result.totalTrades.toString(),
          description: 'Número total de operações executadas',
          color: getMetricColor(result.totalTrades, { good: 100, bad: 20 }),
          icon: getMetricIcon(result.totalTrades, { good: 100, bad: 20 }),
        },
        {
          name: 'Win Rate',
          value: `${result.winRate.toFixed(1)}%`,
          description: 'Percentual de trades vencedores',
          color: getMetricColor(result.winRate, { good: 60, bad: 40 }),
          icon: getMetricIcon(result.winRate, { good: 60, bad: 40 }),
        },
        {
          name: 'Profit Factor',
          value: result.profitFactor.toFixed(2),
          description: 'Lucro bruto dividido pela perda bruta (>1.5 é bom)',
          color: getMetricColor(result.profitFactor, { good: 1.5, bad: 1 }),
          icon: getMetricIcon(result.profitFactor, { good: 1.5, bad: 1 }),
        },
        {
          name: 'Trades Vencedores',
          value: Math.round(result.totalTrades * (result.winRate / 100)).toString(),
          description: 'Número absoluto de trades com lucro',
          color: 'text-green-600',
          icon: '✅',
        },
        {
          name: 'Trades Perdedores',
          value: Math.round(result.totalTrades * (1 - result.winRate / 100)).toString(),
          description: 'Número absoluto de trades com prejuízo',
          color: 'text-red-600',
          icon: '❌',
        },
      ],
    },
    {
      category: 'Métricas Calculadas',
      items: [
        {
          name: 'Lucro Médio por Trade',
          value: formatCurrency(result.totalReturn / result.totalTrades),
          description: 'Resultado médio por operação',
          color: result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600',
          icon: result.totalReturn >= 0 ? '📈' : '📉',
        },
        {
          name: 'Trades por Mês',
          value: (result.totalTrades / 12).toFixed(1),
          description: 'Frequência média de operações mensais',
          color: 'text-blue-600',
          icon: '📊',
        },
        {
          name: 'Expectativa Matemática',
          value: formatCurrency((result.totalReturn / result.totalTrades) || 0),
          description: 'Valor esperado por trade baseado no histórico',
          color: result.totalReturn >= 0 ? 'text-green-600' : 'text-red-600',
          icon: '🎯',
        },
        {
          name: 'Recovery Factor',
          value: (Math.abs(result.totalReturn / result.maxDrawdown) || 0).toFixed(2),
          description: 'Capacidade de recuperação após perdas',
          color: getMetricColor(Math.abs(result.totalReturn / result.maxDrawdown), { good: 3, bad: 1 }),
          icon: getMetricIcon(Math.abs(result.totalReturn / result.maxDrawdown), { good: 3, bad: 1 }),
        },
      ],
    },
  ];

  return (
    <div className="space-y-8">
      {metrics.map((category) => (
        <div key={category.category}>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {category.category}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {category.items.map((metric) => (
              <div
                key={metric.name}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{metric.icon}</span>
                    <h4 className="font-medium text-gray-900">{metric.name}</h4>
                  </div>
                </div>
                
                <div className={`text-2xl font-bold mb-2 ${metric.color}`}>
                  {metric.value}
                </div>
                
                <p className="text-sm text-gray-600">
                  {metric.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Overall Assessment */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">
          Avaliação Geral da Estratégia
        </h3>
        
        <div className="space-y-3 text-sm">
          {/* Performance Assessment */}
          <div className="flex items-start space-x-2">
            <span className="text-lg">
              {result.totalReturnPercent > 15 ? '🌟' : result.totalReturnPercent > 0 ? '👍' : '👎'}
            </span>
            <div>
              <span className="font-medium text-blue-900">Performance: </span>
              <span className="text-blue-800">
                {result.totalReturnPercent > 15 
                  ? 'Excelente - Retorno superior a 15%'
                  : result.totalReturnPercent > 5
                  ? 'Boa - Retorno positivo consistente'
                  : result.totalReturnPercent > 0
                  ? 'Moderada - Retorno positivo baixo'
                  : 'Ruim - Retorno negativo'
                }
              </span>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="flex items-start space-x-2">
            <span className="text-lg">
              {Math.abs(result.maxDrawdown) < 10 ? '🛡️' : Math.abs(result.maxDrawdown) < 20 ? '⚠️' : '🚨'}
            </span>
            <div>
              <span className="font-medium text-blue-900">Risco: </span>
              <span className="text-blue-800">
                {Math.abs(result.maxDrawdown) < 10
                  ? 'Baixo - Drawdown controlado'
                  : Math.abs(result.maxDrawdown) < 20
                  ? 'Moderado - Drawdown aceitável'
                  : 'Alto - Drawdown elevado'
                }
              </span>
            </div>
          </div>

          {/* Consistency Assessment */}
          <div className="flex items-start space-x-2">
            <span className="text-lg">
              {result.winRate > 60 ? '🎯' : result.winRate > 50 ? '⚖️' : '🎲'}
            </span>
            <div>
              <span className="font-medium text-blue-900">Consistência: </span>
              <span className="text-blue-800">
                {result.winRate > 60
                  ? 'Alta - Win rate superior a 60%'
                  : result.winRate > 50
                  ? 'Moderada - Win rate equilibrado'
                  : 'Baixa - Win rate abaixo de 50%'
                }
              </span>
            </div>
          </div>

          {/* Overall Recommendation */}
          <div className="mt-4 p-3 bg-white rounded-lg border border-blue-200">
            <div className="flex items-start space-x-2">
              <span className="text-lg">💡</span>
              <div>
                <span className="font-medium text-blue-900">Recomendação: </span>
                <span className="text-blue-800">
                  {result.totalReturnPercent > 10 && result.sharpeRatio > 1.5 && Math.abs(result.maxDrawdown) < 15
                    ? 'Estratégia recomendada para uso em produção com capital real.'
                    : result.totalReturnPercent > 0 && result.sharpeRatio > 1
                    ? 'Estratégia promissora, considere otimizar parâmetros antes do uso.'
                    : 'Estratégia precisa de ajustes significativos antes do uso em produção.'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};