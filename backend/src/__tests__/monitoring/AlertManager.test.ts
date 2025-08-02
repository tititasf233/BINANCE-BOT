import { AlertManager } from '../../monitoring/AlertManager';

describe('AlertManager', () => {
  let manager: AlertManager;

  beforeEach(() => {
    manager = new AlertManager();
  });

  describe('Alert creation', () => {
    it('should create alerts correctly', () => {
      const alert = manager.createAlert(
        'warning',
        'Test Alert',
        'This is a test alert',
        'test-source',
        { key: 'value' }
      );

      expect(alert).toMatchObject({
        level: 'warning',
        title: 'Test Alert',
        message: 'This is a test alert',
        source: 'test-source',
        resolved: false,
        metadata: { key: 'value' }
      });
      expect(alert.id).toBeDefined();
      expect(alert.timestamp).toBeInstanceOf(Date);
    });

    it('should emit alert events', (done) => {
      manager.on('alert', (alert) => {
        expect(alert.title).toBe('Event Test');
        done();
      });

      manager.createAlert('info', 'Event Test', 'Testing events', 'test');
    });
  });

  describe('Alert resolution', () => {
    it('should resolve alerts correctly', () => {
      const alert = manager.createAlert('error', 'Test Error', 'Test error message', 'test');
      
      manager.resolveAlert(alert.id);
      
      const resolvedAlert = manager.getAlert(alert.id);
      expect(resolvedAlert?.resolved).toBe(true);
    });
  });

  describe('Alert filtering', () => {
    it('should filter alerts by level', () => {
      manager.createAlert('info', 'Info Alert', 'Info message', 'test');
      manager.createAlert('warning', 'Warning Alert', 'Warning message', 'test');
      manager.createAlert('error', 'Error Alert', 'Error message', 'test');

      const errorAlerts = manager.getAlerts({ level: 'error' });
      expect(errorAlerts).toHaveLength(1);
      expect(errorAlerts[0].level).toBe('error');
    });
  });
});