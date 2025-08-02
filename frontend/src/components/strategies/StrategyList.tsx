import React, { useState } from 'react';

interface Strategy {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'paused';
  symbol: string;
  pnl: number;
  pnlPercent: number;
  trades: number;
  winRate: number;
  createdAt: string;
  lastSignal: string | null;
}

interface StrategyListProps {
  onCreateStrategy: () => void;
  onEditStrategy: (strategyId: string) => void;
}

export const StrategyList: React.FC<StrategyListProps> = ({
  onCreateStrategy,
  onEditStrategy,
}) => {
  const [strategies] = useState<Strategy[]>([
    {
      id: '1',
      name: 'RSI Oversold/Overbought',
      type: 'RSI Strategy',
      status: 'active',
      symbol: 'BTCUSDT',
      pnl: 1250.50,
      pnlPercent: 8.5,
      trades: 45,
      winRate: 73.3,
      createdAt: '2024-01-10',
      lastSignal: '2024-01-15 18:30:00',
    },
    {
      id: '2',
      name: 'MACD Crossover',
      type: 'MACD Strategy',
      status: 'active',
      symbol: 'ETHUSDT',
      pnl: 890.25,
      pnlPercent: 5.2,
      trades: 32,
      winRate: 68.8,
      createdAt: '2024-01-12',
      lastSignal: '2024-01-15 17:45:00',
    },
    {
      id: '3',
      name: 'Bollinger Bands Mean Reversion',
      type: 'Bollinger Bands',
      status: 'paused',
      symbol: 'ADAUSDT',
      pnl: -125.75,
      pnlPercent: -2.1,
      trades: 18,
      winRate: 44.4,
      createdAt: '2024-01-14',
      lastSignal: null,
    },
    {
      id: '4',
      name: 'Multi-Timeframe Momentum',
      type: 'Custom Strategy',
      status: 'inactive',
      symbol: 'BNBUSDT',
      pnl: 0,
      pnlPercent: 0,
      trades: 0,
      winRate: 0,
      createdAt: '2024-01-15',
      lastSignal: null,
    },
  ]);

  const getStatusColor = (status: Strategy['status']) => {
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

  const getStatusIcon = (status: Strategy['status']) => {
    switch (status) {
      case 'active':
        return '🟢';
      case 'paused':
        return '⏸️';
      case 'inactive':
        return '⏹️';
      default:
        return '⚪';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const handleToggleStrategy = (strategyId: string, currentStatus: Strategy['status']) => {
    // TODO: Implement strategy toggle logic
    console.log(`Toggle strategy ${strategyId} from ${currentStatus}`);
  };

  const handleDeleteStrategy = (strategyId: string) => {
    // TODO: Implement strategy deletion logic
    if (window.confirm('Tem certeza que deseja excluir esta estratégia?')) {
      console.log(`Delete strategy ${strategyId}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-gray-900">
            {strategies.length}
          </div>
          <div className="text-sm text-gray-500">Total de Estratégias</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-green-600">
            {strategies.filter(s => s.status === 'active').length}
          </div>
          <div className="text-sm text-gray-500">Estratégias Ativas</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-blue-600">
            {formatCurrency(strategies.reduce((sum, s) => sum + s.pnl, 0))}
          </div>
          <div className="text-sm text-gray-500">P&L Total</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-purple-600">
            {strategies.reduce((sum, s) => sum + s.trades, 0)}
          </div>
          <div className="text-sm text-gray-500">Total de Trades</div>
        </div>
      </div>

      {/* Strategies Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Suas Estratégias
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estratégia
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Símbolo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  P&L
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trades
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Win Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Último Sinal
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {strategies.map((strategy) => (
                <tr key={strategy.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {strategy.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {strategy.type} • Criada em {formatDate(strategy.createdAt)}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{getStatusIcon(strategy.status)}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(strategy.status)}`}>
                        {strategy.status.toUpperCase()}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {strategy.symbol}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${
                      strategy.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(strategy.pnl)}
                    </div>
                    <div className={`text-xs ${
                      strategy.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatPercent(strategy.pnlPercent)}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {strategy.trades}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {strategy.winRate.toFixed(1)}%
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {strategy.lastSignal ? formatDateTime(strategy.lastSignal) : 'Nenhum'}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onEditStrategy(strategy.id)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Editar
                      </button>
                      
                      <button
                        onClick={() => handleToggleStrategy(strategy.id, strategy.status)}
                        className={`${
                          strategy.status === 'active' 
                            ? 'text-yellow-600 hover:text-yellow-900' 
                            : 'text-green-600 hover:text-green-900'
                        }`}
                      >
                        {strategy.status === 'active' ? 'Pausar' : 'Ativar'}
                      </button>
                      
                      <button
                        onClick={() => handleDeleteStrategy(strategy.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {strategies.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-2">🎯</div>
            <div className="text-sm mb-4">Nenhuma estratégia criada ainda</div>
            <button
              onClick={onCreateStrategy}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              Criar Primeira Estratégia
            </button>
          </div>
        )}
      </div>
    </div>
  );
};