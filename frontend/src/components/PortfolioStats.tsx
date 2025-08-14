import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { TrendingUp, TrendingDown, DollarSign, Activity } from './icons/Icons';

interface PortfolioStatsProps {
  user: any;
}

interface AccountInfo {
  totalWalletBalance: number;
  totalUnrealizedProfit: number;
  totalMarginBalance: number;
  availableBalance: number;
}

interface PortfolioPosition {
  symbol: string;
  size: number;
  side: string;
  unrealizedProfit: number;
  percentage: number;
  markPrice: number;
  entryPrice: number;
}

export const PortfolioStats: React.FC<PortfolioStatsProps> = ({ user }) => {
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountInfo = async () => {
    try {
      const token = localStorage.getItem('aura_token');
      const response = await fetch('http://localhost:3001/api/trading/account', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Simular dados de conta para demonstração
          setAccountInfo({
            totalWalletBalance: 12450.00,
            totalUnrealizedProfit: 245.80,
            totalMarginBalance: 12695.80,
            availableBalance: 8234.50
          });
        }
      }
    } catch (err) {
      console.error('Erro ao buscar informações da conta:', err);
      // Usar dados simulados em caso de erro
      setAccountInfo({
        totalWalletBalance: 12450.00,
        totalUnrealizedProfit: 245.80,
        totalMarginBalance: 12695.80,
        availableBalance: 8234.50
      });
    }
  };

  const fetchPositions = async () => {
    try {
      const token = localStorage.getItem('aura_token');
      const response = await fetch('http://localhost:3001/api/trading/orders/open', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Simular posições para demonstração
          setPositions([
            {
              symbol: 'BTCUSDT',
              size: 0.1,
              side: 'LONG',
              unrealizedProfit: 125.50,
              percentage: 2.85,
              markPrice: 43250.00,
              entryPrice: 42100.00
            },
            {
              symbol: 'ETHUSDT',
              size: 2.5,
              side: 'LONG',
              unrealizedProfit: 85.30,
              percentage: 1.95,
              markPrice: 2650.80,
              entryPrice: 2580.00
            },
            {
              symbol: 'BNBUSDT',
              size: 10,
              side: 'SHORT',
              unrealizedProfit: -35.00,
              percentage: -1.12,
              markPrice: 315.40,
              entryPrice: 318.95
            }
          ]);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar posições:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountInfo();
    fetchPositions();

    const interval = setInterval(() => {
      fetchAccountInfo();
      fetchPositions();
    }, 30000); // Atualizar a cada 30 segundos

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-white">Carregando portfólio...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalPnL = positions.reduce((sum, pos) => sum + pos.unrealizedProfit, 0);
  const totalPnLPercent = accountInfo ? (totalPnL / accountInfo.totalWalletBalance) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Resumo da Conta */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Saldo Total</p>
                <p className="text-2xl font-bold text-white">
                  ${accountInfo?.totalWalletBalance.toFixed(2)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">P&L Não Realizado</p>
                <p className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                </p>
              </div>
              {totalPnL >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-400" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-400" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Saldo Disponível</p>
                <p className="text-2xl font-bold text-white">
                  ${accountInfo?.availableBalance.toFixed(2)}
                </p>
              </div>
              <Activity className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Posições Ativas</p>
                <p className="text-2xl font-bold text-white">{positions.length}</p>
              </div>
              <Badge className={`${totalPnL >= 0 ? 'bg-green-500' : 'bg-red-500'}`}>
                {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Posições Detalhadas */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Posições Abertas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {positions.length > 0 ? positions.map((position, index) => (
              <div key={index} className="p-4 bg-white/5 rounded-lg border border-white/10">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-white font-semibold text-lg">{position.symbol}</span>
                    <Badge className={`${position.side === 'LONG' ? 'bg-green-500' : 'bg-red-500'}`}>
                      {position.side}
                    </Badge>
                    <span className="text-gray-400">Tamanho: {position.size}</span>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${position.unrealizedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {position.unrealizedProfit >= 0 ? '+' : ''}${position.unrealizedProfit.toFixed(2)}
                    </div>
                    <div className={`text-sm ${position.percentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {position.percentage >= 0 ? '+' : ''}{position.percentage.toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Preço de Entrada:</span>
                    <span className="text-white ml-2">${position.entryPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Preço Atual:</span>
                    <span className="text-white ml-2">${position.markPrice.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="text-center py-8">
                <p className="text-gray-400">Nenhuma posição aberta</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};