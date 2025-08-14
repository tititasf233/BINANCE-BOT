import React, { useState, useEffect, useCallback } from 'react';
import { uiLogger } from '../services/ui/uiLogger';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  X, 
  Edit, 
  RefreshCw, 
  Plus,
  AlertTriangle,
  CheckCircle,
  Clock
} from './icons/Icons';
import { useAuthContext } from '../contexts/AuthContext';

interface Order {
  orderId: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  origQty: string;
  price: string;
  status: string;
  time: number;
}

interface NewOrderData {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: string;
  price: string;
}

export const RealTimeOrderManager: React.FC = () => {
  const { authenticatedFetch } = useAuthContext();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [operationLoading, setOperationLoading] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrder, setNewOrder] = useState<NewOrderData>({
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'LIMIT',
    quantity: '',
    price: ''
  });
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Função para buscar ordens com feedback visual
  const fetchOrders = useCallback(async (showLoading = true) => {
    const fetchId = Math.random().toString(36).substr(2, 9);
    uiLogger.info('Orders fetch start', { fetchId, showLoading });
    uiLogger.debug('Orders state before fetch', { fetchId, localCount: orders.length });
    
    if (showLoading) {
      console.log(`🔄 [${fetchId}] Ativando loading visual`);
      setLoading(true);
    }
    
    try {
      const startTime = Date.now();
      uiLogger.debug('Orders request', { fetchId, url: '/api/trading/orders/open' });
      
      const response = await authenticatedFetch('/api/trading/orders/open');
      const requestTime = Date.now() - startTime;
      uiLogger.info('Orders response', { fetchId, ms: requestTime, status: response.status });
      
      const data = await response.json();
      uiLogger.debug('Orders parsed', { fetchId, success: data.success, dataLength: data.data?.length, error: data.error });
      
      if (response.ok && data.success) {
        const newOrders = data.data;
        uiLogger.info('Orders success', { fetchId, count: newOrders.length });
        
        // Log detalhado das ordens
        if (newOrders.length > 0) {
          uiLogger.debug('Orders detail', { fetchId });
          newOrders.forEach((order: Order, index: number) => {
            uiLogger.debug('Order item', { index: index + 1, id: order.orderId, symbol: order.symbol, side: order.side, qty: order.origQty, price: order.price, status: order.status });
          });
        } else {
          console.log(`📋 [${fetchId}] Nenhuma ordem encontrada`);
        }
        
        // Comparar com estado anterior
        const previousOrderIds = orders.map(o => o.orderId).sort();
        const newOrderIds = newOrders.map((o: Order) => o.orderId).sort();
        
        if (JSON.stringify(previousOrderIds) !== JSON.stringify(newOrderIds)) {
          console.log(`🔄 [${fetchId}] MUDANÇA DETECTADA:`);
          console.log(`  Anterior: [${previousOrderIds.join(', ')}]`);
          console.log(`  Novo: [${newOrderIds.join(', ')}]`);
          
          const added = newOrderIds.filter(id => !previousOrderIds.includes(id));
          const removed = previousOrderIds.filter(id => !newOrderIds.includes(id));
          
          if (added.length > 0) console.log(`  ➕ Adicionadas: [${added.join(', ')}]`);
          if (removed.length > 0) console.log(`  ➖ Removidas: [${removed.join(', ')}]`);
        } else {
          console.log(`🔄 [${fetchId}] Nenhuma mudança nas ordens`);
        }
        
        setOrders(newOrders);
        const updateTime = new Date();
        setLastUpdate(updateTime);
        console.log(`✅ [${fetchId}] Estado atualizado às ${updateTime.toLocaleTimeString('pt-BR')}`);
        
        // Clear any error messages
        if (message?.type === 'error') {
          console.log(`🔄 [${fetchId}] Limpando mensagem de erro anterior`);
          setMessage(null);
        }
      } else {
        console.error(`❌ [${fetchId}] FALHA NA REQUISIÇÃO:`, {
          status: response.status,
          success: data.success,
          error: data.error,
          fullResponse: data
        });
        setMessage({ type: 'error', text: data.error || 'Erro ao carregar ordens' });
      }
    } catch (error: any) {
      console.error(`❌ [${fetchId}] ERRO DE CONEXÃO:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setMessage({ type: 'error', text: 'Erro de conexão' });
    } finally {
      if (showLoading) {
        console.log(`🔄 [${fetchId}] Desativando loading visual`);
        setLoading(false);
      }
      console.log(`🔄 [${fetchId}] FETCH ORDERS FINALIZADO`);
    }
  }, [authenticatedFetch, message, orders]);

  // Auto-refresh a cada 3 segundos
  useEffect(() => {
    fetchOrders();
    
    const interval = setInterval(() => {
      fetchOrders(false); // Não mostrar loading no auto-refresh
    }, 3000);
    
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Limpar mensagens após 5 segundos
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleCreateOrder = async () => {
    const createId = Math.random().toString(36).substr(2, 9);
    console.log(`📝 [${createId}] CRIAR ORDEM INICIADO`);
    console.log(`📝 [${createId}] Dados do formulário:`, newOrder);
    
    // Validações
    if (!newOrder.quantity || parseFloat(newOrder.quantity) <= 0) {
      console.log(`❌ [${createId}] Validação falhou: quantidade inválida (${newOrder.quantity})`);
      setMessage({ type: 'error', text: 'Quantidade deve ser maior que zero' });
      return;
    }

    if (newOrder.type === 'LIMIT' && (!newOrder.price || parseFloat(newOrder.price) <= 0)) {
      console.log(`❌ [${createId}] Validação falhou: preço inválido para LIMIT (${newOrder.price})`);
      setMessage({ type: 'error', text: 'Preço deve ser maior que zero para ordens limit' });
      return;
    }

    console.log(`📝 [${createId}] Validações passaram, iniciando criação`);
    console.log(`📝 [${createId}] Estado atual: ${orders.length} ordens em memória`);
    
    setOperationLoading(-1); // -1 para nova ordem
    
    try {
      const orderData = {
        symbol: newOrder.symbol,
        side: newOrder.side,
        type: newOrder.type,
        quantity: newOrder.quantity,
        ...(newOrder.type === 'LIMIT' && { 
          price: newOrder.price,
          timeInForce: 'GTC'
        })
      };

      console.log(`📝 [${createId}] Dados da ordem preparados:`, orderData);
      
      const startTime = Date.now();
      const response = await authenticatedFetch('/api/trading/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      const requestTime = Date.now() - startTime;
      console.log(`📝 [${createId}] Resposta recebida em ${requestTime}ms - Status: ${response.status}`);

      const data = await response.json();
      console.log(`📝 [${createId}] Dados da resposta:`, {
        success: data.success,
        error: data.error,
        data: data.data,
        fullResponse: data
      });
      
      if (response.ok && data.success) {
        const createdOrder = data.data;
        console.log(`✅ [${createId}] ORDEM CRIADA COM SUCESSO:`, {
          orderId: createdOrder.orderId,
          symbol: createdOrder.symbol,
          side: createdOrder.side,
          quantity: createdOrder.origQty,
          price: createdOrder.price,
          status: createdOrder.status,
          time: new Date(createdOrder.time).toLocaleString('pt-BR')
        });
        
        setMessage({ 
          type: 'success', 
          text: `Ordem ${createdOrder.side} ${createdOrder.symbol} criada! ID: ${createdOrder.orderId}` 
        });
        
        console.log(`📝 [${createId}] Resetando formulário e fechando modal`);
        
        // Reset form
        setNewOrder({
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '',
          price: ''
        });
        setShowNewOrder(false);
        
        // Force immediate refresh
        console.log(`📝 [${createId}] Agendando refresh imediato em 100ms`);
        setTimeout(() => {
          console.log(`📝 [${createId}] Executando refresh pós-criação`);
          fetchOrders(false);
        }, 100);
        
        // Refresh adicional após 1 segundo para garantir
        setTimeout(() => {
          console.log(`📝 [${createId}] Executando refresh de segurança`);
          fetchOrders(false);
        }, 1000);
        
      } else {
        console.error(`❌ [${createId}] FALHA NA CRIAÇÃO:`, {
          status: response.status,
          success: data.success,
          error: data.error,
          fullResponse: data
        });
        setMessage({ type: 'error', text: data.error || 'Erro ao criar ordem' });
      }
    } catch (error: any) {
      console.error(`❌ [${createId}] ERRO DE CONEXÃO:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setMessage({ type: 'error', text: 'Erro de conexão' });
    } finally {
      console.log(`📝 [${createId}] Finalizando operação, removendo loading`);
      setOperationLoading(null);
      console.log(`📝 [${createId}] CRIAR ORDEM FINALIZADO`);
    }
  };

  const handleCancelOrder = async (order: Order) => {
    const cancelId = Math.random().toString(36).substr(2, 9);
    console.log(`🗑️ [${cancelId}] CANCELAR ORDEM INICIADO`);
    console.log(`🗑️ [${cancelId}] Ordem a ser cancelada:`, {
      orderId: order.orderId,
      symbol: order.symbol,
      side: order.side,
      quantity: order.origQty,
      price: order.price,
      status: order.status
    });
    
    const confirmed = window.confirm(
      `Tem certeza que deseja cancelar a ordem ${order.symbol} ${order.side}?`
    );
    
    if (!confirmed) {
      console.log(`🗑️ [${cancelId}] Cancelamento abortado pelo usuário`);
      return;
    }

    console.log(`🗑️ [${cancelId}] Confirmação recebida, prosseguindo com cancelamento`);
    console.log(`🗑️ [${cancelId}] Estado atual: ${orders.length} ordens em memória`);
    
    setOperationLoading(order.orderId);
    
    try {
      const startTime = Date.now();
      const endpoint = `/api/trading/order/${order.symbol}/${order.orderId}`;
      console.log(`🗑️ [${cancelId}] Fazendo requisição DELETE para: ${endpoint}`);
      
      const response = await authenticatedFetch(endpoint, { method: 'DELETE' });

      const requestTime = Date.now() - startTime;
      console.log(`🗑️ [${cancelId}] Resposta recebida em ${requestTime}ms - Status: ${response.status}`);

      const data = await response.json();
      console.log(`🗑️ [${cancelId}] Dados da resposta:`, {
        success: data.success,
        error: data.error,
        data: data.data,
        fullResponse: data
      });
      
      if (response.ok && data.success) {
        console.log(`✅ [${cancelId}] ORDEM CANCELADA COM SUCESSO:`, {
          orderId: order.orderId,
          newStatus: data.data?.status,
          responseData: data.data
        });
        
        setMessage({ 
          type: 'success', 
          text: `Ordem ${order.symbol} ${order.side} cancelada com sucesso!` 
        });
        
        // Force immediate refresh
        console.log(`🗑️ [${cancelId}] Agendando refresh imediato em 100ms`);
        setTimeout(() => {
          console.log(`🗑️ [${cancelId}] Executando refresh pós-cancelamento`);
          fetchOrders(false);
        }, 100);
        
        // Refresh adicional após 1 segundo para garantir
        setTimeout(() => {
          console.log(`🗑️ [${cancelId}] Executando refresh de segurança`);
          fetchOrders(false);
        }, 1000);
        
      } else {
        console.error(`❌ [${cancelId}] FALHA NO CANCELAMENTO:`, {
          status: response.status,
          success: data.success,
          error: data.error,
          fullResponse: data
        });
        setMessage({ type: 'error', text: data.error || 'Erro ao cancelar ordem' });
      }
    } catch (error: any) {
      console.error(`❌ [${cancelId}] ERRO DE CONEXÃO:`, {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setMessage({ type: 'error', text: 'Erro de conexão' });
    } finally {
      console.log(`🗑️ [${cancelId}] Finalizando operação, removendo loading`);
      setOperationLoading(null);
      console.log(`🗑️ [${cancelId}] CANCELAR ORDEM FINALIZADO`);
    }
  };

  const handleModifyOrder = async (order: Order) => {
    const newPrice = prompt(
      `Novo preço para ${order.symbol} ${order.side}:`,
      order.price
    );
    
    if (!newPrice || newPrice === order.price) return;

    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setMessage({ type: 'error', text: 'Preço inválido' });
      return;
    }

    setOperationLoading(order.orderId);
    
    try {
      console.log(`✏️ Modifying order ${order.orderId} to price ${newPrice}...`);
      
      // Cancel original order
      const cancelResponse = await authenticatedFetch(
        `/api/trading/order/${order.symbol}/${order.orderId}`,
        { method: 'DELETE' }
      );

      if (!cancelResponse.ok) {
        const cancelData = await cancelResponse.json();
        throw new Error(cancelData.error || 'Falha ao cancelar ordem original');
      }

      // Create new order with new price
      const createResponse = await authenticatedFetch('/api/trading/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          quantity: order.origQty,
          price: newPrice,
          timeInForce: 'GTC'
        })
      });

      const createData = await createResponse.json();
      
      if (createResponse.ok && createData.success) {
        console.log('✅ Order modified:', createData.data);
        
        setMessage({ 
          type: 'success', 
          text: `Ordem ${order.symbol} ${order.side} modificada! Novo preço: $${newPrice}` 
        });
        
        // Force immediate refresh
        setTimeout(() => fetchOrders(false), 100);
      } else {
        console.error('❌ Order modification failed:', createData.error);
        setMessage({ type: 'error', text: createData.error || 'Erro ao criar nova ordem' });
      }
    } catch (error: any) {
      console.error('❌ Error modifying order:', error);
      setMessage({ type: 'error', text: error.message || 'Erro ao modificar ordem' });
    } finally {
      setOperationLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {message && (
        <div className={`p-3 rounded border ${
          message.type === 'success' 
            ? 'bg-green-500/20 border-green-500/50 text-green-300' 
            : 'bg-red-500/20 border-red-500/50 text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Header */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Ordens em Tempo Real
            </span>
            <div className="flex items-center space-x-2">
              <div className="flex items-center text-sm text-gray-400">
                <Clock className="w-4 h-4 mr-1" />
                {lastUpdate ? lastUpdate.toLocaleTimeString('pt-BR') : 'Nunca'}
              </div>
              <Button
                onClick={() => fetchOrders()}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-sm px-3 py-1"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                onClick={() => setShowNewOrder(!showNewOrder)}
                className="bg-green-600 hover:bg-green-700 text-sm px-3 py-1"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nova Ordem
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-white/5 rounded border border-white/10">
              <div className="text-sm text-gray-400">Ordens Abertas</div>
              <div className="text-xl font-bold text-white">{orders.length}</div>
            </div>
            <div className="p-3 bg-white/5 rounded border border-white/10">
              <div className="text-sm text-gray-400">Status</div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-400 mr-1" />
                <span className="text-green-400 text-sm">Tempo Real</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Order Form */}
      {showNewOrder && (
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              Nova Ordem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-white text-sm block mb-1">Símbolo</label>
                <select
                  value={newOrder.symbol}
                  onChange={(e) => setNewOrder(prev => ({ ...prev, symbol: e.target.value }))}
                  className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                >
                  <option value="BTCUSDT">BTC/USDT</option>
                  <option value="ETHUSDT">ETH/USDT</option>
                  <option value="BNBUSDT">BNB/USDT</option>
                  <option value="ADAUSDT">ADA/USDT</option>
                  <option value="SOLUSDT">SOL/USDT</option>
                </select>
              </div>
              <div>
                <label className="text-white text-sm block mb-1">Tipo</label>
                <select
                  value={newOrder.type}
                  onChange={(e) => setNewOrder(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                >
                  <option value="MARKET">Market</option>
                  <option value="LIMIT">Limit</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => setNewOrder(prev => ({ ...prev, side: 'BUY' }))}
                className={`${
                  newOrder.side === 'BUY' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-600 hover:bg-gray-700'
                } text-white flex items-center justify-center`}
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                Comprar
              </Button>
              <Button
                onClick={() => setNewOrder(prev => ({ ...prev, side: 'SELL' }))}
                className={`${
                  newOrder.side === 'SELL' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-gray-600 hover:bg-gray-700'
                } text-white flex items-center justify-center`}
              >
                <TrendingDown className="w-4 h-4 mr-1" />
                Vender
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-white text-sm block mb-1">Quantidade</label>
                <input
                  type="number"
                  value={newOrder.quantity}
                  onChange={(e) => setNewOrder(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                  placeholder="0.001"
                  step="0.001"
                />
              </div>
              {newOrder.type === 'LIMIT' && (
                <div>
                  <label className="text-white text-sm block mb-1">Preço</label>
                  <input
                    type="number"
                    value={newOrder.price}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={handleCreateOrder}
                disabled={operationLoading === -1}
                className={`flex-1 ${
                  newOrder.side === 'BUY' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                } text-white`}
              >
                {operationLoading === -1 ? 'Criando...' : `${newOrder.side === 'BUY' ? 'Comprar' : 'Vender'}`}
              </Button>
              <Button
                onClick={() => setShowNewOrder(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders List */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white">
            Ordens Abertas ({orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orders.length > 0 ? (
            <div className="space-y-3">
              {orders.map((order) => (
                <div key={order.orderId} className="p-4 bg-white/5 rounded border border-white/10">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-white font-semibold text-lg">{order.symbol}</span>
                      <Badge className={`${order.side === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`}>
                        {order.side}
                      </Badge>
                      <Badge className="bg-blue-500">{order.type}</Badge>
                      <Badge className="bg-yellow-500">{order.status}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">
                        ${(parseFloat(order.origQty) * parseFloat(order.price)).toFixed(2)}
                      </div>
                      <div className="text-gray-400 text-sm">ID: {order.orderId}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                    <div>
                      <span className="text-gray-400">Quantidade:</span>
                      <span className="text-white ml-1">{order.origQty}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Preço:</span>
                      <span className="text-white ml-1">${order.price}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Tipo:</span>
                      <span className="text-white ml-1">{order.type}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Criado:</span>
                      <span className="text-white ml-1">
                        {new Date(order.time).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    {order.status === 'NEW' && order.type === 'LIMIT' && (
                      <Button
                        onClick={() => handleModifyOrder(order)}
                        disabled={operationLoading === order.orderId}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 flex items-center"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        {operationLoading === order.orderId ? 'Modificando...' : 'Modificar'}
                      </Button>
                    )}
                    
                    {(order.status === 'NEW' || order.status === 'PARTIALLY_FILLED') && (
                      <Button
                        onClick={() => handleCancelOrder(order)}
                        disabled={operationLoading === order.orderId}
                        className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 flex items-center"
                      >
                        <X className="w-3 h-3 mr-1" />
                        {operationLoading === order.orderId ? 'Cancelando...' : 'Cancelar'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Nenhuma ordem aberta</p>
              <p className="text-gray-500 text-sm">Clique em "Nova Ordem" para começar</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};