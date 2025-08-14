// Configuração para garantir que sempre usemos dados reais
export const REAL_DATA_CONFIG = {
  // Binance sempre em modo real (testnet para desenvolvimento)
  BINANCE: {
    USE_REAL_DATA: true,
    USE_TESTNET: true, // Seguro para desenvolvimento
    CACHE_TTL: 5000, // 5 segundos
    UPDATE_INTERVAL: 30000, // 30 segundos
  },
  
  // Sistema de monitoramento sempre real
  MONITORING: {
    USE_REAL_STATS: true,
    UPDATE_INTERVAL: 30000, // 30 segundos
  },
  
  // Dados de mercado sempre reais
  MARKET_DATA: {
    USE_REAL_PRICES: true,
    DEFAULT_SYMBOLS: [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT',
      'XRPUSDT', 'DOTUSDT', 'LINKUSDT', 'LTCUSDT', 'BCHUSDT'
    ],
    CACHE_TTL: 5000, // 5 segundos
  },
  
  // Performance sempre baseada em dados reais
  PERFORMANCE: {
    USE_REAL_METRICS: true,
    CHART_POINTS: 7, // 7 pontos no gráfico
    BASE_ON_SYSTEM_STATS: true,
  }
};

// Função para validar se estamos usando dados reais
export const validateRealDataConfig = () => {
  const errors: string[] = [];
  
  if (!REAL_DATA_CONFIG.BINANCE.USE_REAL_DATA) {
    errors.push('Binance não está configurado para usar dados reais');
  }
  
  if (!REAL_DATA_CONFIG.MONITORING.USE_REAL_STATS) {
    errors.push('Monitoramento não está configurado para usar dados reais');
  }
  
  if (!REAL_DATA_CONFIG.MARKET_DATA.USE_REAL_PRICES) {
    errors.push('Dados de mercado não estão configurados para usar preços reais');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuração inválida: ${errors.join(', ')}`);
  }
  
  return true;
};

// Configurações de ambiente para dados reais
export const ENVIRONMENT_CONFIG = {
  development: {
    BINANCE_USE_TESTNET: true,
    LOG_LEVEL: 'debug',
    CACHE_TTL: 5000,
  },
  production: {
    BINANCE_USE_TESTNET: false, // CUIDADO: Mainnet em produção
    LOG_LEVEL: 'info',
    CACHE_TTL: 10000,
  }
};

export default REAL_DATA_CONFIG;