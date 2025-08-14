import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RequestMetrics {
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

class MonitoringService {
  private metrics: RequestMetrics[] = [];
  private readonly maxMetrics = 1000;

  addMetric(metric: RequestMetrics) {
    this.metrics.push(metric);
    
    // Manter apenas os últimos N registros
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Log de requisições lentas
    if (metric.responseTime > 1000) {
      logger.warn('Slow request detected', {
        method: metric.method,
        url: metric.url,
        responseTime: metric.responseTime,
        statusCode: metric.statusCode
      });
    }

    // Log de erros
    if (metric.statusCode >= 400) {
      logger.error('Error response', {
        method: metric.method,
        url: metric.url,
        statusCode: metric.statusCode,
        responseTime: metric.responseTime
      });
    }
  }

  getMetrics(limit: number = 100): RequestMetrics[] {
    return this.metrics.slice(-limit);
  }

  getStats() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentMetrics = this.metrics.filter(m => m.timestamp >= oneHourAgo);
    
    const totalRequests = recentMetrics.length;
    const errorRequests = recentMetrics.filter(m => m.statusCode >= 400).length;
    const avgResponseTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length 
      : 0;

    const statusCodes = recentMetrics.reduce((acc, m) => {
      acc[m.statusCode] = (acc[m.statusCode] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return {
      totalRequests,
      errorRequests,
      errorRate: totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0,
      avgResponseTime: Math.round(avgResponseTime),
      statusCodes,
      period: '1 hour'
    };
  }
}

const monitoringService = new MonitoringService();

export const requestMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Interceptar o final da resposta
  const originalSend = res.send;
  res.send = function(body) {
    const responseTime = Date.now() - startTime;
    
    const metric: RequestMetrics = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      timestamp: new Date(),
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };

    monitoringService.addMetric(metric);
    
    return originalSend.call(this, body);
  };

  next();
};

export const getMonitoringStats = () => monitoringService.getStats();
export const getMonitoringMetrics = (limit?: number) => monitoringService.getMetrics(limit);