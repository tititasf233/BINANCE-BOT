import { useState, useEffect, useCallback } from 'react';

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  high24h: number;
  low24h: number;
  lastUpdate: string;
}

interface SystemStats {
  totalRequests: number;
  errorRate: number;
  avgResponseTime: number;
  statusCodes: Record<string, number>;
}

interface BinanceHealth {
  connected: boolean;
  serverTime: string;
  localTime: string;
  timeDifference: number;
  status: string;
  mode: string;
}

export const useRealTimeData = () => {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [binanceHealth, setBinanceHealth] = useState<BinanceHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const fetchMarketData = useCallback(async () => {
    try {
      const response = await fetch('/api/market/prices');
      if (response.ok) {
        const data = await response.json();
        setMarketData(data.data);
        setIsConnected(true);
        setLastUpdate(new Date().toISOString());
        setError(null);
      } else {
        throw new Error('Failed to fetch market data');
      }
    } catch (err) {
      console.error('Error fetching market data:', err);
      setError('Erro ao carregar dados de mercado');
      setIsConnected(false);
    }
  }, []);

  const fetchSystemStats = useCallback(async () => {
    try {
      const response = await fetch('/api/monitoring/stats');
      if (response.ok) {
        const data = await response.json();
        setSystemStats(data.data);
      }
    } catch (err) {
      console.error('Error fetching system stats:', err);
    }
  }, []);

  const fetchBinanceHealth = useCallback(async () => {
    try {
      const response = await fetch('/api/market/health');
      if (response.ok) {
        const data = await response.json();
        setBinanceHealth(data.data);
      }
    } catch (err) {
      console.error('Error fetching Binance health:', err);
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchMarketData(),
        fetchSystemStats(),
        fetchBinanceHealth()
      ]);
    } catch (err) {
      setError('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [fetchMarketData, fetchSystemStats, fetchBinanceHealth]);

  useEffect(() => {
    // Carregar dados iniciais
    fetchAllData();

    // Configurar atualizações automáticas apenas se necessário
    const interval = setInterval(() => {
      // Verificar se a aba está ativa para economizar recursos
      if (!document.hidden) {
        fetchAllData();
      }
    }, 15000); // Atualizar a cada 15 segundos

    return () => clearInterval(interval);
  }, [fetchAllData]);

  return {
    marketData,
    systemStats,
    binanceHealth,
    loading,
    error,
    isConnected,
    lastUpdate,
    refetch: fetchAllData
  };
};