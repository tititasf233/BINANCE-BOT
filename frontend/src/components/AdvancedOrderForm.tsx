import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Select } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { TrendingUp, TrendingDown, DollarSign, Zap } from './icons/Icons';
import { useAuthContext } from '../contexts/AuthContext';
import { useNotifications } from './Notification';

interface AdvancedOrderFormProps {
  symbol: string;
  currentPrice?: string;
  onOrderCreated?: () => void;
}

export const AdvancedOrderForm: React.FC<AdvancedOrderFormProps> = ({
  symbol,
  currentPrice = '0',
  onOrderCreated
}) => {
  const { authenticatedFetch } = useAuthContext();
  const { showSuccess, showError, showWarning } = useNotifications();
  
  const [orderData, setOrderData] = useState({
    side: 'BUY' as 'BUY' | 'SELL',
    type: 'LIMIT' as 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT',
    quantity: '',
    price: currentPrice,
    stopPrice: '',
    timeInForce: 'GTC' as 'GTC' | 'IOC' | 'FOK'
  });
  
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [estimatedCost, setEstimatedCost] = useState('0');

  // Update price when currentPrice changes
  useEffect(() => {
    if (currentPrice && orderData.type === 'LIMIT') {
      setOrderData(prev => ({ ...prev, price: currentPrice }));
    }
  }, [currentPrice, orderData.type]);

  // Calculate estimated cost
  useEffect(() => {
    const quantity = parseFloat(orderData.quantity) || 0;
    const price = parseFloat(orderData.price) || 0;
    const cost = quantity * price;
    setEstimatedCost(cost.toFixed(2));
  }, [orderData.quantity, orderData.price]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!orderData.quantity || parseFloat(orderData.quantity) <= 0) {
      newErrors.quantity = 'Quantidade deve ser maior que zero';
    }

    if (orderData.type === 'LIMIT' && (!orderData.price || parseFloat(orderData.price) <= 0)) {
      newErrors.price = 'Preço deve ser maior que zero';
    }

    if (['STOP_LOSS', 'TAKE_PROFIT'].includes(orderData.type) && 
        (!orderData.stopPrice || parseFloat(orderData.stopPrice) <= 0)) {
      newErrors.stopPrice = 'Stop price deve ser maior que zero';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestOrder = async () => {
    if (!validateForm()) {
      showWarning('Validação', 'Por favor, corrija os erros no formulário');
      return;
    }

    setLoading(true);
    try {
      const response = await authenticatedFetch('/api/trading/order/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          ...orderData
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showSuccess('Teste de Ordem', 'Ordem válida! Pode ser executada com segurança.');
      } else {
        showError('Teste de Ordem', data.error || 'Ordem inválida');
      }
    } catch (error: any) {
      showError('Erro', error.message || 'Erro ao testar ordem');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!validateForm()) {
      showWarning('Validação', 'Por favor, corrija os erros no formulário');
      return;
    }

    setLoading(true);
    try {
      const response = await authenticatedFetch('/api/trading/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          ...orderData
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        showSuccess(
          'Ordem Criada', 
          `Ordem ${data.data.side} ${symbol} criada com sucesso! ID: ${data.data.orderId}`
        );
        
        // Reset form
        setOrderData(prev => ({
          ...prev,
          quantity: '',
          price: currentPrice,
          stopPrice: ''
        }));
        
        onOrderCreated?.();
      } else {
        showError('Erro na Ordem', data.error || 'Falha ao criar ordem');
      }
    } catch (error: any) {
      showError('Erro', error.message || 'Erro ao criar ordem');
    } finally {
      setLoading(false);
    }
  };

  const getOrderTypeDescription = () => {
    switch (orderData.type) {
      case 'MARKET':
        return 'Executa imediatamente ao preço de mercado';
      case 'LIMIT':
        return 'Executa apenas ao preço especificado ou melhor';
      case 'STOP_LOSS':
        return 'Vende quando o preço cai abaixo do stop price';
      case 'TAKE_PROFIT':
        return 'Vende quando o preço sobe acima do take profit';
      default:
        return '';
    }
  };

  return (
    <Card className="bg-white/10 backdrop-blur-sm border-white/20">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <DollarSign className="w-5 h-5 mr-2" />
          Criar Ordem - {symbol}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Side Selection */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => setOrderData(prev => ({ ...prev, side: 'BUY' }))}
            className={`${
              orderData.side === 'BUY' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            } text-white flex items-center justify-center`}
          >
            <TrendingUp className="w-4 h-4 mr-1" />
            Comprar
          </Button>
          <Button
            onClick={() => setOrderData(prev => ({ ...prev, side: 'SELL' }))}
            className={`${
              orderData.side === 'SELL' 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-gray-600 hover:bg-gray-700'
            } text-white flex items-center justify-center`}
          >
            <TrendingDown className="w-4 h-4 mr-1" />
            Vender
          </Button>
        </div>

        {/* Order Type */}
        <div>
          <label className="text-white text-sm block mb-1">Tipo de Ordem</label>
          <select
            value={orderData.type}
            onChange={(e) => setOrderData(prev => ({ 
              ...prev, 
              type: e.target.value as any 
            }))}
            className="w-full p-2 bg-white/10 border border-white/20 rounded text-white text-sm"
          >
            <option value="MARKET">Market</option>
            <option value="LIMIT">Limit</option>
            <option value="STOP_LOSS">Stop Loss</option>
            <option value="TAKE_PROFIT">Take Profit</option>
          </select>
          <p className="text-gray-400 text-xs mt-1">{getOrderTypeDescription()}</p>
        </div>

        {/* Quantity */}
        <div>
          <label className="text-white text-sm block mb-1">Quantidade</label>
          <input
            type="number"
            value={orderData.quantity}
            onChange={(e) => setOrderData(prev => ({ ...prev, quantity: e.target.value }))}
            className="w-full p-2 bg-white/10 border border-white/20 rounded text-white text-sm"
            placeholder="0.001"
            step="0.001"
          />
          {errors.quantity && (
            <p className="text-red-400 text-xs mt-1">{errors.quantity}</p>
          )}
        </div>

        {/* Price (for LIMIT orders) */}
        {orderData.type === 'LIMIT' && (
          <div>
            <label className="text-white text-sm block mb-1">Preço</label>
            <input
              type="number"
              value={orderData.price}
              onChange={(e) => setOrderData(prev => ({ ...prev, price: e.target.value }))}
              className="w-full p-2 bg-white/10 border border-white/20 rounded text-white text-sm"
              placeholder="0.00"
              step="0.01"
            />
            {errors.price && (
              <p className="text-red-400 text-xs mt-1">{errors.price}</p>
            )}
          </div>
        )}

        {/* Stop Price (for STOP orders) */}
        {['STOP_LOSS', 'TAKE_PROFIT'].includes(orderData.type) && (
          <div>
            <label className="text-white text-sm block mb-1">Stop Price</label>
            <input
              type="number"
              value={orderData.stopPrice}
              onChange={(e) => setOrderData(prev => ({ ...prev, stopPrice: e.target.value }))}
              className="w-full p-2 bg-white/10 border border-white/20 rounded text-white text-sm"
              placeholder="0.00"
              step="0.01"
            />
            {errors.stopPrice && (
              <p className="text-red-400 text-xs mt-1">{errors.stopPrice}</p>
            )}
          </div>
        )}

        {/* Time in Force (for LIMIT orders) */}
        {orderData.type === 'LIMIT' && (
          <div>
            <label className="text-white text-sm block mb-1">Time in Force</label>
            <select
              value={orderData.timeInForce}
              onChange={(e) => setOrderData(prev => ({ 
                ...prev, 
                timeInForce: e.target.value as any 
              }))}
              className="w-full p-2 bg-white/10 border border-white/20 rounded text-white text-sm"
            >
              <option value="GTC">GTC (Good Till Canceled)</option>
              <option value="IOC">IOC (Immediate or Cancel)</option>
              <option value="FOK">FOK (Fill or Kill)</option>
            </select>
          </div>
        )}

        {/* Estimated Cost */}
        {orderData.type === 'LIMIT' && estimatedCost !== '0' && (
          <div className="p-3 bg-blue-500/20 border border-blue-500/50 rounded">
            <p className="text-blue-300 text-sm">
              Custo Estimado: <span className="font-semibold">{estimatedCost} USDT</span>
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            onClick={handleTestOrder}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
          >
            <Zap className="w-4 h-4 mr-1" />
            {loading ? 'Testando...' : 'Testar'}
          </Button>
          <Button
            onClick={handleCreateOrder}
            disabled={loading}
            className={`flex-1 ${
              orderData.side === 'BUY' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            } text-white`}
          >
            {loading ? 'Criando...' : `${orderData.side === 'BUY' ? 'Comprar' : 'Vender'}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};