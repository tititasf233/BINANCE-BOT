// Dashboard melhorado com mais mercados, combobox e histórico
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Select } from './ui/select';
import { ResponsiveChart } from './charts/SimpleChart';
import { Activity, BarChart3, Zap, Shield, RefreshCw, Plus, History, TrendingUp } from './icons/Icons';
import { useRealTimeData } from '../hooks/useRealTimeData';
import { PortfolioStats } from './PortfolioStats';
import { MarketSelector } from './MarketSelector';
import { RealTradingData } from './RealTradingData';
import { TradingModeSwitch } from './TradingModeSwitch';
import { useAuthContext } from '../contexts/AuthContext';
import { formatCurrency } from '../utils/formatters';

interface AutonomousDashboardProps {
  user: any;
  onLogout: () => void;
}

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  high24h: number;
  low24h: number;
  lastUpdate: string;
}

interface Position {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
}

interface TradeHistory {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: string | number; // Pode vir como string do banco
  status: string;
  createdAt: string;
}

const AutonomousDashboard: React.FC<AutonomousDashboardProps> = ({ user, onLogout }) => {
  const { authenticatedFetch } = useAuthContext();
  const { marketData, isConnected, lastUpdate, error } = useRealTimeData();
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [marketPrices, setMarketPrices] = useState<MarketData[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);
  const [showNewPosition, setShowNewPosition] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(false);

  // Formulário para nova posição
  const [newPosition, setNewPosition] = useState({
    symbol: 'BTCUSDT',
    side: 'BUY' as 'BUY' | 'SELL',
    quantity: '',
    quoteOrderQty: '', // Para ordens MARKET usando valor em USDT
    orderType: 'MARKET' as 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT',
    price: '',
    stopPrice: '',
    timeInForce: 'GTC' as 'GTC' | 'IOC' | 'FOK',
    testOrder: false // Para testar ordem antes de executar
  });

  // Lista expandida de símbolos
  const availableSymbols = [
    'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT',
    'DOTUSDT', 'LINKUSDT', 'LTCUSDT', 'BCHUSDT', 'AVAXUSDT', 'MATICUSDT',
    'ATOMUSDT', 'FILUSDT', 'TRXUSDT', 'ETCUSDT', 'XLMUSDT', 'VETUSDT'
  ];

  // Buscar dados do mercado
  const fetchMarketData = async () => {
    try {
      const token = localStorage.getItem('aura_token');
      const response = await fetch('http://localhost:3001/api/market/prices', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMarketPrices(data.data);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar dados do mercado:', error);
    }
  };

  // Buscar posições abertas
  const fetchPositions = async () => {
    try {
      const response = await authenticatedFetch('/api/trading/orders/open');

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Converter ordens abertas para formato de posições
          const openPositions = data.data.map((order: any, index: number) => ({
            id: order.orderId?.toString() || index.toString(),
            symbol: order.symbol,
            side: order.side,
            quantity: parseFloat(order.origQty),
            entryPrice: parseFloat(order.price || order.stopPrice || '0'),
            currentPrice: marketPrices.find(m => m.symbol === order.symbol)?.price || 0,
            pnl: 0, // Calcular baseado no preço atual
            pnlPercent: 0,
            status: 'OPEN' as const,
            createdAt: new Date(order.time || Date.now()).toISOString()
          }));
          setPositions(openPositions);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar posições:', error);
    }
  };

  // Buscar histórico de trades
  const fetchTradeHistory = async () => {
    try {
      const response = await authenticatedFetch('/api/trading/trades/history?limit=20');

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTradeHistory(data.data);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  // Testar ordem antes de executar
  const handleTestOrder = async () => {
    setLoading(true);
    try {
      const orderData: any = {
        symbol: newPosition.symbol,
        side: newPosition.side,
        type: newPosition.orderType,
      };

      // Adicionar parâmetros conforme tipo de ordem
      if (newPosition.orderType === 'MARKET') {
        if (newPosition.quantity) orderData.quantity = newPosition.quantity;
        if (newPosition.quoteOrderQty) orderData.quoteOrderQty = newPosition.quoteOrderQty;
      } else if (newPosition.orderType === 'LIMIT') {
        orderData.quantity = newPosition.quantity;
        orderData.price = newPosition.price;
        orderData.timeInForce = newPosition.timeInForce;
      } else if (['STOP_LOSS', 'TAKE_PROFIT'].includes(newPosition.orderType)) {
        orderData.quantity = newPosition.quantity;
        orderData.stopPrice = newPosition.stopPrice;
      } else if (['STOP_LOSS_LIMIT', 'TAKE_PROFIT_LIMIT'].includes(newPosition.orderType)) {
        orderData.quantity = newPosition.quantity;
        orderData.price = newPosition.price;
        orderData.stopPrice = newPosition.stopPrice;
        orderData.timeInForce = newPosition.timeInForce;
      }

      const response = await authenticatedFetch('/api/trading/order/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      const data = await response.json();
      if (data.success) {
        alert('✅ Ordem válida! Parâmetros estão corretos.');
      } else {
        alert(`❌ Erro no teste: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao testar ordem:', error);
      alert('❌ Erro ao testar ordem');
    } finally {
      setLoading(false);
    }
  };

  // Criar nova posição
  const handleCreatePosition = async () => {
    // Validar parâmetros obrigatórios
    if (newPosition.orderType === 'MARKET') {
      if (!newPosition.quantity && !newPosition.quoteOrderQty) {
        alert('Para ordens MARKET, informe quantity ou quoteOrderQty');
        return;
      }
    } else if (newPosition.orderType === 'LIMIT') {
      if (!newPosition.quantity || !newPosition.price) {
        alert('Para ordens LIMIT, informe quantity e price');
        return;
      }
    } else if (['STOP_LOSS', 'TAKE_PROFIT'].includes(newPosition.orderType)) {
      if (!newPosition.quantity || !newPosition.stopPrice) {
        alert('Para ordens STOP, informe quantity e stopPrice');
        return;
      }
    }

    setLoading(true);
    try {
      const orderData: any = {
        symbol: newPosition.symbol,
        side: newPosition.side,
        type: newPosition.orderType,
      };

      // Adicionar parâmetros conforme tipo de ordem
      if (newPosition.orderType === 'MARKET') {
        if (newPosition.quantity) orderData.quantity = newPosition.quantity;
        if (newPosition.quoteOrderQty) orderData.quoteOrderQty = newPosition.quoteOrderQty;
      } else if (newPosition.orderType === 'LIMIT') {
        orderData.quantity = newPosition.quantity;
        orderData.price = newPosition.price;
        orderData.timeInForce = newPosition.timeInForce;
      } else if (['STOP_LOSS', 'TAKE_PROFIT'].includes(newPosition.orderType)) {
        orderData.quantity = newPosition.quantity;
        orderData.stopPrice = newPosition.stopPrice;
      } else if (['STOP_LOSS_LIMIT', 'TAKE_PROFIT_LIMIT'].includes(newPosition.orderType)) {
        orderData.quantity = newPosition.quantity;
        orderData.price = newPosition.price;
        orderData.stopPrice = newPosition.stopPrice;
        orderData.timeInForce = newPosition.timeInForce;
      }

      const response = await authenticatedFetch('/api/trading/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      const data = await response.json();
      if (data.success) {
        setShowNewPosition(false);
        setNewPosition({
          symbol: 'BTCUSDT',
          side: 'BUY',
          quantity: '',
          quoteOrderQty: '',
          orderType: 'MARKET',
          price: '',
          stopPrice: '',
          timeInForce: 'GTC',
          testOrder: false
        });
        fetchPositions();
        fetchTradeHistory();
        alert('✅ Ordem criada com sucesso!');
      } else {
        alert(`❌ Erro: ${data.error}`);
      }
    } catch (error) {
      console.error('Erro ao criar posição:', error);
      alert('❌ Erro ao criar posição');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    fetchPositions();
    fetchTradeHistory();

    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchMarketData();
        fetchPositions();
      }
    }, 10000); // Atualizar a cada 10 segundos

    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Usar apenas dados reais do backend
  const displayMarkets = marketPrices.length > 0 ? marketPrices : [];

  // Gerar dados históricos para o gráfico apenas do símbolo selecionado
  const generateChartData = (symbol: string) => {
    const selectedMarket = displayMarkets.find(m => m.symbol === symbol);
    const basePrice = selectedMarket?.price || 100;
    const data = [];
    const now = new Date();

    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      const variation = (Math.random() - 0.5) * 0.05; // ±2.5% variation
      const price = basePrice * (1 + variation);

      data.push({
        time: time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        value: price,
        price: price
      });
    }

    return data;
  };

  // Gerar dados do gráfico apenas quando necessário (otimização de performance)
  const chartData = React.useMemo(() => generateChartData(selectedSymbol), [selectedSymbol, displayMarkets]);

  // Status da conexão
  const connectionStatus = isConnected ? 'Conectado' : 'Desconectado';
  const connectionColor = isConnected ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <Zap className="h-8 w-8 text-blue-400 mr-3" />
                <h1 className="text-2xl font-bold text-white">AURA</h1>
              </div>
              <div className="ml-8 flex items-center space-x-4">
                <div className={`w-3 h-3 rounded-full ${connectionColor}`}></div>
                <span className="text-sm text-gray-300">{connectionStatus}</span>
                {lastUpdate && (
                  <span className="text-xs text-gray-400">
                    Atualizado: {new Date(lastUpdate).toLocaleTimeString('pt-BR')}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <TradingModeSwitch className="mr-4" />
              <span className="text-white">Olá, {user?.name || user?.email}</span>
              <Button onClick={onLogout} className="bg-red-600 hover:bg-red-700">
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-300">Erro: {error}</p>
          </div>
        )}

        {/* Market Selector - Componente otimizado */}
        <div className="mb-8">
          <MarketSelector
            markets={displayMarkets}
            selectedSymbol={selectedSymbol}
            onSymbolChange={setSelectedSymbol}
            isConnected={isConnected}
            connectionStatus={connectionStatus}
            connectionColor={connectionColor}
            autoRefresh={autoRefresh}
            onAutoRefreshToggle={() => setAutoRefresh(!autoRefresh)}
          />
        </div>

        {/* Real Trading Data */}
        <div className="mb-8">
          <RealTradingData user={user} />
        </div>

        {/* Chart Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2 bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                {selectedSymbol} - Últimas 24h
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveChart
                data={chartData}
                color="#10b981"
                type="area"
                showGrid={true}
              />
            </CardContent>
          </Card>

          {/* Trading Stats */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                Estatísticas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const selectedMarket = displayMarkets.find(m => m.symbol === selectedSymbol);
                if (!selectedMarket) return null;

                return (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Volume 24h:</span>
                      <span className="text-white font-semibold">
                        ${(selectedMarket.volume / 1000000).toFixed(1)}M
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Máxima 24h:</span>
                      <span className="text-green-400 font-semibold">
                        ${selectedMarket.high24h.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Mínima 24h:</span>
                      <span className="text-red-400 font-semibold">
                        ${selectedMarket.low24h.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Variação 24h:</span>
                      <span className={`font-semibold ${selectedMarket.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {selectedMarket.change24h >= 0 ? '+' : ''}{selectedMarket.change24h.toFixed(2)}%
                      </span>
                    </div>
                    <div className="pt-4 border-t border-white/10">
                      <div className="flex items-center text-green-400">
                        <Shield className="w-4 h-4 mr-2" />
                        <span className="text-sm">Sistema Ativo</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </div>

        {/* Actions and Positions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Nova Posição */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center justify-between">
                <span className="flex items-center">
                  <Plus className="w-5 h-5 mr-2" />
                  Nova Posição
                </span>
                <Button
                  onClick={() => setShowNewPosition(!showNewPosition)}
                  className="bg-blue-600 hover:bg-blue-700 text-sm px-3 py-1"
                >
                  {showNewPosition ? 'Fechar' : 'Abrir'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {showNewPosition ? (
                <div className="space-y-4">
                  {/* Combobox para símbolo */}
                  <div>
                    <label className="text-sm text-gray-300 mb-2 block">Símbolo</label>
                    <Select
                      options={availableSymbols.map(symbol => ({
                        value: symbol,
                        label: `${symbol.replace('USDT', '')} / USDT`
                      }))}
                      value={newPosition.symbol}
                      onChange={(value) => setNewPosition({ ...newPosition, symbol: value })}
                      searchable={true}
                      placeholder="Selecione um símbolo"
                    />
                  </div>

                  {/* Lado da operação */}
                  <div>
                    <label className="text-sm text-gray-300 mb-2 block">Lado</label>
                    <div className="flex space-x-2">
                      <Button
                        onClick={() => setNewPosition({ ...newPosition, side: 'BUY' })}
                        className={`flex-1 ${newPosition.side === 'BUY' ? 'bg-green-600' : 'bg-gray-600'}`}
                      >
                        Comprar
                      </Button>
                      <Button
                        onClick={() => setNewPosition({ ...newPosition, side: 'SELL' })}
                        className={`flex-1 ${newPosition.side === 'SELL' ? 'bg-red-600' : 'bg-gray-600'}`}
                      >
                        Vender
                      </Button>
                    </div>
                  </div>

                  {/* Tipo de ordem */}
                  <div>
                    <label className="text-sm text-gray-300 mb-2 block">Tipo de Ordem</label>
                    <Select
                      options={[
                        { value: 'MARKET', label: 'Mercado (Market)' },
                        { value: 'LIMIT', label: 'Limite (Limit)' },
                        { value: 'STOP_LOSS', label: 'Stop Loss' },
                        { value: 'STOP_LOSS_LIMIT', label: 'Stop Loss Limit' },
                        { value: 'TAKE_PROFIT', label: 'Take Profit' },
                        { value: 'TAKE_PROFIT_LIMIT', label: 'Take Profit Limit' }
                      ]}
                      value={newPosition.orderType}
                      onChange={(value) => setNewPosition({ ...newPosition, orderType: value as any })}
                      placeholder="Tipo de ordem"
                    />
                  </div>

                  {/* Quantidade ou Valor (para MARKET) */}
                  {newPosition.orderType === 'MARKET' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-sm text-gray-300 mb-2 block">Quantidade</label>
                        <input
                          type="number"
                          value={newPosition.quantity}
                          onChange={(e) => setNewPosition({ ...newPosition, quantity: e.target.value, quoteOrderQty: '' })}
                          className="w-full bg-white/10 border border-white/20 rounded-md text-white p-2"
                          placeholder="0.001"
                          step="0.001"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-gray-300 mb-2 block">Ou Valor (USDT)</label>
                        <input
                          type="number"
                          value={newPosition.quoteOrderQty}
                          onChange={(e) => setNewPosition({ ...newPosition, quoteOrderQty: e.target.value, quantity: '' })}
                          className="w-full bg-white/10 border border-white/20 rounded-md text-white p-2"
                          placeholder="100.00"
                          step="0.01"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-sm text-gray-300 mb-2 block">Quantidade</label>
                      <input
                        type="number"
                        value={newPosition.quantity}
                        onChange={(e) => setNewPosition({ ...newPosition, quantity: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded-md text-white p-2"
                        placeholder="0.001"
                        step="0.001"
                        required
                      />
                    </div>
                  )}

                  {/* Preço (para ordens LIMIT) */}
                  {['LIMIT', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT_LIMIT'].includes(newPosition.orderType) && (
                    <div>
                      <label className="text-sm text-gray-300 mb-2 block">Preço</label>
                      <input
                        type="number"
                        value={newPosition.price}
                        onChange={(e) => setNewPosition({ ...newPosition, price: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded-md text-white p-2"
                        placeholder="0.00"
                        step="0.01"
                        required
                      />
                    </div>
                  )}

                  {/* Stop Price (para ordens STOP) */}
                  {['STOP_LOSS', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT', 'TAKE_PROFIT_LIMIT'].includes(newPosition.orderType) && (
                    <div>
                      <label className="text-sm text-gray-300 mb-2 block">Stop Price</label>
                      <input
                        type="number"
                        value={newPosition.stopPrice}
                        onChange={(e) => setNewPosition({ ...newPosition, stopPrice: e.target.value })}
                        className="w-full bg-white/10 border border-white/20 rounded-md text-white p-2"
                        placeholder="0.00"
                        step="0.01"
                        required
                      />
                    </div>
                  )}

                  {/* Time in Force (para ordens LIMIT) */}
                  {['LIMIT', 'STOP_LOSS_LIMIT', 'TAKE_PROFIT_LIMIT'].includes(newPosition.orderType) && (
                    <div>
                      <label className="text-sm text-gray-300 mb-2 block">Time in Force</label>
                      <Select
                        options={[
                          { value: 'GTC', label: 'GTC (Good Till Canceled)' },
                          { value: 'IOC', label: 'IOC (Immediate or Cancel)' },
                          { value: 'FOK', label: 'FOK (Fill or Kill)' }
                        ]}
                        value={newPosition.timeInForce}
                        onChange={(value) => setNewPosition({ ...newPosition, timeInForce: value as any })}
                        placeholder="Time in Force"
                      />
                    </div>
                  )}

                  {/* Botões de ação */}
                  <div className="flex space-x-2">
                    <Button
                      onClick={handleTestOrder}
                      disabled={loading}
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700"
                    >
                      {loading ? 'Testando...' : 'Testar Ordem'}
                    </Button>
                    <Button
                      onClick={handleCreatePosition}
                      disabled={loading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      {loading ? 'Criando...' : 'Executar Ordem'}
                    </Button>
                  </div>

                  {/* Informações sobre tipos de ordem */}
                  <div className="p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                    <h4 className="text-blue-300 text-sm font-medium mb-2">Tipos de Ordem (Binance API):</h4>
                    <ul className="text-blue-200 text-xs space-y-1">
                      <li><strong>MARKET:</strong> Executa imediatamente ao preço de mercado</li>
                      <li><strong>LIMIT:</strong> Executa apenas ao preço especificado ou melhor</li>
                      <li><strong>STOP_LOSS:</strong> Vira ordem MARKET quando atinge stop price</li>
                      <li><strong>TAKE_PROFIT:</strong> Vira ordem MARKET para realizar lucro</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">Clique em "Abrir" para criar uma nova posição</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Posições Abertas */}
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardHeader>
              <CardTitle className="text-white text-lg flex items-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Posições Abertas ({positions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {positions.length > 0 ? positions.map((position) => (
                  <div key={position.id} className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-white font-semibold">{position.symbol}</span>
                        <Badge className={`ml-2 ${position.side === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`}>
                          {position.side}
                        </Badge>
                      </div>
                      <span className="text-sm text-gray-400">
                        {new Date(position.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-400">Qtd:</span>
                        <span className="text-white ml-1">{position.quantity}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Preço:</span>
                        <span className="text-white ml-1">{formatCurrency(position.entryPrice)}</span>
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

        {/* Histórico de Trades */}
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-8">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center justify-between">
              <span className="flex items-center">
                <History className="w-5 h-5 mr-2" />
                Histórico de Trades
              </span>
              <Button
                onClick={() => setShowHistory(!showHistory)}
                className="bg-gray-600 hover:bg-gray-700 text-sm px-3 py-1"
              >
                {showHistory ? 'Ocultar' : 'Mostrar'}
              </Button>
            </CardTitle>
          </CardHeader>
          {showHistory && (
            <CardContent>
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
                    {tradeHistory.length > 0 ? tradeHistory.map((trade) => (
                      <tr key={trade.id} className="border-b border-white/5">
                        <td className="py-2 text-gray-300">
                          {new Date(trade.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-2 text-white">{trade.symbol}</td>
                        <td className="py-2">
                          <Badge className={`${trade.side === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`}>
                            {trade.side}
                          </Badge>
                        </td>
                        <td className="py-2 text-white">{trade.quantity}</td>
                        <td className="py-2 text-white">{formatCurrency(trade.price)}</td>
                        <td className="py-2">
                          <Badge className="bg-blue-500">{trade.status}</Badge>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-400">
                          Nenhum trade encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AutonomousDashboard;