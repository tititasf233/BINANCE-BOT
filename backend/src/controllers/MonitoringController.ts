import { Request, Response } from 'express';
import { SystemMonitor } from '../monitoring/SystemMonitor';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';
import { AlertManager } from '../monitoring/AlertManager';
import { MetricsCollector } from '../monitoring/MetricsCollector';
import { HealthChecker } from '../monitoring/HealthChecker';
import { logger } from '../utils/logger';

export class MonitoringController {
  private systemMonitor: SystemMonitor;
  private performanceMonitor: PerformanceMonitor;
  private alertManager: AlertManager;
  private metricsCollector: MetricsCollector;
  private healthChecker: HealthChecker;

  constructor() {
    this.systemMonitor = new SystemMonitor();
    this.performanceMonitor = new PerformanceMonitor();
    this.alertManager = new AlertManager();
    this.metricsCollector = new MetricsCollector();
    this.healthChecker = new HealthChecker();
  }

  public async getSystemMetrics(req: Request, res: Response): Promise<void> {
    try {
      const hours = parseInt(req.query.hours as string) || 1;
      const metrics = await this.metricsCollector.getSystemMetrics(hours);
      
      res.json({
        success: true,
        data: metrics,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting system metrics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve system metrics'
      });
    }
  }

  public async getHealthStatus(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.healthChecker.getHealthStatus();
      
      if (!health) {
        // Perform fresh health check if no cached data
        const freshHealth = await this.healthChecker.performHealthCheck();
        res.json({
          success: true,
          data: freshHealth
        });
        return;
      }

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Error getting health status', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve health status'
      });
    }
  }

  public async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const acknowledged = req.query.acknowledged === 'true' ? true : 
                          req.query.acknowledged === 'false' ? false : undefined;
      
      const alerts = await this.alertManager.getAlerts(limit, acknowledged);
      
      res.json({
        success: true,
        data: alerts,
        count: alerts.length
      });
    } catch (error) {
      logger.error('Error getting alerts', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alerts'
      });
    }
  }

  public async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      
      if (!alertId) {
        res.status(400).json({
          success: false,
          error: 'Alert ID is required'
        });
        return;
      }

      const acknowledged = await this.alertManager.acknowledgeAlert(alertId);
      
      if (!acknowledged) {
        res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Alert acknowledged successfully'
      });
    } catch (error) {
      logger.error('Error acknowledging alert', { error, alertId: req.params.alertId });
      res.status(500).json({
        success: false,
        error: 'Failed to acknowledge alert'
      });
    }
  }

  public async getAlertRules(req: Request, res: Response): Promise<void> {
    try {
      const rules = await this.alertManager.getAlertRules();
      
      res.json({
        success: true,
        data: rules
      });
    } catch (error) {
      logger.error('Error getting alert rules', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alert rules'
      });
    }
  }

  public async updateAlertRule(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params;
      const updates = req.body;
      
      if (!ruleId) {
        res.status(400).json({
          success: false,
          error: 'Rule ID is required'
        });
        return;
      }

      const updated = await this.alertManager.updateAlertRule(ruleId, updates);
      
      if (!updated) {
        res.status(404).json({
          success: false,
          error: 'Alert rule not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Alert rule updated successfully'
      });
    } catch (error) {
      logger.error('Error updating alert rule', { error, ruleId: req.params.ruleId });
      res.status(500).json({
        success: false,
        error: 'Failed to update alert rule'
      });
    }
  }

  public async getTradingMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { symbol } = req.params;
      
      if (!symbol) {
        res.status(400).json({
          success: false,
          error: 'Symbol is required'
        });
        return;
      }

      const metrics = await this.metricsCollector.getTradingMetricsBySymbol(symbol);
      
      res.json({
        success: true,
        data: metrics,
        symbol
      });
    } catch (error) {
      logger.error('Error getting trading metrics', { error, symbol: req.params.symbol });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve trading metrics'
      });
    }
  }

  public async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.performanceMonitor.getMetrics();
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error getting performance metrics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve performance metrics'
      });
    }
  }

  public async getAlertStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.alertManager.getAlertStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error getting alert statistics', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alert statistics'
      });
    }
  }

  public async createManualAlert(req: Request, res: Response): Promise<void> {
    try {
      const { type, title, message, metadata } = req.body;
      
      if (!type || !title || !message) {
        res.status(400).json({
          success: false,
          error: 'Type, title, and message are required'
        });
        return;
      }

      const alert = await this.alertManager.createAlert({
        type,
        title,
        message,
        metadata
      });
      
      res.json({
        success: true,
        data: alert,
        message: 'Alert created successfully'
      });
    } catch (error) {
      logger.error('Error creating manual alert', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create alert'
      });
    }
  }

  public async getServiceHealth(req: Request, res: Response): Promise<void> {
    try {
      const { serviceName } = req.params;
      
      if (!serviceName) {
        res.status(400).json({
          success: false,
          error: 'Service name is required'
        });
        return;
      }

      const health = await this.healthChecker.getServiceHealth(serviceName);
      
      if (!health) {
        res.status(404).json({
          success: false,
          error: 'Service health data not found'
        });
        return;
      }

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Error getting service health', { error, serviceName: req.params.serviceName });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve service health'
      });
    }
  }

  public async recordTradingMetric(req: Request, res: Response): Promise<void> {
    try {
      const metric = req.body;
      
      if (!metric.symbol || !metric.strategy) {
        res.status(400).json({
          success: false,
          error: 'Symbol and strategy are required'
        });
        return;
      }

      await this.metricsCollector.recordTradingMetric(metric);
      
      res.json({
        success: true,
        message: 'Trading metric recorded successfully'
      });
    } catch (error) {
      logger.error('Error recording trading metric', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to record trading metric'
      });
    }
  }
}