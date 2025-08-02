import React, { useState, useEffect } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
  message: string;
  source: string;
}

export const LogsFeed: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  // Mock data - will be replaced with real WebSocket connection
  useEffect(() => {
    const mockLogs: LogEntry[] = [
      {
        id: '1',
        timestamp: new Date().toISOString(),
        level: 'SUCCESS',
        message: 'Ordem de compra executada: BTCUSDT - 0.1 BTC @ $43,500',
        source: 'ExecutionEngine',
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        level: 'INFO',
        message: 'Sinal de entrada detectado: RSI Strategy - ETHUSDT',
        source: 'StrategyEngine',
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 120000).toISOString(),
        level: 'WARN',
        message: 'Saldo baixo detectado: Apenas $500 disponível',
        source: 'RiskManager',
      },
      {
        id: '4',
        timestamp: new Date(Date.now() - 180000).toISOString(),
        level: 'INFO',
        message: 'Dados de mercado atualizados: 15 símbolos sincronizados',
        source: 'DataIngestor',
      },
      {
        id: '5',
        timestamp: new Date(Date.now() - 240000).toISOString(),
        level: 'ERROR',
        message: 'Falha na conexão WebSocket - Tentando reconectar...',
        source: 'DataIngestor',
      },
    ];

    setLogs(mockLogs);

    // Simulate real-time logs
    const interval = setInterval(() => {
      const newLog: LogEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        level: ['INFO', 'WARN', 'SUCCESS'][Math.floor(Math.random() * 3)] as LogEntry['level'],
        message: [
          'Heartbeat: Sistema funcionando normalmente',
          'Indicadores atualizados para BTCUSDT',
          'Nova oportunidade de arbitragem detectada',
          'Stop loss ativado para posição ETHUSDT',
        ][Math.floor(Math.random() * 4)],
        source: ['System', 'StrategyEngine', 'ExecutionEngine', 'RiskManager'][Math.floor(Math.random() * 4)],
      };

      setLogs(prev => [newLog, ...prev.slice(0, 49)]); // Keep only last 50 logs
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR');
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'SUCCESS':
        return 'text-green-600 bg-green-50';
      case 'WARN':
        return 'text-yellow-600 bg-yellow-50';
      case 'ERROR':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'SUCCESS':
        return '✅';
      case 'WARN':
        return '⚠️';
      case 'ERROR':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Logs do Sistema
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAutoScroll(!isAutoScroll)}
              className={`px-3 py-1 text-xs rounded-md ${
                isAutoScroll 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Auto-scroll {isAutoScroll ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setLogs([])}
              className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-md hover:bg-red-200"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      <div className="h-80 overflow-y-auto p-4 space-y-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex-shrink-0 mt-0.5">
              <span className="text-sm">{getLevelIcon(log.level)}</span>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getLevelColor(log.level)}`}>
                  {log.level}
                </span>
                <span className="text-xs text-gray-500">
                  {log.source}
                </span>
                <span className="text-xs text-gray-400">
                  {formatTime(log.timestamp)}
                </span>
              </div>
              
              <p className="text-sm text-gray-900 break-words">
                {log.message}
              </p>
            </div>
          </div>
        ))}

        {logs.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">📝</div>
            <div className="text-sm">Nenhum log disponível</div>
          </div>
        )}
      </div>
    </div>
  );
};