import performanceMonitor, { PerformanceMonitor } from '../../monitoring/PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
  });

  afterEach(() => {
    monitor.stop();
    monitor.clearMetrics();
  });

  describe('Timer functionality', () => {
    it('should start and end timers correctly', () => {
      const timerName = 'test-timer';
      
      monitor.startTimer(timerName);
      
      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {
        // Wait for at least 10ms
      }
      
      const duration = monitor.endTimer(timerName);
      
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeGreaterThanOrEqual(10);
    });

    it('should return 0 for non-existent timer', () => {
      const duration = monitor.endTimer('non-existent-timer');
      expect(duration).toBe(0);
    });

    it('should record timer metrics', () => {
      const timerName = 'test-timer';
      
      monitor.startTimer(timerName);
      monitor.endTimer(timerName);
      
      const metrics = monitor.getMetrics(timerName);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe(timerName);
      expect(metrics[0].unit).toBe('ms');
      expect(metrics[0].value).toBeGreaterThan(0);
    });
  });

  describe('Custom metrics', () => {
    it('should record custom metrics', () => {
      const metricName = 'custom-metric';
      const value = 42;
      const unit = 'count';
      
      monitor.recordMetric(metricName, value, unit);
      
      const metrics = monitor.getMetrics(metricName);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe(metricName);
      expect(metrics[0].value).toBe(value);
      expect(metrics[0].unit).toBe(unit);
    });

    it('should record metrics with tags', () => {
      const metricName = 'tagged-metric';
      const value = 100;
      const tags = { service: 'test', environment: 'dev' };
      
      monitor.recordMetric(metricName, value, 'ms', tags);
      
      const metrics = monitor.getMetrics(metricName);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].tags).toEqual(tags);
    });

    it('should limit metrics to prevent memory leaks', () => {
      const metricName = 'memory-test';
      
      // Record more than 1000 metrics
      for (let i = 0; i < 1200; i++) {
        monitor.recordMetric(metricName, i);
      }
      
      const metrics = monitor.getMetrics(metricName);
      expect(metrics.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Metric retrieval', () => {
    beforeEach(() => {
      // Setup test data
      for (let i = 0; i < 10; i++) {
        monitor.recordMetric('test-metric', i * 10);
      }
    });

    it('should get all metrics for a name', () => {
      const metrics = monitor.getMetrics('test-metric');
      expect(metrics).toHaveLength(10);
    });

    it('should limit metrics when requested', () => {
      const metrics = monitor.getMetrics('test-metric', 5);
      expect(metrics).toHaveLength(5);
    });

    it('should return empty array for non-existent metric', () => {
      const metrics = monitor.getMetrics('non-existent');
      expect(metrics).toHaveLength(0);
    });

    it('should get all metric names', () => {
      monitor.recordMetric('metric-1', 1);
      monitor.recordMetric('metric-2', 2);
      
      const names = monitor.getMetricNames();
      expect(names).toContain('test-metric');
      expect(names).toContain('metric-1');
      expect(names).toContain('metric-2');
    });
  });

  describe('Average calculations', () => {
    it('should calculate average correctly', () => {
      const metricName = 'avg-test';
      const values = [10, 20, 30, 40, 50];
      
      values.forEach(value => {
        monitor.recordMetric(metricName, value);
      });
      
      const average = monitor.getAverageMetric(metricName);
      expect(average).toBe(30); // (10+20+30+40+50)/5 = 30
    });

    it('should return 0 for non-existent metric average', () => {
      const average = monitor.getAverageMetric('non-existent');
      expect(average).toBe(0);
    });

    it('should calculate average within time window', async () => {
      const metricName = 'time-window-test';
      
      // Record old metric
      monitor.recordMetric(metricName, 100);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Record recent metrics
      monitor.recordMetric(metricName, 10);
      monitor.recordMetric(metricName, 20);
      
      // Get average for last 30ms (should only include recent metrics)
      const average = monitor.getAverageMetric(metricName, 30);
      expect(average).toBe(15); // (10+20)/2 = 15
    });
  });

  describe('System metrics', () => {
    it('should get system metrics', async () => {
      const metrics = await monitor.getSystemMetrics();
      
      expect(metrics).toHaveProperty('cpu');
      expect(metrics).toHaveProperty('memory');
      expect(metrics).toHaveProperty('heap');
      expect(metrics).toHaveProperty('eventLoop');
      expect(metrics).toHaveProperty('uptime');
      
      expect(metrics.memory.used).toBeGreaterThan(0);
      expect(metrics.heap.used).toBeGreaterThan(0);
      expect(metrics.uptime).toBeGreaterThan(0);
    });
  });

  describe('Monitoring control', () => {
    it('should start and stop monitoring', () => {
      expect(monitor.isRunning()).toBe(false);
      
      monitor.start();
      expect(monitor.isRunning()).toBe(true);
      
      monitor.stop();
      expect(monitor.isRunning()).toBe(false);
    });

    it('should not start monitoring twice', () => {
      monitor.start();
      expect(monitor.isRunning()).toBe(true);
      
      // Starting again should not change state
      monitor.start();
      expect(monitor.isRunning()).toBe(true);
    });

    it('should clear all metrics', () => {
      monitor.recordMetric('test-1', 1);
      monitor.recordMetric('test-2', 2);
      
      expect(monitor.getMetricNames()).toHaveLength(2);
      
      monitor.clearMetrics();
      expect(monitor.getMetricNames()).toHaveLength(0);
    });
  });

  describe('Export functionality', () => {
    beforeEach(() => {
      monitor.recordMetric('metric-1', 10);
      monitor.recordMetric('metric-1', 20);
      monitor.recordMetric('metric-1', 30);
      monitor.recordMetric('metric-2', 100);
    });

    it('should export metrics correctly', () => {
      const exported = monitor.exportMetrics();
      
      expect(exported).toHaveProperty('metric-1');
      expect(exported).toHaveProperty('metric-2');
      
      expect(exported['metric-1'].count).toBe(3);
      expect(exported['metric-1'].average).toBe(20);
      expect(exported['metric-1'].min).toBe(10);
      expect(exported['metric-1'].max).toBe(30);
      
      expect(exported['metric-2'].count).toBe(1);
      expect(exported['metric-2'].average).toBe(100);
    });
  });

  describe('Event emission', () => {
    it('should emit metric events', (done) => {
      monitor.on('metric', (metric) => {
        expect(metric.name).toBe('event-test');
        expect(metric.value).toBe(42);
        done();
      });
      
      monitor.recordMetric('event-test', 42);
    });

    it('should emit start/stop events', (done) => {
      let eventCount = 0;
      
      monitor.on('started', () => {
        eventCount++;
        if (eventCount === 2) done();
      });
      
      monitor.on('stopped', () => {
        eventCount++;
        if (eventCount === 2) done();
      });
      
      monitor.start();
      monitor.stop();
    });
  });
});

describe('PerformanceMonitor singleton', () => {
  it('should be a singleton instance', () => {
    expect(performanceMonitor).toBeInstanceOf(PerformanceMonitor);
  });

  it('should maintain state across imports', () => {
    performanceMonitor.recordMetric('singleton-test', 123);
    
    const metrics = performanceMonitor.getMetrics('singleton-test');
    expect(metrics).toHaveLength(1);
    expect(metrics[0].value).toBe(123);
    
    // Clean up
    performanceMonitor.clearMetrics();
  });
});