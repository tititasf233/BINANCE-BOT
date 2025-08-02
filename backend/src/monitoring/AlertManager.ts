import { logger } from '../utils/logger';
import { EventEmitter } from 'node:events';

interface Alert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  source: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
  metadata?: Record<string, any> | undefined;
}

interface AlertRule {
  id: string;
  name: string;
  condition: (data: any) => boolean;
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  cooldownMs: number;
  enabled: boolean;
}

interface AlertChannel {
  name: string;
  type: 'console' | 'email' | 'webhook' | 'slack';
  config: Record<string, any>;
  enabled: boolean;
  levels: ('info' | 'warning' | 'error' | 'critical')[];
}

class AlertManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private alertChannels: Map<string, AlertChannel> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private alertCounter: number = 0;

  constructor() {
    super();
    this.setupDefaultRules();
    this.setupDefaultChannels();
  }

  // Create a new alert
  createAlert(
    level: 'info' | 'warning' | 'error' | 'critical',
    title: string,
    message: string,
    source: string,
    metadata?: Record<string, any>
  ): Alert {
    const id = this.generateAlertId();
    const alert: Alert = {
      id,
      level,
      title,
      message,
      source,
      timestamp: new Date(),
      resolved: false,
      metadata
    };

    this.alerts.set(id, alert);
    
    logger.warn(`Alert created: ${title}`, {
      alertId: id,
      level,
      source,
      type: 'ALERT_CREATED'
    });

    this.emit('alert', alert);
    this.sendAlert(alert);

    return alert;
  }

  // Resolve an alert
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      logger.warn(`Alert not found: ${alertId}`);
      return false;
    }

    if (alert.resolved) {
      logger.warn(`Alert already resolved: ${alertId}`);
      return false;
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();

    logger.info(`Alert resolved: ${alert.title}`, {
      alertId,
      type: 'ALERT_RESOLVED'
    });

    this.emit('alertResolved', alert);
    return true;
  }

  // Get all alerts
  getAlerts(options?: {
    resolved?: boolean;
    level?: 'info' | 'warning' | 'error' | 'critical';
    source?: string;
    limit?: number;
  }): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (options?.resolved !== undefined) {
      alerts = alerts.filter(a => a.resolved === options.resolved);
    }

    if (options?.level) {
      alerts = alerts.filter(a => a.level === options.level);
    }

    if (options?.source) {
      alerts = alerts.filter(a => a.source === options.source);
    }

    // Sort by timestamp (newest first)
    alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (options?.limit) {
      alerts = alerts.slice(0, options.limit);
    }

    return alerts;
  }

  // Get alert by ID
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  // Add alert rule
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info(`Alert rule added: ${rule.name}`, { ruleId: rule.id });
  }

  // Remove alert rule
  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId);
    if (removed) {
      logger.info(`Alert rule removed: ${ruleId}`);
    }
    return removed;
  }

  // Enable/disable alert rule
  toggleAlertRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      return false;
    }

    rule.enabled = enabled;
    logger.info(`Alert rule ${enabled ? 'enabled' : 'disabled'}: ${rule.name}`, { ruleId });
    return true;
  }

  // Evaluate data against alert rules
  evaluateRules(data: any, source: string): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      try {
        // Check cooldown
        const lastAlert = this.lastAlertTime.get(rule.id);
        if (lastAlert && Date.now() - lastAlert < rule.cooldownMs) {
          continue;
        }

        // Evaluate condition
        if (rule.condition(data)) {
          this.createAlert(rule.level, rule.name, rule.message, source, { rule: rule.id, data });
          this.lastAlertTime.set(rule.id, Date.now());
        }
      } catch (error) {
        logger.error(`Error evaluating alert rule: ${rule.name}`, {
          ruleId: rule.id,
          error: error instanceof Error ? error.message : error
        });
      }
    }
  }

  // Add alert channel
  addAlertChannel(channel: AlertChannel): void {
    this.alertChannels.set(channel.name, channel);
    logger.info(`Alert channel added: ${channel.name}`, { type: channel.type });
  }

  // Remove alert channel
  removeAlertChannel(channelName: string): boolean {
    const removed = this.alertChannels.delete(channelName);
    if (removed) {
      logger.info(`Alert channel removed: ${channelName}`);
    }
    return removed;
  }

  // Send alert through configured channels
  private async sendAlert(alert: Alert): Promise<void> {
    for (const channel of this.alertChannels.values()) {
      if (!channel.enabled || !channel.levels.includes(alert.level)) {
        continue;
      }

      try {
        await this.sendAlertToChannel(alert, channel);
      } catch (error) {
        logger.error(`Failed to send alert to channel: ${channel.name}`, {
          alertId: alert.id,
          channel: channel.name,
          error: error instanceof Error ? error.message : error
        });
      }
    }
  }

  // Send alert to specific channel
  private async sendAlertToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'console':
        this.sendConsoleAlert(alert);
        break;
      case 'email':
        await this.sendEmailAlert(alert, channel.config);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alert, channel.config);
        break;
      case 'slack':
        await this.sendSlackAlert(alert, channel.config);
        break;
      default:
        logger.warn(`Unknown alert channel type: ${channel.type}`);
    }
  }

  // Console alert implementation
  private sendConsoleAlert(alert: Alert): void {
    const levelColors = {
      info: '\x1b[36m',    // Cyan
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      critical: '\x1b[35m' // Magenta
    };

    const reset = '\x1b[0m';
    const color = levelColors[alert.level];

    console.log(`${color}[ALERT ${alert.level.toUpperCase()}]${reset} ${alert.title}`);
    console.log(`Source: ${alert.source}`);
    console.log(`Message: ${alert.message}`);
    console.log(`Time: ${alert.timestamp.toISOString()}`);
    if (alert.metadata) {
      console.log(`Metadata: ${JSON.stringify(alert.metadata, null, 2)}`);
    }
    console.log('---');
  }

  // Email alert implementation (placeholder)
  private async sendEmailAlert(alert: Alert, config: Record<string, any>): Promise<void> {
    // In a real implementation, this would send an email using a service like SendGrid, SES, etc.
    logger.info('Email alert sent (placeholder)', {
      alertId: alert.id,
      to: config.to,
      subject: `[${alert.level.toUpperCase()}] ${alert.title}`
    });
  }

  // Webhook alert implementation (placeholder)
  private async sendWebhookAlert(alert: Alert, config: Record<string, any>): Promise<void> {
    // In a real implementation, this would make an HTTP POST request to the webhook URL
    logger.info('Webhook alert sent (placeholder)', {
      alertId: alert.id,
      url: config.url,
      payload: {
        alert: {
          id: alert.id,
          level: alert.level,
          title: alert.title,
          message: alert.message,
          source: alert.source,
          timestamp: alert.timestamp.toISOString()
        }
      }
    });
  }

  // Slack alert implementation (placeholder)
  private async sendSlackAlert(alert: Alert, config: Record<string, any>): Promise<void> {
    // In a real implementation, this would send a message to Slack using their API
    logger.info('Slack alert sent (placeholder)', {
      alertId: alert.id,
      channel: config.channel,
      message: `*${alert.level.toUpperCase()}*: ${alert.title}\n${alert.message}`
    });
  }

  // Generate unique alert ID
  private generateAlertId(): string {
    this.alertCounter++;
    return `alert_${Date.now()}_${this.alertCounter}`;
  }

  // Setup default alert rules
  private setupDefaultRules(): void {
    // High memory usage rule
    this.addAlertRule({
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      condition: (data: any) => {
        return data.memory && data.memory.percentage > 85;
      },
      level: 'warning',
      message: 'System memory usage is above 85%',
      cooldownMs: 300000, // 5 minutes
      enabled: true
    });

    // Critical memory usage rule
    this.addAlertRule({
      id: 'critical_memory_usage',
      name: 'Critical Memory Usage',
      condition: (data: any) => {
        return data.memory && data.memory.percentage > 95;
      },
      level: 'critical',
      message: 'System memory usage is above 95%',
      cooldownMs: 60000, // 1 minute
      enabled: true
    });

    // High event loop delay rule
    this.addAlertRule({
      id: 'high_event_loop_delay',
      name: 'High Event Loop Delay',
      condition: (data: any) => {
        return data.eventLoop && data.eventLoop.delay > 100;
      },
      level: 'warning',
      message: 'Event loop delay is above 100ms',
      cooldownMs: 180000, // 3 minutes
      enabled: true
    });

    // Trading error rule
    this.addAlertRule({
      id: 'trading_error',
      name: 'Trading Error',
      condition: (data: any) => {
        return data.type === 'TRADE_ERROR';
      },
      level: 'error',
      message: 'A trading error occurred',
      cooldownMs: 0, // No cooldown for trading errors
      enabled: true
    });

    // API connection failure rule
    this.addAlertRule({
      id: 'api_connection_failure',
      name: 'API Connection Failure',
      condition: (data: any) => {
        return data.type === 'API_ERROR' && data.error && data.error.includes('connection');
      },
      level: 'error',
      message: 'API connection failure detected',
      cooldownMs: 120000, // 2 minutes
      enabled: true
    });
  }

  // Setup default alert channels
  private setupDefaultChannels(): void {
    // Console channel (always enabled for development)
    this.addAlertChannel({
      name: 'console',
      type: 'console',
      config: {},
      enabled: true,
      levels: ['info', 'warning', 'error', 'critical']
    });

    // Email channel (disabled by default)
    this.addAlertChannel({
      name: 'email',
      type: 'email',
      config: {
        to: process.env.ALERT_EMAIL || 'admin@example.com',
        from: process.env.FROM_EMAIL || 'alerts@aura-trading.com'
      },
      enabled: false,
      levels: ['error', 'critical']
    });
  }

  // Get statistics
  getStatistics(): {
    total: number;
    resolved: number;
    unresolved: number;
    byLevel: Record<string, number>;
    bySource: Record<string, number>;
  } {
    const alerts = Array.from(this.alerts.values());
    
    const stats = {
      total: alerts.length,
      resolved: alerts.filter(a => a.resolved).length,
      unresolved: alerts.filter(a => !a.resolved).length,
      byLevel: {} as Record<string, number>,
      bySource: {} as Record<string, number>
    };

    // Count by level
    for (const alert of alerts) {
      stats.byLevel[alert.level] = (stats.byLevel[alert.level] || 0) + 1;
      stats.bySource[alert.source] = (stats.bySource[alert.source] || 0) + 1;
    }

    return stats;
  }

  // Clear old resolved alerts
  clearOldAlerts(olderThanMs: number = 7 * 24 * 60 * 60 * 1000): number { // Default: 7 days
    const cutoffTime = Date.now() - olderThanMs;
    let cleared = 0;

    for (const [id, alert] of this.alerts.entries()) {
      if (alert.resolved && alert.resolvedAt && alert.resolvedAt.getTime() < cutoffTime) {
        this.alerts.delete(id);
        cleared++;
      }
    }

    if (cleared > 0) {
      logger.info(`Cleared ${cleared} old resolved alerts`);
    }

    return cleared;
  }
}

// Singleton instance
const alertManager = new AlertManager();

export default alertManager;
export { AlertManager, Alert, AlertRule, AlertChannel };