import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import { db } from './database/connection';
import authRoutes from './routes/auth';
import tradingRoutes from './routes/trading';
import marketRoutes from './routes/market';
import { requestMonitoring, getMonitoringStats, getMonitoringMetrics } from './middleware/monitoring';

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware básico
app.use(cors());
app.use(express.json());
app.use(requestMonitoring);

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/market', marketRoutes);

// Rota de monitoramento
app.get('/api/monitoring/stats', (req, res) => {
  res.json({
    success: true,
    data: getMonitoringStats()
  });
});

app.get('/api/monitoring/metrics', (req, res) => {
  const limit = parseInt(req.query.limit as string) || 100;
  res.json({
    success: true,
    data: getMonitoringMetrics(limit)
  });
});

// Inicializar conexões
let dbConnected = false;
let redisConnected = false;

// Conectar ao banco
db.connect()
  .then(() => {
    dbConnected = true;
    logger.info('Database connected successfully');
  })
  .catch((error) => {
    logger.error('Database connection failed:', error);
  });

// Rotas básicas
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'aura-backend',
    version: '1.0.0'
  });
});

app.get('/api/status', async (req, res) => {
  try {
    // Testar conexão com banco
    let dbStatus = 'unhealthy';
    try {
      await db.query('SELECT 1');
      dbStatus = 'healthy';
    } catch (error) {
      logger.error('Database health check failed:', error);
    }

    // Status geral
    const overallStatus = dbStatus === 'healthy' ? 'healthy' : 'degraded';

    res.json({
      success: true,
      status: overallStatus,
      services: {
        database: dbStatus,
        redis: 'not_implemented',
        marketData: 'not_implemented'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Status check failed:', error);
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: 'Status check failed'
    });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'AURA Backend is running!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handler
app.use((error: any, req: any, res: any, next: any) => {
  logger.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`🚀 AURA Backend running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});