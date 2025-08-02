import systemMonitor, { SystemMonitor } from '../../monitoring/SystemMonitor';

describe('SystemMonitor', () => {
  let monitor: SystemMonitor;

  beforeEach(() => {
    monitor = new SystemMonitor();
  });

  afterEach(() => {
    monitor.stop();
  });

  describe('Health check registration', () => {
    it('should register health checks', () => {
      const checkName = 'test-check';
      const checkFunction = jest.fn().mockResolvedValue({
        status: 'healthy',
        message: 'Test check passed'
      });

      monitor.registerHealthCheck(checkName, checkFunction);
      
      // Verify the check was registered by performing it
      expect(monitor.performHealthCheck(checkName)).resolves.toMatchObject({
        name: checkName,
        status: 'healthy',
        message: 'Test check passed'
      });
    });

    it('should unregister health checks', () => {
      const checkName = 'test-check';
      const checkFunction = jest.fn().mockResolvedValue({
        status: 'healthy'
      });

      monitor.registerHealthCheck(checkName, checkFunction);
      monitor.unregisterHealthCheck(checkName);
      
      // Should throw error for non-existent check
      expect(monitor.performHealthCheck(checkName)).rejects.toThrow();
    });
  });

  describe('Health check execution', () => {
    beforeEach(() => {
      monitor.registerHealthCheck('healthy-service', jest.fn().mockResolvedValue({
        status: 'healthy',
        message: 'Service is running well'
      }));

      monitor.registerHealthCheck('unhealthy-service', jest.fn().mockResolvedValue({
        status: 'unhealthy',
        message: 'Service has issues'
      }));

      monitor.registerHealthCheck('degraded-service', jest.fn().mockResolvedValue({
        status: 'degraded',
        message: 'Service is slow'
      }));

      monitor.registerHealthCheck('failing-service', jest.fn().mockRejectedValue(
        new Error('Service check failed')
      ));
    });

    it('should perform individual health checks', async () => {
      const result = await monitor.performHealthCheck('healthy-service');
      
      expect(result).toMatchObject({
        name: 'healthy-service',
        status: 'healthy',
        message: 'Service is running well'
      });
      expect(result.lastCheck).toBeInstanceOf(Date);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle failing health checks', async () => {
      const result = await monitor.performHealthCheck('failing-service');
      
      expect(result).toMatchObject({
        name: 'failing-service',
        status: 'unhealthy',
        message: 'Service check failed'
      });
    });

    it('should perform all health checks', async () => {
      const results = await monitor.performAllHealthChecks();
      
      expect(results).toHaveLength(4);
      expect(results.map(r => r.name)).toContain('healthy-service');
      expect(results.map(r => r.name)).toContain('unhealthy-service');
      expect(results.map(r => r.name)).toContain('degraded-service');
      expect(results.map(r => r.name)).toContain('failing-service');
    });
  });

  describe('System status determination', () => {
    beforeEach(() => {
      monitor.registerHealthCheck('service-1', jest.fn().mockResolvedValue({
        status: 'healthy'
      }));
      monitor.registerHealthCheck('service-2', jest.fn().mockResolvedValue({
        status: 'healthy'
      }));
    });

    it('should report healthy when all services are healthy', async () => {
      const status = await monitor.getSystemStatus();
      
      expect(status.overall).toBe('healthy');
      expect(status.services).toHaveLength(2);
      expect(status.uptime).toBeGreaterThan(0);
      expect(status.timestamp).toBeInstanceOf(Date);
    });

    it('should report degraded when some services are degraded', async () => {
      monitor.registerHealthCheck('degraded-service', jest.fn().mockResolvedValue({
        status: 'degraded'
      }));

      const status = await monitor.getSystemStatus();
      expect(status.overall).toBe('degraded');
    });

    it('should report unhealthy when any service is unhealthy', async () => {
      monitor.registerHealthCheck('unhealthy-service', jest.fn().mockResolvedValue({
        status: 'unhealthy'
      }));

      const status = await monitor.getSystemStatus();
      expect(status.overall).toBe('unhealthy');
    });
  });

  describe('Last known status', () => {
    it('should return last known status without performing checks', () => {
      const status = monitor.getLastKnownStatus();
      
      expect(status).toHaveProperty('overall');
      expect(status).toHaveProperty('services');
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('timestamp');
    });
  });

  describe('Monitoring control', () => {
    it('should start and stop monitoring', () => {
      expect(monitor.isRunning()).toBe(false);
      
      monitor.start(1000); // 1 second interval
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

    it('should emit events on start and stop', (done) => {
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

  describe('Default health checks', () => {
    it('should have default health checks registered', async () => {
      const status = await monitor.getSystemStatus();
      
      const serviceNames = status.services.map(s => s.name);
      expect(serviceNames).toContain('database');
      expect(serviceNames).toContain('redis');
      expect(serviceNames).toContain('memory');
      expect(serviceNames).toContain('eventloop');
    });

    it('should check memory usage', async () => {
      const result = await monitor.performHealthCheck('memory');
      
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.metadata).toHaveProperty('heapUsagePercent');
      expect(result.metadata).toHaveProperty('heapUsedMB');
      expect(result.metadata).toHaveProperty('heapTotalMB');
    });

    it('should check event loop delay', async () => {
      const result = await monitor.performHealthCheck('eventloop');
      
      expect(result.status).toMatch(/healthy|degraded|unhealthy/);
      expect(result.metadata).toHaveProperty('delay');
      expect(result.metadata.delay).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event emission', () => {
    it('should emit status update events', (done) => {
      monitor.on('statusUpdate', (status) => {
        expect(status).toHaveProperty('overall');
        expect(status).toHaveProperty('services');
        done();
      });
      
      monitor.getSystemStatus();
    });
  });

  describe('Error handling', () => {
    it('should handle health check errors gracefully', async () => {
      monitor.registerHealthCheck('error-check', jest.fn().mockRejectedValue(
        new Error('Simulated error')
      ));

      const result = await monitor.performHealthCheck('error-check');
      
      expect(result.status).toBe('unhealthy');
      expect(result.message).toBe('Simulated error');
    });

    it('should handle non-existent health checks', async () => {
      await expect(monitor.performHealthCheck('non-existent'))
        .rejects.toThrow("Health check 'non-existent' not found");
    });
  });
});

describe('SystemMonitor singleton', () => {
  it('should be a singleton instance', () => {
    expect(systemMonitor).toBeInstanceOf(SystemMonitor);
  });

  it('should maintain state across imports', () => {
    const testCheckName = 'singleton-test';
    
    systemMonitor.registerHealthCheck(testCheckName, jest.fn().mockResolvedValue({
      status: 'healthy'
    }));
    
    // Should be able to perform the check
    expect(systemMonitor.performHealthCheck(testCheckName))
      .resolves.toMatchObject({
        name: testCheckName,
        status: 'healthy'
      });
    
    // Clean up
    systemMonitor.unregisterHealthCheck(testCheckName);
  });
});