import React, { useState } from 'react';
import { BacktestResult } from './BacktestPage';

interface BacktestHistoryProps {
  onViewResult: (result: BacktestResult) => void;
  onNewBacktest: () => void;
}

export const BacktestHistory: React.FC<BacktestHistoryProps> = ({
  onViewResult,
  onNewBacktest,
}) => {
  const [sortBy, setSortBy] = useState<'date' | 'return' | 'trades'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterStrategy, setFilterStrategy] = useState<string>('all');

  // Mock historical backtest results
  const backtestHistory: BacktestResult[] = [
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
    {
      id: '4',
      strategyName: 'RSI Oversold/Overbought',
      symbol: 'BNBUSDT',
      period: '2023-03-01 - 2023-08-31',
      totalReturn: 1125.80,
      totalReturnPercent: 11.26,
      totalTrades: 134,
      winRate: 62.7,
      profitFactor: 1.45,
      maxDrawdown: -9.8,
      sharpeRatio: 1.12,
      sortinoRatio: 1.48,
      calmarRatio: 1.15,
      trades: [],
      equityCurve: [],
      createdAt: '2024-01-12T14:20:00Z',
    },
    {
      id: '5',
      strategyName: 'MACD Crossover',
      symbol: 'SOLUSDT',
      period: '2023-01-01 - 2023-06-30',
      totalReturn: 3250.40,
      totalReturnPercent: 32.50,
      totalTrades: 78,
      winRate: 76.9,
      profitFactor: 2.89,
      maxDrawdown: -6.2,
      sharpeRatio: 2.15,
      sortinoRatio: 2.87,
      calmarRatio: 5.24,
      trades: [],
      equityCurve: [],
      createdAt: '2024-01-11T11:10:00Z',
    },
  ];

  const strategies = Array.from(new Set(backtestHistory.map(b => b.strategyName)));

  const filteredResults = backtestHistory.filter(result => 
    filterStrategy === 'all' || result.strategyName === filterStrategy
  );

  const sortedResults = [...filteredResults].sort((a, b) => {
    let aValue: number;
    let bValue: number;

    switch (sortBy) {
      case 'return':
        aValue = a.totalReturnPercent;
        bValue = b.totalReturnPercent;
        break;
      case 'trades':
        aValue = a.totalTrades;
        bValue = b.totalTrades;
        break;
      default:
        aValue = new Date(a.createdAt).getTime();
        bValue = new Date(b.createdAt).getTime();
    }

    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getSortIcon = (field: typeof sortBy) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const getPerformanceColor = (value: number) => {
    return value >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getPerformanceIcon = (value: number) => {
    return value >= 0 ? '📈' : '📉';
  };

  const handleDeleteBacktest = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este backtest?')) {
      // TODO: Implement delete logic
      console.log('Delete backtest:', id);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-gray-900">
            {backtestHistory.length}
          </div>
          <div className="text-sm text-gray-500">Total de Backtests</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-green-600">
            {backtestHistory.filter(b => b.totalReturnPercent > 0).length}
          </div>
          <div className="text-sm text-gray-500">Backtests Lucrativos</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-blue-600">
            {formatPercent(
              backtestHistory.reduce((sum, b) => sum + b.totalReturnPercent, 0) / backtestHistory.length
            )}
          </div>
          <div className="text-sm text-gray-500">Retorno Médio</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-purple-600">
            {Math.round(backtestHistory.reduce((sum, b) => sum + b.totalTrades, 0) / backtestHistory.length)}
          </div>
          <div className="text-sm text-gray-500">Trades Médios</div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtrar por Estratégia
              </label>
              <select
                value={filterStrategy}
                onChange={(e) => setFilterStrategy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas as Estratégias</option>
                {strategies.map((strategy) => (
                  <option key={strategy} value={strategy}>
                    {strategy}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={onNewBacktest}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
          >
            + Novo Backtest
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Histórico de Backtests
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
                  Símbolo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Período
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('return')}
                >
                  Retorno {getSortIcon('return')}
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('trades')}
                >
                  Trades {getSortIcon('trades')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Win Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sharpe
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('date')}
                >
                  Data {getSortIcon('date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedResults.map((result) => (
                <tr key={result.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {result.strategyName}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {result.symbol}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {result.period}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getPerformanceIcon(result.totalReturnPercent)}</span>
                      <div>
                        <div className={`text-sm font-medium ${getPerformanceColor(result.totalReturn)}`}>
                          {formatCurrency(result.totalReturn)}
                        </div>
                        <div className={`text-xs ${getPerformanceColor(result.totalReturnPercent)}`}>
                          {formatPercent(result.totalReturnPercent)}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {result.totalTrades}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {result.winRate.toFixed(1)}%
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {result.sharpeRatio.toFixed(2)}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(result.createdAt)}
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => onViewResult(result)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Ver
                      </button>
                      <button
                        onClick={() => handleDeleteBacktest(result.id)}
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

        {sortedResults.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-2">📊</div>
            <div className="text-sm mb-4">Nenhum backtest encontrado</div>
            <button
              onClick={onNewBacktest}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              Executar Primeiro Backtest
            </button>
          </div>
        )}
      </div>
    </div>
  );
};