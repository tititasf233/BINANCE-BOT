import React from 'react';

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

interface AdvancedFiltersProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  availableSymbols: string[];
  availableStrategies: string[];
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  filters,
  onFiltersChange,
  availableSymbols,
  availableStrategies,
}) => {
  const handleDateRangeChange = (field: 'start' | 'end', value: string) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: value,
      },
    });
  };

  const handleMultiSelectChange = (field: 'symbols' | 'strategies' | 'status', value: string) => {
    const currentValues = filters[field];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    onFiltersChange({
      ...filters,
      [field]: newValues,
    });
  };

  const handlePnLRangeChange = (field: 'min' | 'max', value: string) => {
    onFiltersChange({
      ...filters,
      pnlRange: {
        ...filters.pnlRange,
        [field]: value === '' ? null : parseFloat(value),
      },
    });
  };

  const statusOptions = [
    { value: 'completed', label: 'Completado', color: 'text-green-600' },
    { value: 'cancelled', label: 'Cancelado', color: 'text-yellow-600' },
    { value: 'failed', label: 'Falhado', color: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Filtros Avançados</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Período
          </label>
          <div className="space-y-2">
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => handleDateRangeChange('start', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Data inicial"
            />
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => handleDateRangeChange('end', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Data final"
            />
          </div>
        </div>

        {/* Symbols */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Símbolos ({filters.symbols.length} selecionados)
          </label>
          <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
            {availableSymbols.map((symbol) => (
              <label key={symbol} className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.symbols.includes(symbol)}
                  onChange={() => handleMultiSelectChange('symbols', symbol)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span>{symbol}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Strategies */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estratégias ({filters.strategies.length} selecionadas)
          </label>
          <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2 space-y-1">
            {availableStrategies.map((strategy) => (
              <label key={strategy} className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.strategies.includes(strategy)}
                  onChange={() => handleMultiSelectChange('strategies', strategy)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span>{strategy}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status ({filters.status.length} selecionados)
          </label>
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <label key={option.value} className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.status.includes(option.value)}
                  onChange={() => handleMultiSelectChange('status', option.value)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span className={option.color}>{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* P&L Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Faixa de P&L (USD)
          </label>
          <div className="space-y-2">
            <input
              type="number"
              value={filters.pnlRange.min || ''}
              onChange={(e) => handlePnLRangeChange('min', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mínimo"
              step="0.01"
            />
            <input
              type="number"
              value={filters.pnlRange.max || ''}
              onChange={(e) => handlePnLRangeChange('max', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Máximo"
              step="0.01"
            />
          </div>
        </div>

        {/* Sort Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ordenação
          </label>
          <div className="space-y-2">
            <select
              value={filters.sortBy}
              onChange={(e) => onFiltersChange({
                ...filters,
                sortBy: e.target.value as FilterState['sortBy'],
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Data</option>
              <option value="pnl">P&L</option>
              <option value="duration">Duração</option>
              <option value="symbol">Símbolo</option>
            </select>
            <select
              value={filters.sortOrder}
              onChange={(e) => onFiltersChange({
                ...filters,
                sortOrder: e.target.value as FilterState['sortOrder'],
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="desc">Decrescente</option>
              <option value="asc">Crescente</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quick Filters */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Filtros Rápidos
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onFiltersChange({
              ...filters,
              dateRange: {
                start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0],
              },
            })}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
          >
            Últimos 7 dias
          </button>
          <button
            onClick={() => onFiltersChange({
              ...filters,
              dateRange: {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                end: new Date().toISOString().split('T')[0],
              },
            })}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
          >
            Últimos 30 dias
          </button>
          <button
            onClick={() => onFiltersChange({
              ...filters,
              status: ['completed'],
            })}
            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200"
          >
            Apenas Completados
          </button>
          <button
            onClick={() => onFiltersChange({
              ...filters,
              pnlRange: { min: 0, max: null },
            })}
            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-md hover:bg-green-200"
          >
            Apenas Lucrativos
          </button>
          <button
            onClick={() => onFiltersChange({
              ...filters,
              pnlRange: { min: null, max: 0 },
            })}
            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200"
          >
            Apenas Prejuízos
          </button>
        </div>
      </div>
    </div>
  );
};