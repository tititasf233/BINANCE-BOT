import React, { useState, useEffect } from 'react';
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
  DollarSign
} from './icons/Icons';
import { useAuthContext } from '../contexts/AuthContext';
import { useNotifications } from './Notification';

interface Position {
  orderId: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  origQty: string;
  price: string;
  status: string;
  timeInForce?: string;
  time: number;
}

interface NewPositionData {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  quantity: string;
  price: string;
}

export const PositionManager: React.FC = () => {
  const { authenticatedFetch } = useAuthContext();
  const { showSuccess, showError, showWarning } = useNotifications();
  
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewPosition, setShowNewPosition] = useState(false);
  const [newPosition, setNewPosition] = useState<NewPositionData>({
    symbol: 'BTCUSDT',
    side: 'BUY',
    type: 'LIMIT',
    quantity: '',
    price: ''
  });

  const fetchPositions = async () => {
    try {
      setLoading(true);
      const response = await authenticatedFetch('/api/trading/orders/open');
      const data = await response.json();
      
      if (response.ok && data.success) {
        setPositions(data.data);
      } else {
        showError('Erro', data.error || 'Falha ao carregar posições');
      }
    } catch (error: any) {
      showError('Erro', error.message || 'Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePosition = async () => {
    if (!newPosition.quantity || parseFloat(newPosition.quantity) <= 0) {
      showWarning('Validação', 'Quantidade deve ser maior que zero');
      return;
    }

    if (newPosition.type === 'LIMIT' && (!newPosition.price || parseFloat(newPosition.price) <= 0)) {
      showWarning('Validação', 'Preço deve ser maior que zero para ordens limit');
      return;
    }

    setLoading(true);
    try {
      // Test order first
      const testData = {
        symbol: newPosition.symbol,
        side: newPosition.side,
        type: newPosition.type,
        quantity: newPosition.quantity,
        ...(newPosition.type === 'LIMIT' && { 
          price: newPosition.price,
          timeInForce: 'GTC'
        })
      };

      const testResponse = await authenticatedFetch('/api/trading/order/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });

      const testResult = await testResponse.json();
      if (!testResponse.ok || !testResult.success) {
        showError('Validação', testResult.error || 'Ordem inválida');
        return;
      }

      // Create actual order
      const createResponse = await authenticatedFetch('/api/trading/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });

      const createResult = await createResponse.json();
      if (createResponse.ok && createResult.success) {
        const order = createResult.data;
        showSuccess(
          'Posição Criada',
          `${order.side} ${order.symbol} - ID: ${order.orderId} (${order.status})`
        );
        
        setNewPosition({
          symbol: 'BTCUSDT',
          side: 'BUY',
          type: 'LIMIT',
          quantity: '',
          price: ''
        });
        setShowNewPosition(false);
        fetchPositions();
      } else {
        showError('Erro', createResult.error || 'Falha ao criar posição');
      }
    } catch (error: any) {
      showError('Erro', error.message || 'Erro ao criar posição');
    } finally {
      setLoading(false);
    }
  };

  const handleClosePosition = async (position: Position) => {
    const confirmed = window.confirm(
      `Tem certeza que deseja fechar a posição ${position.symbol} ${position.side}?`
    );
    
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await authenticatedFetch(
        `/api/trading/order/${position.symbol}/${position.orderId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();
      if (response.ok && data.success) {
        showSuccess(
          'Posição Fechada',
          `${position.symbol} ${position.side} fechada com sucesso`
        );
        fetchPositions();
      } else {
        showError('Erro', data.error || 'Falha ao fechar posição');
      }
    } catch (error: any) {
      showError('Erro', error.message || 'Erro ao fechar posição');
    } finally {
      setLoading(false);
    }
  };

  const handleModifyPosition = async (position: Position) => {
    const newPrice = prompt(
      `Novo preço para ${position.symbol} ${position.side}:`,
      position.price
    );
    
    if (!newPrice || newPrice === position.price) return;

    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      showWarning('Validação', 'Preço inválido');
      return;
    }

    setLoading(true);
    try {
      // Cancel original order
      const cancelResponse = await authenticatedFetch(
        `/api/trading/order/${position.symbol}/${position.orderId}`,
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
          symbol: position.symbol,
          side: position.side,
          type: position.type,
          quantity: position.origQty,
          price: newPrice,
          timeInForce: 'GTC'
        })
      });

      const createData = await createResponse.json();
      if (createResponse.ok && createData.success) {
        showSuccess(
          'Posição Modificada',
          `${position.symbol} ${position.side} - Novo preço: ${newPrice}`
        );
        fetchPositions();
      } else {
        showError('Erro', createData.error || 'Falha ao criar nova ordem');
      }
    } catch (error: any) {
      showError('Erro', error.message || 'Erro ao modificar posição');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPositions, 30000);
    return () => clearInterval(interval);
  }, []);

  const getPositionValue = (position: Position) => {
    const quantity = parseFloat(position.origQty);
    const price = parseFloat(position.price);
    return (quantity * price).toFixed(2);
  };

  const totalPositionValue = positions.reduce((total, position) => {
    return total + parseFloat(getPositionValue(position));
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center justify-between">
            <span className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              Gerenciador de Posições
            </span>
            <div className="flex items-center space-x-2">
              <Button
                onClick={fetchPositions}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-sm px-3 py-1"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              <Button
                onClick={() => setShowNewPosition(!showNewPosition)}
                className="bg-green-600 hover:bg-green-700 text-sm px-3 py-1"
              >
                <Plus className="w-4 h-4 mr-1" />
                Nova Posição
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 bg-white/5 rounded border border-white/10">
              <div className="text-sm text-gray-400">Posições Abertas</div>
              <div className="text-xl font-bold text-white">{positions.length}</div>
            </div>
            <div className="p-3 bg-white/5 rounded border border-white/10">
              <div className="text-sm text-gray-400">Valor Total</div>
              <div className="text-xl font-bold text-white">${totalPositionValue.toFixed(2)}</div>
            </div>
            <div className="p-3 bg-white/5 rounded border border-white/10">
              <div className="text-sm text-gray-400">Status</div>
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-400 mr-1" />
                <span className="text-green-400 text-sm">Ativo</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Position Form */}
      {showNewPosition && (
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Plus className="w-5 h-5 mr-2" />
              Nova Posição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-white text-sm block mb-1">Símbolo</label>
                <select
                  value={newPosition.symbol}
                  onChange={(e) => setNewPosition(prev => ({ ...prev, symbol: e.target.value }))}
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
                  value={newPosition.type}
                  onChange={(e) => setNewPosition(prev => ({ ...prev, type: e.target.value as any }))}
                  className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                >
                  <option value="MARKET">Market</option>
                  <option value="LIMIT">Limit</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => setNewPosition(prev => ({ ...prev, side: 'BUY' }))}
                className={`${
                  newPosition.side === 'BUY' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-gray-600 hover:bg-gray-700'
                } text-white flex items-center justify-center`}
              >
                <TrendingUp className="w-4 h-4 mr-1" />
                Comprar
              </Button>
              <Button
                onClick={() => setNewPosition(prev => ({ ...prev, side: 'SELL' }))}
                className={`${
                  newPosition.side === 'SELL' 
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
                  value={newPosition.quantity}
                  onChange={(e) => setNewPosition(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                  placeholder="0.001"
                  step="0.001"
                />
              </div>
              {newPosition.type === 'LIMIT' && (
                <div>
                  <label className="text-white text-sm block mb-1">Preço</label>
                  <input
                    type="number"
                    value={newPosition.price}
                    onChange={(e) => setNewPosition(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full p-2 bg-white/10 border border-white/20 rounded text-white"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={handleCreatePosition}
                disabled={loading}
                className={`flex-1 ${
                  newPosition.side === 'BUY' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                } text-white`}
              >
                {loading ? 'Criando...' : `${newPosition.side === 'BUY' ? 'Comprar' : 'Vender'}`}
              </Button>
              <Button
                onClick={() => setShowNewPosition(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Positions List */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader>
          <CardTitle className="text-white">
            Posições Abertas ({positions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {positions.length > 0 ? (
            <div className="space-y-3">
              {positions.map((position) => (
                <div key={position.orderId} className="p-4 bg-white/5 rounded border border-white/10">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                      <span className="text-white font-semibold text-lg">{position.symbol}</span>
                      <Badge className={`${position.side === 'BUY' ? 'bg-green-500' : 'bg-red-500'}`}>
                        {position.side}
                      </Badge>
                      <Badge className="bg-blue-500">{position.type}</Badge>
                      <Badge className="bg-yellow-500">{position.status}</Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-semibold">${getPositionValue(position)}</div>
                      <div className="text-gray-400 text-sm">ID: {position.orderId}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3 text-sm">
                    <div>
                      <span className="text-gray-400">Quantidade:</span>
                      <span className="text-white ml-1">{position.origQty}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Preço:</span>
                      <span className="text-white ml-1">${position.price}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Tipo:</span>
                      <span className="text-white ml-1">{position.type}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Criado:</span>
                      <span className="text-white ml-1">
                        {new Date(position.time).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    {position.status === 'NEW' && position.type === 'LIMIT' && (
                      <Button
                        onClick={() => handleModifyPosition(position)}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1 flex items-center"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Modificar
                      </Button>
                    )}
                    
                    {(position.status === 'NEW' || position.status === 'PARTIALLY_FILLED') && (
                      <Button
                        onClick={() => handleClosePosition(position)}
                        disabled={loading}
                        className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 flex items-center"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Fechar
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Nenhuma posição aberta</p>
              <p className="text-gray-500 text-sm">Clique em "Nova Posição" para começar</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};