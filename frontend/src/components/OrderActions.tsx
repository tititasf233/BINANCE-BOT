import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { X, Edit, AlertTriangle } from './icons/Icons';
import { useAuthContext } from '../contexts/AuthContext';

interface OrderActionsProps {
  order: {
    orderId: number;
    symbol: string;
    side: string;
    type: string;
    origQty: string;
    price: string;
    status: string;
  };
  onOrderUpdated: () => void;
}

export const OrderActions: React.FC<OrderActionsProps> = ({ order, onOrderUpdated }) => {
  const { authenticatedFetch } = useAuthContext();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState(order.price);

  // Update newPrice when order changes
  useEffect(() => {
    setNewPrice(order.price);
  }, [order.price]);

  const handleCancelOrder = async () => {
    setLoading('cancel');
    setError(null);

    try {
      const response = await authenticatedFetch(
        `/api/trading/order/${order.symbol}/${order.orderId}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        // Show success message
        console.log('✅ Ordem cancelada com sucesso:', data.data);
        setShowConfirm(null);
        
        // Force immediate update
        setTimeout(() => {
          onOrderUpdated();
        }, 100);
      } else {
        setError(data.error || 'Erro ao cancelar ordem');
      }
    } catch (err: any) {
      console.error('❌ Erro ao cancelar ordem:', err);
      setError(err.message || 'Erro de conexão');
    } finally {
      setLoading(null);
    }
  };

  const handleModifyOrder = async (newPrice: string) => {
    setLoading('modify');
    setError(null);

    // Validate new price
    const priceNum = parseFloat(newPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Preço inválido');
      setLoading(null);
      return;
    }

    try {
      // Primeiro cancelar a ordem atual
      const cancelResponse = await authenticatedFetch(
        `/api/trading/order/${order.symbol}/${order.orderId}`,
        { method: 'DELETE' }
      );

      if (!cancelResponse.ok) {
        const cancelData = await cancelResponse.json();
        throw new Error(cancelData.error || 'Erro ao cancelar ordem original');
      }

      console.log('✅ Ordem original cancelada');

      // Criar nova ordem com novo preço
      const createResponse = await authenticatedFetch('/api/trading/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
        console.log('✅ Nova ordem criada:', createData.data);
        setShowConfirm(null);
        
        // Force immediate update
        setTimeout(() => {
          onOrderUpdated();
        }, 100);
      } else {
        setError(createData.error || 'Erro ao criar nova ordem');
      }
    } catch (err: any) {
      console.error('❌ Erro ao modificar ordem:', err);
      setError(err.message || 'Erro ao modificar ordem');
    } finally {
      setLoading(null);
    }
  };

  if (showConfirm === 'cancel') {
    return (
      <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
        <div className="flex items-center space-x-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="text-red-300 text-sm font-medium">
            Confirmar Cancelamento
          </span>
        </div>
        <p className="text-red-200 text-sm mb-3">
          Tem certeza que deseja cancelar esta ordem?
        </p>
        <div className="flex space-x-2">
          <Button
            onClick={handleCancelOrder}
            disabled={loading === 'cancel'}
            className="bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1"
          >
            {loading === 'cancel' ? 'Cancelando...' : 'Sim, Cancelar'}
          </Button>
          <Button
            onClick={() => setShowConfirm(null)}
            className="bg-gray-600 hover:bg-gray-700 text-white text-sm px-3 py-1"
          >
            Não
          </Button>
        </div>
      </div>
    );
  }

  if (showConfirm === 'modify') {
    return (
      <div className="p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
        <div className="flex items-center space-x-2 mb-3">
          <Edit className="w-4 h-4 text-blue-400" />
          <span className="text-blue-300 text-sm font-medium">
            Modificar Preço
          </span>
        </div>
        <div className="mb-3">
          <label className="text-blue-200 text-xs block mb-1">Novo Preço:</label>
          <input
            type="number"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            className="w-full p-2 bg-white/10 border border-white/20 rounded text-white text-sm"
            step="0.01"
          />
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={() => handleModifyOrder(newPrice)}
            disabled={loading === 'modify' || !newPrice || newPrice === order.price}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1"
          >
            {loading === 'modify' ? 'Modificando...' : 'Confirmar'}
          </Button>
          <Button
            onClick={() => setShowConfirm(null)}
            className="bg-gray-600 hover:bg-gray-700 text-white text-sm px-3 py-1"
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="p-2 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-xs">
          {error}
        </div>
      )}
      
      <div className="flex space-x-2">
        {order.status === 'NEW' && order.type === 'LIMIT' && (
          <Button
            onClick={() => setShowConfirm('modify')}
            disabled={loading !== null}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 flex items-center"
          >
            <Edit className="w-3 h-3 mr-1" />
            Modificar
          </Button>
        )}
        
        {(order.status === 'NEW' || order.status === 'PARTIALLY_FILLED') && (
          <Button
            onClick={() => setShowConfirm('cancel')}
            disabled={loading !== null}
            className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 flex items-center"
          >
            <X className="w-3 h-3 mr-1" />
            Cancelar
          </Button>
        )}
        
        {order.status === 'FILLED' && (
          <Badge className="bg-green-500 text-xs">
            Executada
          </Badge>
        )}
        
        {order.status === 'CANCELED' && (
          <Badge className="bg-gray-500 text-xs">
            Cancelada
          </Badge>
        )}
      </div>
    </div>
  );
};