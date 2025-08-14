import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Activity, TrendingUp, DollarSign, RefreshCw, AlertTriangle } from './icons/Icons';
import { useAuthContext } from '../contexts/AuthContext';
import { uiLogger } from '../services/ui/uiLogger';
import { formatCurrency, formatPrice, formatQuantity } from '../utils/formatters';
import { OrderActions } from './OrderActions';

interface AccountBalance {
  asset: string;
  free: string;
  locked: string;
}

interface OpenOrder {
  symbol: string;
  orderId: number;
  price: string;
  origQty: string;
  side: string;
  type: string;
  status: string;
  time: number;
}

interface TradeRecord {
  id: string;
  symbol: string;
  side: string;
  quantity: number;
  executed_price: string | number; // Pode vir como string do banco
  status: string;
  created_at: string;
}

interface RealTradingDataProps {
  user: any;
}

export const RealTradingData: React.FC<RealTradingDataProps> = ({ user }) => {
  const { authenticatedFetch } = useAuthContext();
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [requiresApiKeys, setRequiresApiKeys] = useState(false);

  const fetchAccountData = async () => {
    try {
      setRequiresApiKeys(false);
      
      // Buscar saldo da conta
      uiLogger.info('UI fetch account start');
      const accountResponse = await authenticatedFetch('/api/trading/account');
      const accountData = await accountResponse.json();
      
      if (accountResponse.ok && accountData.success) {
        setBalances(accountData.data.balances);
        uiLogger.info('UI fetch account success', { balances: accountData.data.balances?.length });
      } else if (accountData.requiresApiKeys) {
        setRequiresApiKeys(true);
        setError('API Keys da Binance não configuradas');
        setLoading(false);
        return;
      }

      // Buscar ordens abertas
      uiLogger.info('UI fetch open orders start');
      const ordersResponse = await authenticatedFetch('/api/trading/orders/open');
      const ordersData = await ordersResponse.json();
      
      if (ordersResponse.ok && ordersData.success) {
        setOpenOrders(ordersData.data);
        uiLogger.info('UI fetch open orders success', { count: ordersData.data?.length });
      }

      // Buscar histórico de trades
      uiLogger.info('UI fetch trades history start', { limit: 10 });
      const historyResponse = await authenticatedFetch('/api/trading/trades/history?limit=10');
      const historyData = await historyResponse.json();
      
      if (historyResponse.ok && historyData.success) {
        setTradeHistory(historyData.data);
        uiLogger.info('UI fetch trades history success', { count: historyData.data?.length });
      }

      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar dados de trading:', err);
      setError('Erro ao carregar dados de trading');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountData();
    
    // Atualizar dados a cada 5 segundos para melhor responsividade
    const interval = setInterval(fetchAccountData, 5000);
    return () => clearInterval(interval);
  }, []);

  // Função para forçar atualização imediata
  const forceRefresh = async () => {
    console.log('🔄 Forcing immediate data refresh...');
    await fetchAccountData();
  };

  const totalBalance = balances.reduce((total, balance) => {
    const value = parseFloat(balance.free) + parseFloat(balance.locked);
    // Converter para USDT aproximado (simplificado)
    if (balance.asset === 'USDT') return total + value;
    if (balance.asset === 'BTC') return total + (value * 43000); // Preço aproximado
    if (balance.asset === 'ETH') return total + (value * 2650); // Preço aproximado
    if (balance.asset === 'BNB') return total + (value * 315); // Preço aproximado
    return total;
  }, 0);

  if (loading) {
    return (
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-white">Carregando dados reais da Binance...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (requiresApiKeys) {
    return (
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardContent className="p-6">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">API Keys Necessárias</h3>
            <p className="text-gray-300 mb-4">
              Configure suas chaves da API Binance para acessar dados reais de trading.
            </p>
            <p className="text-sm text-yellow-300">
              Apenas dados reais são suportados. Sem simulações ou dados sintéticos.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com status */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center">
              <Activity className="w-5 h-5 mr-2" />
              Dados Reais de Trading
            </span>
            <div className="flex items-center space-x-4">
              <Button
                onClick={fetchAccountData}
                className="bg-blue-600 hover:bg-blue-700 text-sm px-3 py-1"
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Atualizar
              </Button>
              {lastUpdate && (
                <span className="text-sm text-gray-400">
                  Atualizado: {lastUpdate.toLocaleTimeString('pt-BR')}
                </span>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        {error && (
          <CardContent>
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Saldos da Conta */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <DollarSign className="w-5 h-5 mr-2" />
            Saldos da Conta (Dados Reais)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="text-sm text-gray-400">Valor Total Estimado</div>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(totalBalance)}
              </div>
            </div>
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="text-sm text-gray-400">Ativos</div>
              <div className="text-2xl font-bold text-white">
                {balances.length}
              </div>
            </div>
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="text-sm text-gray-400">Ordens Abertas</div>
              <div className="text-2xl font-bold text-white">
                {openOrders.length}
              </div>
            </div>
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <div className="text-sm text-gray-400">Trades Hoje</div>
              <div className="text-2xl font-bold text-white">
                {tradeHistory.filter(t => 
                  new Date(t.created_at).toDateString() === new Date().toDateString()
                ).length}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-white font-semibold">Saldos por Ativo:</h4>
            {balances.map((balance) => {
              const total = parseFloat(balance.free) + parseFloat(balance.locked);
              if (total <= 0) return null;
              
              return (
                <div key={balance.asset} className="flex justify-between items-center p-3 bg-white/5 rounded border border-white/10">
                  <div className="flex items-center space-x-3">
                    <Badge className="bg-blue-500">{balance.asset}</Badge>
                    <span className="text-white font-medium">
                      {formatQuantity(total, balance.asset)}
                    </span>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-gray-400">Livre: {formatQuantity(balance.free, balance.asset)}</div>
                    <div className="text-gray-400">Bloqueado: {formatQuantity(balance.locked, balance.asset)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Ordens Abertas */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center">
            <TrendingUp className="w-5 h-5 mr-2" />
            Ordens Abertas ({openOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {openOrders.length > 0 ? (
            <div className="space-y-3">
              {openOrders.map((order) => (
                <div key={order.orderId} className="p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-white font-semibold">{order.symbol}</span>
                      <Badge className={`${order.side === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`}>
                        {order.side}
                      </Badge>
                      <Badge className="bg-gray-500">{order.type}</Badge>
                    </div>
                    <Badge className="bg-yellow-500">{order.status}</Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-gray-400">Quantidade:</span>
                      <span className="text-white ml-1">{order.origQty}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Preço:</span>
                      <span className="text-white ml-1">{formatCurrency(order.price)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">ID:</span>
                      <span className="text-white ml-1">{order.orderId}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Criado:</span>
                      <span className="text-white ml-1">
                        {new Date(order.time).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <OrderActions 
                    order={order} 
                    onOrderUpdated={fetchAccountData}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">Nenhuma ordem aberta</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico Recente */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white">Histórico Recente de Trades</CardTitle>
        </CardHeader>
        <CardContent>
          {tradeHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-gray-300 py-2">Data</th>
                    <th className="text-left text-gray-300 py-2">Símbolo</th>
                    <th className="text-left text-gray-300 py-2">Lado</th>
                    <th className="text-left text-gray-300 py-2">Quantidade</th>
                    <th className="text-left text-gray-300 py-2">Preço</th>
                    <th className="text-left text-gray-300 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tradeHistory.map((trade) => (
                    <tr key={trade.id} className="border-b border-white/5">
                      <td className="py-2 text-gray-300">
                        {new Date(trade.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-2 text-white">{trade.symbol}</td>
                      <td className="py-2">
                        <Badge className={`${trade.side === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`}>
                          {trade.side}
                        </Badge>
                      </td>
                      <td className="py-2 text-white">{trade.quantity}</td>
                      <td className="py-2 text-white">
                        {formatCurrency(trade.executed_price)}
                      </td>
                      <td className="py-2">
                        <Badge className="bg-blue-500">{trade.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">Nenhum trade encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};