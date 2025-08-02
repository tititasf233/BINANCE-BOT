import { RedisService } from '../services/RedisService';
import { logger } from '../utils/logger';

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    load: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  database: {
    connections: number;
    queries: number;
    avgResponseTime: number;
  };
  trading: {
    activeStrategies: number;
    totalTrades: number;
    successRate: number;
    avgLatency: number;
  };
  api: {
    requestsPerMinute: number;
    errorRate: number;
    avgResponseTime: number;
  };
}

export interface TradingMetrics {
  symbol: string;
  strategy: string;
  totalTrades: number;
  winRate: number;
  totalPnL: number;
  avgTradeTime: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export class MetricsCollector {
  private redis: RedisService;
  private metricsInterval: NodeJS.Timeout | null = null;
  private readonly METRICS_KEY = 'system:metrics';
  private readonly TRADING_METRICS_KEY = 'trading:metrics';

  constructor() {
    this.redis = new RedisService();
  }

  public async start(): Promise<void> {
    logger.info('Starting metrics collection');
    
    // Collect metrics every 30 seconds
    this.metricsInterval = setInterval(async () => {
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        logger.error('Error collecting system metrics', { error });
      }
    }, 30000);
  }

  public async stop(): Promise<void> {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
    logger.info('Stopped metrics collection');
  }

  private async collectSystemMetrics(): Promise<void> {
    const metrics: SystemMetrics = {
      timestamp: Date.now(),
      cpu: await this.getCpuMetrics(),
      memory: await this.getMemoryMetrics(),
      database: await this.getDatabaseMetrics(),
      trading: await this.getTradingMetrics(),
      api: await this.getApiMetrics()
    };

    // Store metrics in Redis with TTL of 24 hours
    await this.redis.setex(
      `${this.METRICS_KEY}:${metrics.timestamp}`,
      86400,
      JSON.stringify(metrics)
    );

    // Keep only last 100 metric entries
    await this.cleanupOldMetrics();

    logger.debug('System metrics collected', { metrics });
  }

  private async getCpuMetrics(): Promise<SystemMetrics['cpu']> {
    const os = await import('os');
    const cpus = os.cpus();
    
    // Calculate CPU usage
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const usage = 100 - (totalIdle / totalTick * 100);
    const load = os.loadavg();

    return { usage, load };
  }

  private async getMemoryMetrics(): Promise<SystemMetrics['memory']> {
    const os = await import('os');
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;

    return { used, total, percentage };
  }

  private async getDatabaseMetrics(): Promise<SystemMetrics['database']> {
    // These would be collected from actual database connection pool
    // For now, returning mock data
    return {
      connections: 5,
      queries: await this.getQueryCount(),
      avgResponseTime: await this.getAvgDbResponseTime()
    };
  }

  private async getTradingMetrics(): Promise<SystemMetrics['trading']> {
    const activeStrategies = await this.redis.scard('active:strategies') || 0;
    const totalTrades = await this.getTotalTradesCount();
    const successRate = await this.getSuccessRate();
    const avgLatency = await this.getAvgTradingLatency();

    return {
      activeStrategies,
      totalTrades,
      successRate,
      avgLatency
    };
  }

  private async getApiMetrics(): Promise<SystemMetrics['api']> {
    const requestsPerMinute = await this.getRequestsPerMinute();
    const errorRate = await this.getErrorRate();
    const avgResponseTime = await this.getAvgApiResponseTime();

    return {
      requestsPerMinute,
      errorRate,
      avgResponseTime
    };
  }

  public async recordTradingMetric(metric: Partial<TradingMetrics>): Promise<void> {
    const key = `${this.TRADING_METRICS_KEY}:${metric.symbol}:${metric.strategy}`;
    const existing = await this.redis.get(key);
    
    let current: TradingMetrics;
    if (existing) {
      current = JSON.parse(existing);
    } else {
      current = {
        symbol: metric.symbol || '',
        strategy: metric.strategy || '',
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgTradeTime: 0,
        maxDrawdown: 0,
        sharpeRatio: 0
      };
    }

    // Update metrics
    if (metric.totalTrades !== undefined) current.totalTrades = metric.totalTrades;
    if (metric.winRate !== undefined) current.winRate = metric.winRate;
    if (metric.totalPnL !== undefined) current.totalPnL = metric.totalPnL;
    if (metric.avgTradeTime !== undefined) current.avgTradeTime = metric.avgTradeTime;
    if (metric.maxDrawdown !== undefined) current.maxDrawdown = metric.maxDrawdown;
    if (metric.sharpeRatio !== undefined) current.sharpeRatio = metric.sharpeRatio;

    await this.redis.setex(key, 86400, JSON.stringify(current));
  }

  public async getSystemMetrics(hours: number = 1): Promise<SystemMetrics[]> {
    const now = Date.now();
    const startTime = now - (hours * 60 * 60 * 1000);
    
    const keys = await this.redis.keys(`${this.METRICS_KEY}:*`);
    const metrics: SystemMetrics[] = [];

    for (const key of keys) {
      const timestamp = parseInt(key.split(':')[2]);
      if (timestamp >= startTime) {
        const data = await this.redis.get(key);
        if (data) {
          metrics.push(JSON.parse(data));
        }
      }
    }

    return metrics.sort((a, b) => a.timestamp - b.timestamp);
  }

  public async getTradingMetricsBySymbol(symbol: string): Promise<TradingMetrics[]> {
    const keys = await this.redis.keys(`${this.TRADING_METRICS_KEY}:${symbol}:*`);
    const metrics: TradingMetrics[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        metrics.push(JSON.parse(data));
      }
    }

    return metrics;
  }

  private async cleanupOldMetrics(): Promise<void> {
    const keys = await this.redis.keys(`${this.METRICS_KEY}:*`);
    if (keys.length > 100) {
      // Sort by timestamp and remove oldest
      const timestamps = keys.map(key => ({
        key,
        timestamp: parseInt(key.split(':')[2])
      })).sort((a, b) => a.timestamp - b.timestamp);

      const toDelete = timestamps.slice(0, keys.length - 100);
      for (const item of toDelete) {
        await this.redis.del(item.key);
      }
    }
  }

  private async getQueryCount(): Promise<number> {
    const count = await this.redis.get('metrics:db:queries');
    return count ? parseInt(count) : 0;
  }

  private async getAvgDbResponseTime(): Promise<number> {
    const time = await this.redis.get('metrics:db:avg_response_time');
    return time ? parseFloat(time) : 0;
  }

  private async getTotalTradesCount(): Promise<number> {
    const count = await this.redis.get('metrics:trading:total_trades');
    return count ? parseInt(count) : 0;
  }

  private async getSuccessRate(): Promise<number> {
    const rate = await this.redis.get('metrics:trading:success_rate');
    return rate ? parseFloat(rate) : 0;
  }

  private async getAvgTradingLatency(): Promise<number> {
    const latency = await this.redis.get('metrics:trading:avg_latency');
    return latency ? parseFloat(latency) : 0;
  }

  private async getRequestsPerMinute(): Promise<number> {
    const count = await this.redis.get('metrics:api:requests_per_minute');
    return count ? parseInt(count) : 0;
  }

  private async getErrorRate(): Promise<number> {
    const rate = await this.redis.get('metrics:api:error_rate');
    return rate ? parseFloat(rate) : 0;
  }

  private async getAvgApiResponseTime(): Promise<number> {
    const time = await this.redis.get('metrics:api:avg_response_time');
    return time ? parseFloat(time) : 0;
  }
}