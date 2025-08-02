import React, { useState } from 'react';
import { BacktestResult } from './BacktestPage';

interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  duration: number; // in minutes
  signal: string;
}

interface TradesListProps {
  result: BacktestResult;
}

export const TradesList: React.FC<TradesListProps> = ({ result }) => {
  const [filter, setFilter] = useState<'all' | 'winners' | 'losers'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'pnl' | 'duration'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Generate mock trades data
  const generateTrades = (): Trade[] => {
    const trades: Trade[] = [];
    const symbols = [result.symbol];
    const signals = ['RSI Oversold', 'RSI Overbought', 'MACD Cross', 'Support Bounce'];
    
    for (let i = 0; i < result.totalTrades; i++) {
      const isWinner = Math.random() < (result.winRate / 100);
      const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const entryPrice = 40000 + (Math.random() - 0.5) * 10000;
      const pnlPercent = isWinner 
        ? Math.random() * 8 + 1 // 1-9% gain
        : -(Math.random() * 5 + 0.5); // 0.5-5.5% loss
      const exitPrice = entryPrice * (1 + pnlPercent / 100);
      const quantity = 0.1 + Math.random() * 0.9; // 0.1-1.0
      const pnl = (exitPrice - entryPrice) * quantity;
      
      const entryTime = new Date(2023, 0, 1 + i * 2);
      const duration = 30 + Math.random() * 240; // 30-270 minutes
      const exitTime = new Date(entryTime.getTime() + duration * 60000);

      trades.push({
        id: (i + 1).toString(),
        symbol: symbols[0],
        side,
        entryTime: entryTime.toISOString(),
        exitTime: exitTime.toISOString(),
        entryPrice,
        exitPrice,
        quantity,
        pnl,
        pnlPercent,
        duration,
        signal: signals[Math.floor(Math.random() * signals.length)],
      });
    }

    return trades;
  };

  const trades = generateTrades();

  const filteredTrades = trades.filter(trade => {
    if (filter === 'winners') return trade.pnl > 0;
    if (filter === 'losers') return trade.pnl < 0;
    return true;
  });

  const sortedTrades = [...filteredTrades].sort((a, b) => {
    let aValue: number;
    let bValue: number;

    switch (sortBy) {
      case 'pnl':
        aValue = a.pnl;
        bValue = b.pnl;
        break;
      case 'duration':
        aValue = a.duration;
        bValue = b.duration;
        break;
      default:
        aValue = new Date(a.entryTime).getTime();
        bValue = new Date(b.entryTime).getTime();
    }

    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
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

  return (
    <div className="space-y-4">
      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div className="flex space-x-2">
          {[
            { id: 'all', label: 'Todos', count: trades.length },
            { id: 'winners', label: 'Vencedores', count: trades.filter(t => t.pnl > 0).length },
            { id: 'losers', label: 'Perdedores', count: trades.filter(t => t.pnl < 0).length },
          ].map((filterOption) => (
            <button
              key={filterOption.id}
              onClick={() => setFilter(filterOption.id as any)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === filterOption.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filterOption.label} ({filterOption.count})
            </button>
          ))}
        </div>

        <div className="text-sm text-gray-600">
          Mostrando {sortedTrades.length} de {trades.length} trades
        </div>
      </div>

      {/* Trades Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Símbolo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lado
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('date')}
                >
                  Entrada {getSortIcon('date')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Saída
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Preços
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('pnl')}
                >
                  P&L {getSortIcon('pnl')}
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('duration')}
                >
                  Duração {getSortIcon('duration')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sinal
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTrades.map((trade) => (
                <tr key={trade.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    #{trade.id}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {trade.symbol}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      trade.side === 'BUY' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {trade.side}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDateTime(trade.entryTime)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDateTime(trade.exitTime)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>{formatCurrency(trade.entryPrice)}</div>
                    <div className="text-xs text-gray-500">→ {formatCurrency(trade.exitPrice)}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${
                      trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(trade.pnl)}
                    </div>
                    <div className={`text-xs ${
                      trade.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatPercent(trade.pnlPercent)}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDuration(trade.duration)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {trade.signal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedTrades.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-2">📊</div>
            <div>Nenhum trade encontrado com os filtros aplicados</div>
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-lg font-bold text-green-600">
            {trades.filter(t => t.pnl > 0).length}
          </div>
          <div className="text-sm text-gray-600">Trades Vencedores</div>
          <div className="text-xs text-gray-500">
            {formatCurrency(trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0))}
          </div>
        </div>

        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-lg font-bold text-red-600">
            {trades.filter(t => t.pnl < 0).length}
          </div>
          <div className="text-sm text-gray-600">Trades Perdedores</div>
          <div className="text-xs text-gray-500">
            {formatCurrency(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0))}
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-lg font-bold text-blue-600">
            {formatDuration(trades.reduce((sum, t) => sum + t.duration, 0) / trades.length)}
          </div>
          <div className="text-sm text-gray-600">Duração Média</div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-lg font-bold text-purple-600">
            {formatCurrency(trades.reduce((sum, t) => sum + Math.abs(t.pnl), 0) / trades.length)}
          </div>
          <div className="text-sm text-gray-600">P&L Médio</div>
        </div>
      </div>
    </div>
  );
};