import React, { useState, useEffect } from 'react';

interface StrategyEditorProps {
  strategyId: string | null;
  onBack: () => void;
}

interface StrategyData {
  id: string;
  name: string;
  description: string;
  symbol: string;
  timeframe: string;
  status: 'active' | 'inactive' | 'paused';
  parameters: Record<string, any>;
  performance: {
    totalTrades: number;
    winRate: number;
    pnl: number;
    pnlPercent: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
}

export const StrategyEditor: React.FC<StrategyEditorProps> = ({
  strategyId,
  onBack,
}) => {
  const [strategy, setStrategy] = useState<StrategyData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'parameters' | 'performance' | 'logs'>('overview');

  useEffect(() => {
    // Mock data - will be replaced with API call
    if (strategyId) {
      setStrategy({
        id: strategyId,
        name: 'RSI Oversold/Overbought',
        description: 'Estratégia baseada no indicador RSI para identificar condições de sobrecompra e sobrevenda',
        symbol: 'BTCUSDT',
        timeframe: '1h',
        status: 'active',
        parameters: {
          rsiPeriod: 14,
          oversoldLevel: 30,
          overboughtLevel: 70,
          stopLoss: 2.0,
          takeProfit: 4.0,
          maxPositionSize: 1000,
        },
        performance: {
          totalTrades: 45,
          winRate: 73.3,
          pnl: 1250.50,
          pnlPercent: 8.5,
          maxDrawdown: -3.2,
          sharpeRatio: 1.8,
        },
      });
    }
  }, [strategyId]);

  const handleSave = () => {
    // TODO: Implement save logic
    console.log('Saving strategy:', strategy);
    setIsEditing(false);
  };

  const handleToggleStatus = () => {
    if (strategy) {
      const newStatus = strategy.status === 'active' ? 'paused' : 'active';
      setStrategy({ ...strategy, status: newStatus });
    }
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

  if (!strategy) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <div className="mt-4 text-gray-600">Carregando estratégia...</div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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
              <h1 className="text-2xl font-bold text-gray-900">
                {strategy.name}
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(strategy.status)}`}>
                  {strategy.status.toUpperCase()}
                </span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-600">{strategy.symbol}</span>
                <span className="text-gray-500">•</span>
                <span className="text-gray-600">{strategy.timeframe}</span>
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleToggleStatus}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                strategy.status === 'active'
                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-800 hover:bg-green-200'
              }`}
            >
              {strategy.status === 'active' ? 'Pausar' : 'Ativar'}
            </button>
            
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
            >
              {isEditing ? 'Cancelar' : 'Editar'}
            </button>
            
            {isEditing && (
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
              >
                Salvar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Visão Geral' },
              { id: 'parameters', label: 'Parâmetros' },
              { id: 'performance', label: 'Performance' },
              { id: 'logs', label: 'Logs' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Descrição</h3>
                {isEditing ? (
                  <textarea
                    value={strategy.description}
                    onChange={(e) => setStrategy({ ...strategy, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <p className="text-gray-600">{strategy.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {strategy.performance.totalTrades}
                  </div>
                  <div className="text-sm text-gray-500">Total de Trades</div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-600">
                    {strategy.performance.winRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">Win Rate</div>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className={`text-2xl font-bold ${
                    strategy.performance.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(strategy.performance.pnl)}
                  </div>
                  <div className="text-sm text-gray-500">P&L Total</div>
                </div>
              </div>
            </div>
          )}

          {/* Parameters Tab */}
          {activeTab === 'parameters' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Parâmetros da Estratégia</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(strategy.parameters).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => setStrategy({
                          ...strategy,
                          parameters: {
                            ...strategy.parameters,
                            [key]: parseFloat(e.target.value),
                          },
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        step="0.1"
                      />
                    ) : (
                      <div className="px-3 py-2 bg-gray-50 rounded-md text-gray-900">
                        {value}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Métricas de Performance</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-600">
                    {formatPercent(strategy.performance.pnlPercent)}
                  </div>
                  <div className="text-sm text-gray-600">Retorno Total</div>
                </div>
                
                <div className="bg-red-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-red-600">
                    {formatPercent(strategy.performance.maxDrawdown)}
                  </div>
                  <div className="text-sm text-gray-600">Max Drawdown</div>
                </div>
                
                <div className="bg-purple-50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-600">
                    {strategy.performance.sharpeRatio.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600">Sharpe Ratio</div>
                </div>
              </div>

              {/* Performance Chart Placeholder */}
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <div className="text-gray-500">
                  📈 Gráfico de Performance
                </div>
                <div className="text-sm text-gray-400 mt-2">
                  Gráfico detalhado será implementado aqui
                </div>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Logs da Estratégia</h3>
              
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <div className="text-gray-500">
                  📝 Logs da Estratégia
                </div>
                <div className="text-sm text-gray-400 mt-2">
                  Histórico de execução e sinais será exibido aqui
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};