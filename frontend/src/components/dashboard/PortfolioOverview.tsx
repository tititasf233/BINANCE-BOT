import React from 'react';

interface PortfolioData {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  availableBalance: number;
  investedAmount: number;
}

export const PortfolioOverview: React.FC = () => {
  // Mock data - will be replaced with real data from Redux store
  const portfolioData: PortfolioData = {
    totalValue: 125000.50,
    totalPnL: 15000.25,
    totalPnLPercent: 13.6,
    availableBalance: 25000.00,
    investedAmount: 100000.25,
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          Visão Geral do Portfolio
        </h2>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Value */}
          <div className="text-center">
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(portfolioData.totalValue)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Valor Total
            </div>
          </div>

          {/* Total P&L */}
          <div className="text-center">
            <div className={`text-3xl font-bold ${
              portfolioData.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatCurrency(portfolioData.totalPnL)}
            </div>
            <div className={`text-sm mt-1 ${
              portfolioData.totalPnLPercent >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {formatPercent(portfolioData.totalPnLPercent)}
            </div>
            <div className="text-sm text-gray-500">
              P&L Total
            </div>
          </div>

          {/* Available Balance */}
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {formatCurrency(portfolioData.availableBalance)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Saldo Disponível
            </div>
          </div>

          {/* Invested Amount */}
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600">
              {formatCurrency(portfolioData.investedAmount)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Valor Investido
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Alocação do Portfolio</span>
            <span>{((portfolioData.investedAmount / portfolioData.totalValue) * 100).toFixed(1)}% investido</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${(portfolioData.investedAmount / portfolioData.totalValue) * 100}%` 
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};