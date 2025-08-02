import logger from '../utils/logger';
import { EventEmitter } from 'events';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  heap: {
    used: number;
    total: number;
    percentage: number;
  };
  eventLoop: {
    delay: number;
  };
  uptime: number;
}

class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private timers: Map<string, number> = new Map();
  private intervals: NodeJS.Timeout[] = [];
  private isMonitoring: boolean = false;

  constructor() {
    super();
    this.setupSystemMetricsCollection();
  }

  // Start a performance timer
  startTimer(name: string, tags?: Record<string, string>): void {
    const startTime = process.hrtime.bigint();
    this.timers.set(name, Number(startTime));
    
    logger.trace(`Performance timer started: ${name}`, { 
      timer: name, 
      tags,
      type: 'TIMER_START'
    });
  }

  // End a performance timer and record the metric
  endTimer(name: string, tags?: Record<string, string>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      logger.warn(`Timer ${name} was not started`, { timer: name });
      return 0;
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - BigInt(startTime)) / 1000000; // Convert to milliseconds
    
    this.recordMetric(name, duration, 'ms', tags);
    this.timers.delete(name);
    
    logger.trace(`Performance timer ended: ${name}`, { 
      timer: name, 
      duration, 
      tags,
      type: 'TIMER_END'
    });

    return duration;
  }

  // Record a custom metric
  recordMetric(name: string, value: number, unit: string = 'count', tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: new Date(),
      tags
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricArray = this.metrics.get(name)!;
    metricArray.push(metric);

    // Keep only last 1000 metrics per type to prevent memory leaks
    if (metricArray.length > 1000) {
      metricArray.shift();
    }

    logger.performanceMetric(name, value, unit);
    this.emit('metric', metric);
  }

  // Get metrics for a specific name
  getMetrics(name: string, limit?: number): PerformanceMetric[] {
    const metrics = this.metrics.get(name) || [];
    return limit ? metrics.slice(-limit) : metrics;
  }

  // Get all metric names
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys());
  }

  // Get average value for a metric over a time period
  getAverageMetric(name: string, timeWindowMs: number = 60000): number {
    const metrics = this.metrics.get(name) || [];
    const cutoffTime = new Date(Date.now() - timeWindowMs);
    
    const recentMetrics = metrics.filter(m => m.timestamp >= cutoffTime);
    if (recentMetrics.length === 0) return 0;
    
    const sum = recentMetrics.reduce((acc, m) => acc + m.value, 0);
    return sum / recentMetrics.length;
  }

  // Get system metrics
  async getSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Calculate CPU usage percentage (simplified)
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    
    // Get system memory info (simplified - in production you'd use a library like 'systeminformation')
    const totalMemory = memUsage.rss + memUsage.heapTotal + memUsage.external;
    
    return {
      cpu: {
        usage: cpuPercent,
        loadAverage: [0, 0, 0] // Would use os.loadavg() in production
      },
      memory: {
        used: memUsage.rss,
        total: totalMemory,
        percentage: (memUsage.rss / totalMemory) * 100
      },
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100
      },
      eventLoop: {
        delay: await this.measureEventLoopDelay()
      },
      uptime: process.uptime()
    };
  }

  // Measure event loop delay
  private async measureEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
        resolve(delay);
      });
    });
  }

  // Setup automatic system metrics collection
  private setupSystemMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    const systemMetricsInterval = setInterval(async () => {
      try {
        const metrics = await this.getSystemMetrics();
        
        this.recordMetric('system.cpu.usage', metrics.cpu.usage, 'percent');
        this.recordMetric('system.memory.used', metrics.memory.used, 'bytes');
        this.recordMetric('system.memory.percentage', metrics.memory.percentage, 'percent');
        this.recordMetric('system.heap.used', metrics.heap.used, 'bytes');
        this.recordMetric('system.heap.percentage', metrics.heap.percentage, 'percent');
        this.recordMetric('system.eventloop.delay', metrics.eventLoop.delay, 'ms');
        this.recordMetric('system.uptime', metrics.uptime, 'seconds');
        
      } catch (error) {
        logger.error('Failed to collect system metrics', { error });
      }
    }, 30000);

    this.intervals.push(systemMetricsInterval);
  }

  // Start monitoring
  start(): void {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Performance monitoring started');
    this.emit('started');
  }

  // Stop monitoring
  stop(): void {
    if (!this.isMonitoring) {
      logger.warn('Performance monitoring is not running');
      return;
    }

    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    this.isMonitoring = false;
    
    logger.info('Performance monitoring stopped');
    this.emit('stopped');
  }

  // Get monitoring status
  isRunning(): boolean {
    return this.isMonitoring;
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics.clear();
    this.timers.clear();
    logger.info('All performance metrics cleared');
  }

  // Export metrics for external monitoring systems
  exportMetrics(): Record<string, any> {
    const exported: Record<string, any> = {};
    
    for (const [name, metrics] of this.metrics.entries()) {
      exported[name] = {
        count: metrics.length,
        latest: metrics[metrics.length - 1],
        average: this.getAverageMetric(name),
        min: Math.min(...metrics.map(m => m.value)),
        max: Math.max(...metrics.map(m => m.value))
      };
    }
    
    return exported;
  }
}

// Singleton instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
export { PerformanceMonitor, PerformanceMetric, SystemMetrics };