import { Router, Request, Response } from 'express';
import systemMonitor from '../monitoring/SystemMonitor';
import performanceMonitor from '../monitoring/PerformanceMonitor';
import alertManager from '../monitoring/AlertManager';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Apply authentication middleware to all monitoring routes except health
router.use('/health', (req: Request, res: Response, next) => next());
router.use(authenticate);

// Health check endpoint (public)
router.get('/health', async (req: Request, res: Response) => {
  try {
    const status = await systemMonitor.getSystemStatus();
    
    const httpStatus = status.overall === 'healthy' ? 200 : 
                      status.overall === 'degraded' ? 200 : 503;
    
    res.status(httpStatus).json({
      status: status.overall,
      timestamp: status.timestamp,
      uptime: status.uptime,
      services: status.services.map(service => ({
        name: service.name,
        status: service.status,
        message: service.message,
        responseTime: service.responseTime
      }))
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(500).json({
      status: 'unhealthy',
      message: 'Health check failed',
      timestamp: new Date()
    });
  }
});

// Detailed system status
router.get('/status', async (req, res) => {
  try {
    const status = await systemMonitor.getSystemStatus();
    const systemMetrics = await performanceMonitor.getSystemMetrics();
    
    res.json({
      system: status,
      metrics: systemMetrics,
      performance: {
        monitoring: performanceMonitor.isRunning(),
        metricNames: performanceMonitor.getMetricNames()
      }
    });
  } catch (error) {
    logger.error('Failed to get system status', { error });
    res.status(500).json({
      error: 'Failed to get system status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Performance metrics
router.get('/metrics', (req, res) => {
  try {
    const { name, limit } = req.query;
    
    if (name && typeof name === 'string') {
      const metrics = performanceMonitor.getMetrics(name, limit ? parseInt(limit as string) : undefined);
      res.json({
        name,
        metrics,
        average: performanceMonitor.getAverageMetric(name)
      });
    } else {
      const exportedMetrics = performanceMonitor.exportMetrics();
      res.json({
        metrics: exportedMetrics,
        metricNames: performanceMonitor.getMetricNames()
      });
    }
  } catch (error) {
    logger.error('Failed to get performance metrics', { error });
    res.status(500).json({
      error: 'Failed to get performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// System metrics
router.get('/system-metrics', async (req, res) => {
  try {
    const metrics = await performanceMonitor.getSystemMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get system metrics', { error });
    res.status(500).json({
      error: 'Failed to get system metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Alerts endpoints
router.get('/alerts', (req, res) => {
  try {
    const { resolved, level, source, limit } = req.query;
    
    const options: any = {};
    if (resolved !== undefined) options.resolved = resolved === 'true';
    if (level) options.level = level as string;
    if (source) options.source = source as string;
    if (limit) options.limit = parseInt(limit as string);
    
    const alerts = alertManager.getAlerts(options);
    const statistics = alertManager.getStatistics();
    
    res.json({
      alerts,
      statistics,
      total: alerts.length
    });
  } catch (error) {
    logger.error('Failed to get alerts', { error });
    res.status(500).json({
      error: 'Failed to get alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific alert
router.get('/alerts/:alertId', (req, res) => {
  try {
    const { alertId } = req.params;
    const alert = alertManager.getAlert(alertId);
    
    if (!alert) {
      return res.status(404).json({
        error: 'Alert not found',
        alertId
      });
    }
    
    res.json(alert);
  } catch (error) {
    logger.error('Failed to get alert', { error, alertId: req.params.alertId });
    res.status(500).json({
      error: 'Failed to get alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Resolve alert
router.post('/alerts/:alertId/resolve', (req, res) => {
  try {
    const { alertId } = req.params;
    const resolved = alertManager.resolveAlert(alertId);
    
    if (!resolved) {
      return res.status(404).json({
        error: 'Alert not found or already resolved',
        alertId
      });
    }
    
    logger.info('Alert resolved via API', { 
      alertId, 
      userId: req.user?.id,
      type: 'ALERT_RESOLVED_API'
    });
    
    res.json({
      success: true,
      message: 'Alert resolved successfully',
      alertId
    });
  } catch (error) {
    logger.error('Failed to resolve alert', { error, alertId: req.params.alertId });
    res.status(500).json({
      error: 'Failed to resolve alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create manual alert
router.post('/alerts', (req, res) => {
  try {
    const { level, title, message, source, metadata } = req.body;
    
    if (!level || !title || !message || !source) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['level', 'title', 'message', 'source']
      });
    }
    
    if (!['info', 'warning', 'error', 'critical'].includes(level)) {
      return res.status(400).json({
        error: 'Invalid alert level',
        validLevels: ['info', 'warning', 'error', 'critical']
      });
    }
    
    const alert = alertManager.createAlert(level, title, message, source, {
      ...metadata,
      createdBy: req.user?.id,
      createdViaAPI: true
    });
    
    logger.info('Manual alert created via API', {
      alertId: alert.id,
      level,
      title,
      userId: req.user?.id,
      type: 'ALERT_CREATED_API'
    });
    
    res.status(201).json(alert);
  } catch (error) {
    logger.error('Failed to create alert', { error });
    res.status(500).json({
      error: 'Failed to create alert',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Alert statistics
router.get('/alerts/stats', (req, res) => {
  try {
    const statistics = alertManager.getStatistics();
    res.json(statistics);
  } catch (error) {
    logger.error('Failed to get alert statistics', { error });
    res.status(500).json({
      error: 'Failed to get alert statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Clear old alerts
router.delete('/alerts/old', (req, res) => {
  try {
    const { olderThanDays = 7 } = req.query;
    const olderThanMs = parseInt(olderThanDays as string) * 24 * 60 * 60 * 1000;
    
    const cleared = alertManager.clearOldAlerts(olderThanMs);
    
    logger.info('Old alerts cleared via API', {
      cleared,
      olderThanDays,
      userId: req.user?.id,
      type: 'ALERTS_CLEARED_API'
    });
    
    res.json({
      success: true,
      message: `Cleared ${cleared} old alerts`,
      cleared
    });
  } catch (error) {
    logger.error('Failed to clear old alerts', { error });
    res.status(500).json({
      error: 'Failed to clear old alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start/stop monitoring
router.post('/control/:action', (req, res) => {
  try {
    const { action } = req.params;
    const { intervalMs } = req.body;
    
    switch (action) {
      case 'start-system-monitor':
        if (systemMonitor.isRunning()) {
          return res.status(400).json({
            error: 'System monitor is already running'
          });
        }
        systemMonitor.start(intervalMs || 30000);
        logger.info('System monitor started via API', { 
          userId: req.user?.id,
          intervalMs: intervalMs || 30000
        });
        res.json({ success: true, message: 'System monitor started' });
        break;
        
      case 'stop-system-monitor':
        if (!systemMonitor.isRunning()) {
          return res.status(400).json({
            error: 'System monitor is not running'
          });
        }
        systemMonitor.stop();
        logger.info('System monitor stopped via API', { userId: req.user?.id });
        res.json({ success: true, message: 'System monitor stopped' });
        break;
        
      case 'start-performance-monitor':
        if (performanceMonitor.isRunning()) {
          return res.status(400).json({
            error: 'Performance monitor is already running'
          });
        }
        performanceMonitor.start();
        logger.info('Performance monitor started via API', { userId: req.user?.id });
        res.json({ success: true, message: 'Performance monitor started' });
        break;
        
      case 'stop-performance-monitor':
        if (!performanceMonitor.isRunning()) {
          return res.status(400).json({
            error: 'Performance monitor is not running'
          });
        }
        performanceMonitor.stop();
        logger.info('Performance monitor stopped via API', { userId: req.user?.id });
        res.json({ success: true, message: 'Performance monitor stopped' });
        break;
        
      case 'clear-metrics':
        performanceMonitor.clearMetrics();
        logger.info('Performance metrics cleared via API', { userId: req.user?.id });
        res.json({ success: true, message: 'Performance metrics cleared' });
        break;
        
      default:
        res.status(400).json({
          error: 'Invalid action',
          validActions: [
            'start-system-monitor',
            'stop-system-monitor', 
            'start-performance-monitor',
            'stop-performance-monitor',
            'clear-metrics'
          ]
        });
    }
  } catch (error) {
    logger.error('Failed to execute monitoring control action', { 
      error, 
      action: req.params.action 
    });
    res.status(500).json({
      error: 'Failed to execute action',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Monitoring status
router.get('/status/monitoring', (req, res) => {
  try {
    res.json({
      systemMonitor: {
        running: systemMonitor.isRunning(),
        lastStatus: systemMonitor.getLastKnownStatus()
      },
      performanceMonitor: {
        running: performanceMonitor.isRunning(),
        metricCount: performanceMonitor.getMetricNames().length
      },
      alerts: {
        statistics: alertManager.getStatistics()
      }
    });
  } catch (error) {
    logger.error('Failed to get monitoring status', { error });
    res.status(500).json({
      error: 'Failed to get monitoring status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;