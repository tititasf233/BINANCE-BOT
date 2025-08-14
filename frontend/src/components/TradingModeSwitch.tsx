import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

interface TradingModeSwitchProps {
  className?: string;
}

export const TradingModeSwitch: React.FC<TradingModeSwitchProps> = ({ className = '' }) => {
  const { apiCall } = useAuth();
  const [isTestnet, setIsTestnet] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Carregar modo atual
  useEffect(() => {
    loadCurrentMode();
  }, []);

  const loadCurrentMode = async () => {
    try {
      const response = await apiCall('/api/trading/mode');
      if (response.success) {
        setIsTestnet(response.data.isTestnet);
      }
    } catch (error) {
      console.error('Failed to load trading mode:', error);
      setError('Failed to load current mode');
    }
  };

  const toggleMode = async () => {
    if (loading) return;

    const newMode = !isTestnet;
    
    // Confirmar se o usuário quer mudar para modo real
    if (!newMode && !isTestnet) {
      const confirmed = window.confirm(
        '⚠️ ATENÇÃO: Você está prestes a ativar o modo REAL com fundos reais!\n\n' +
        'No modo REAL:\n' +
        '• Todas as operações usarão dinheiro real\n' +
        '• Perdas são reais e irreversíveis\n' +
        '• Certifique-se de entender os riscos\n\n' +
        'Deseja continuar?'
      );
      
      if (!confirmed) return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await apiCall('/api/trading/toggle-mode', {
        method: 'POST',
        body: JSON.stringify({ isTestnet: newMode })
      });

      if (response.success) {
        setIsTestnet(newMode);
        
        // Mostrar notificação de sucesso
        const message = newMode 
          ? '✅ Modo DEMO ativado - Operações seguras com dados simulados'
          : '⚠️ Modo REAL ativado - CUIDADO: Operações com dinheiro real!';
        
        alert(message);
        
        // Recarregar a página para aplicar as mudanças
        window.location.reload();
      } else {
        setError(response.error || 'Failed to toggle mode');
      }
    } catch (error) {
      console.error('Failed to toggle mode:', error);
      setError('Failed to toggle trading mode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`trading-mode-switch ${className}`}>
      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Modo:</span>
          
          {/* Switch Toggle */}
          <button
            onClick={toggleMode}
            disabled={loading}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors
              ${isTestnet 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-red-600 hover:bg-red-700'
              }
              ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                ${isTestnet ? 'translate-x-1' : 'translate-x-6'}
              `}
            />
          </button>

          {/* Mode Label */}
          <div className="flex items-center space-x-1">
            <span className={`
              text-sm font-semibold
              ${isTestnet ? 'text-blue-600' : 'text-red-600'}
            `}>
              {isTestnet ? '🧪 DEMO' : '💰 REAL'}
            </span>
            
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
            )}
          </div>
        </div>

        {/* Warning for Real Mode */}
        {!isTestnet && (
          <div className="flex items-center space-x-1 text-red-600">
            <span className="text-xs">⚠️</span>
            <span className="text-xs font-medium">FUNDOS REAIS</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {/* Mode Description */}
      <div className="mt-2 text-xs text-gray-500">
        {isTestnet 
          ? 'Modo seguro para testes - Sem riscos financeiros'
          : 'Modo real - Operações com dinheiro real'
        }
      </div>
    </div>
  );
};