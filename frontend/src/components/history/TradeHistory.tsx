import React, { useState } from 'react';
import { AdvancedFilters } from './AdvancedFilters';
import { PaginationControls } from './PaginationControls';

interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  strategy: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  pnlPercent: number;
  fees: number;
  duration: number;
  status: 'completed' | 'cancelled' | 'failed';
  signal: string;
  notes?: string;
}

interface FilterState {
  dateRange: {
    start: string;
    end: string;
  };
  symbols: string[];
  strategies: string[];
  status: string[];
  pnlRange: {
    min: number | null;
    max: number | null;
  };
  sortBy: 'date' | 'pnl' | 'duration' | 'symbol';
  sortOrder: 'asc' | 'desc';
}

export const TradeHistory: React.FC = () => {
  const [filters, setFilters] = useState<FilterState>({
    dateRange: {
      start: '',
      end: '',
    },
    symbols: [],
    strategies: [],
    status: [],
    pnlRange: {
      min: null,
      max: null,
    },
    sortBy: 'date',
    sortOrder: 'desc',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showFilters, setShowFilters] = useState(false);

  // Mock trade data
  const generateTrades = (): Trade[] => {
    const trades: Trade[] = [];
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'BNBUSDT', 'SOLUSDT'];
    const strategies = ['RSI Strategy', 'MACD Strategy', 'Bollinger Bands', 'Custom Strategy'];
    const signals = ['Oversold', 'Overbought', 'Bullish Cross', 'Bearish Cross', 'Support Bounce'];
    const statuses: Trade['status'][] = ['completed', 'cancelled', 'failed'];

    for (let i = 0; i < 250; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const strategy = strategies[Math.floor(Math.random() * strategies.length)];
      const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const status = i < 230 ? 'completed' : statuses[Math.floor(Math.random() * statuses.length)];
      
      const entryPrice = 40000 + (Math.random() - 0.5) * 20000;
      const pnlPercent = status === 'completed' 
        ? (Math.random() - 0.4) * 10 // -4% to +6%
        : status === 'cancelled' ? 0 : -Math.random() * 2; // Failed trades lose money
      
      const exitPrice = status === 'completed' 
        ? entryPrice * (1 + pnlPercent / 100)
        : status === 'cancelled' ? entryPrice : entryPrice * 0.98;
      
      const quantity = 0.1 + Math.random() * 0.9;
      const pnl = status === 'completed' 
        ? (exitPrice - entryPrice) * quantity
        : status === 'cancelled' ? -5 : -Math.random() * 50; // Fees for cancelled, loss for failed
      
      const entryTime = new Date(2023, 0, 1 + i);
      const duration = 30 + Math.random() * 480; // 30 minutes to 8 hours
      const exitTime = new Date(entryTime.getTime() + duration * 60000);

      trades.push({
        id: (i + 1).toString(),
        symbol,
        side,
        strategy,
        entryTime: entryTime.toISOString(),
        exitTime: exitTime.toISOString(),
        entryPrice,
        exitPrice,
        quantity,
        pnl,
        pnlPercent,
        fees: Math.random() * 10 + 2,
        duration,
        status,
        signal: signals[Math.floor(Math.random() * signals.length)],
        notes: Math.random() > 0.8 ? 'Manual override applied' : undefined,
      });
    }

    return trades.reverse(); // Most recent first
  };

  const allTrades = generateTrades();

  // Apply filters
  const filteredTrades = allTrades.filter(trade => {
    // Date range filter
    if (filters.dateRange.start && new Date(trade.entryTime) < new Date(filters.dateRange.start)) {
      return false;
    }
    if (filters.dateRange.end && new Date(trade.entryTime) > new Date(filters.dateRange.end)) {
      return false;
    }

    // Symbol filter
    if (filters.symbols.length > 0 && !filters.symbols.includes(trade.symbol)) {
      return false;
    }

    // Strategy filter
    if (filters.strategies.length > 0 && !filters.strategies.includes(trade.strategy)) {
      return false;
    }

    // Status filter
    if (filters.status.length > 0 && !filters.status.includes(trade.status)) {
      return false;
    }

    // P&L range filter
    if (filters.pnlRange.min !== null && trade.pnl < filters.pnlRange.min) {
      return false;
    }
    if (filters.pnlRange.max !== null && trade.pnl > filters.pnlRange.max) {
      return false;
    }

    return true;
  });

  // Apply sorting
  const sortedTrades = [...filteredTrades].sort((a, b) => {
    let aValue: number | string;
    let bValue: number | string;

    switch (filters.sortBy) {
      case 'pnl':
        aValue = a.pnl;
        bValue = b.pnl;
        break;
      case 'duration':
        aValue = a.duration;
        bValue = b.duration;
        break;
      case 'symbol':
        aValue = a.symbol;
        bValue = b.symbol;
        break;
      default:
        aValue = new Date(a.entryTime).getTime();
        bValue = new Date(b.entryTime).getTime();
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return filters.sortOrder === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return filters.sortOrder === 'asc' 
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

  // Pagination
  const totalPages = Math.ceil(sortedTrades.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedTrades = sortedTrades.slice(startIndex, startIndex + pageSize);

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
      year: '2-digit',
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

  const getStatusColor = (status: Trade['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: Trade['status']) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'cancelled':
        return '⏹️';
      case 'failed':
        return '❌';
      default:
        return '⚪';
    }
  };

  const handleSort = (field: FilterState['sortBy']) => {
    setFilters(prev => ({
      ...prev,
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  const getSortIcon = (field: FilterState['sortBy']) => {
    if (filters.sortBy !== field) return '↕️';
    return filters.sortOrder === 'asc' ? '↑' : '↓';
  };

  // Calculate summary statistics
  const completedTrades = filteredTrades.filter(t => t.status === 'completed');
  const totalPnL = completedTrades.reduce((sum, t) => sum + t.pnl, 0);
  const winningTrades = completedTrades.filter(t => t.pnl > 0);
  const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-gray-900">
            {filteredTrades.length.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Total de Trades</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalPnL)}
          </div>
          <div className="text-sm text-gray-500">P&L Total</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-blue-600">
            {winRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">Win Rate</div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-purple-600">
            {completedTrades.length > 0 ? formatCurrency(totalPnL / completedTrades.length) : '$0.00'}
          </div>
          <div className="text-sm text-gray-500">P&L Médio</div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                showFilters 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🔍 Filtros Avançados
            </button>
            
            {(filters.symbols.length > 0 || filters.strategies.length > 0 || filters.status.length > 0) && (
              <button
                onClick={() => setFilters({
                  ...filters,
                  symbols: [],
                  strategies: [],
                  status: [],
                  pnlRange: { min: null, max: null },
                  dateRange: { start: '', end: '' },
                })}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200"
              >
                Limpar Filtros
              </button>
            )}
          </div>

          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <span>
              Mostrando {startIndex + 1}-{Math.min(startIndex + pageSize, sortedTrades.length)} de {sortedTrades.length}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
            >
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>
          </div>
        </div>

        {showFilters && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <AdvancedFilters
              filters={filters}
              onFiltersChange={setFilters}
              availableSymbols={Array.from(new Set(allTrades.map(t => t.symbol)))}
              availableStrategies={Array.from(new Set(allTrades.map(t => t.strategy)))}
            />
          </div>
        )}
      </div>

      {/* Trades Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('symbol')}
                >
                  Símbolo {getSortIcon('symbol')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estratégia
                </th>
                <th 
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('date')}
                >
                  Entrada {getSortIcon('date')}
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
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedTrades.map((trade) => (
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
                    <div>{trade.strategy}</div>
                    <div className="text-xs text-gray-500">{trade.signal}</div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>{formatDateTime(trade.entryTime)}</div>
                    {trade.status === 'completed' && (
                      <div className="text-xs text-gray-500">→ {formatDateTime(trade.exitTime)}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>{formatCurrency(trade.entryPrice)}</div>
                    {trade.status === 'completed' && (
                      <div className="text-xs text-gray-500">→ {formatCurrency(trade.exitPrice)}</div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className={`text-sm font-medium ${
                      trade.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(trade.pnl)}
                    </div>
                    {trade.status === 'completed' && (
                      <div className={`text-xs ${
                        trade.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatPercent(trade.pnlPercent)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {trade.status === 'completed' ? formatDuration(trade.duration) : '-'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">{getStatusIcon(trade.status)}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(trade.status)}`}>
                        {trade.status.toUpperCase()}
                      </span>
                    </div>
                    {trade.notes && (
                      <div className="text-xs text-gray-500 mt-1" title={trade.notes}>
                        📝 Nota
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {paginatedTrades.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            <div className="text-4xl mb-2">📊</div>
            <div>Nenhum trade encontrado com os filtros aplicados</div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};