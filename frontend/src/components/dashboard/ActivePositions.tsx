import React from 'react';

interface Position {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  strategy: string;
  openTime: string;
}

export const ActivePositions: React.FC = () => {
  // Mock data - will be replaced with real data from Redux store
  const positions: Position[] = [
    {
      id: '1',
      symbol: 'BTCUSDT',
      side: 'BUY',
      quantity: 0.5,
      entryPrice: 42000,
      currentPrice: 43500,
      pnl: 750,
      pnlPercent: 3.57,
      strategy: 'RSI Strategy',
      openTime: '2024-01-15 10:30:00',
    },
    {
      id: '2',
      symbol: 'ETHUSDT',
      side: 'BUY',
      quantity: 2.0,
      entryPrice: 2500,
      currentPrice: 2580,
      pnl: 160,
      pnlPercent: 3.20,
      strategy: 'MACD Strategy',
      openTime: '2024-01-15 14:15:00',
    },
    {
      id: '3',
      symbol: 'ADAUSDT',
      side: 'SELL',
      quantity: 1000,
      entryPrice: 0.45,
      currentPrice: 0.42,
      pnl: 30,
      pnlPercent: 6.67,
      strategy: 'Bollinger Bands',
      openTime: '2024-01-15 16:45:00',
    },
  ];

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
    return new Date(dateString).toLocaleString('pt-BR');
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Posições Ativas
          </h3>
          <span className="text-sm text-gray-500">
            {positions.length} posições
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Símbolo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Lado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantidade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preço Entrada
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Preço Atual
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                P&L
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estratégia
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {positions.map((position) => (
              <tr key={position.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {position.symbol}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatDateTime(position.openTime)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    position.side === 'BUY' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {position.side}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {position.quantity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(position.entryPrice)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(position.currentPrice)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm font-medium ${
                    position.pnl >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(position.pnl)}
                  </div>
                  <div className={`text-xs ${
                    position.pnlPercent >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatPercent(position.pnlPercent)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {position.strategy}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {positions.length === 0 && (
        <div className="p-6 text-center text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-sm">Nenhuma posição ativa no momento</div>
        </div>
      )}
    </div>
  );
};