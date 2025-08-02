import { BaseError, ErrorSeverity } from './ErrorTypes';
import { logger } from '../utils/logger';

export interface NotificationChannel {
  name: string;
  enabled: boolean;
  severityFilter: ErrorSeverity[];
  send(error: BaseError): Promise<void>;
}

export interface EmailNotificationConfig {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  toEmails: string[];
}

export interface SlackNotificationConfig {
  webhookUrl: string;
  channel: string;
  username: string;
}

export interface WebhookNotificationConfig {
  url: string;
  headers?: Record<string, string>;
  timeout: number;
}

export class EmailNotificationChannel implements NotificationChannel {
  public name = 'email';
  public enabled = true;
  public severityFilter: ErrorSeverity[] = [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL];

  constructor(private config: EmailNotificationConfig) {}

  async send(error: BaseError): Promise<void> {
    try {
      // In a real implementation, you would use a library like nodemailer
      const emailContent = this.formatEmailContent(error);
      
      logger.info({
        to: this.config.toEmails,
        subject: `[AURA] ${error.severity.toUpperCase()} Error: ${error.code}`,
        error: error.toJSON(),
      }, 'Sending error notification email');

      // Simulate email sending
      await new Promise(resolve => setTimeout(resolve, 100));
      
      logger.info('Error notification email sent successfully');
    } catch (emailError) {
      logger.error({ emailError }, 'Failed to send error notification email');
    }
  }

  private formatEmailContent(error: BaseError): string {
    return `
      <h2>Error Alert - Sistema AURA</h2>
      <p><strong>Severity:</strong> ${error.severity.toUpperCase()}</p>
      <p><strong>Code:</strong> ${error.code}</p>
      <p><strong>Message:</strong> ${error.message}</p>
      <p><strong>Timestamp:</strong> ${error.timestamp.toISOString()}</p>
      
      ${error.context ? `
        <h3>Context</h3>
        <pre>${JSON.stringify(error.context, null, 2)}</pre>
      ` : ''}
      
      ${error.stack ? `
        <h3>Stack Trace</h3>
        <pre>${error.stack}</pre>
      ` : ''}
    `;
  }
}

export class SlackNotificationChannel implements NotificationChannel {
  public name = 'slack';
  public enabled = true;
  public severityFilter: ErrorSeverity[] = [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL];

  constructor(private config: SlackNotificationConfig) {}

  async send(error: BaseError): Promise<void> {
    try {
      const payload = this.formatSlackPayload(error);
      
      logger.info({
        webhook: this.config.webhookUrl,
        channel: this.config.channel,
        error: error.toJSON(),
      }, 'Sending error notification to Slack');

      // In a real implementation, you would make an HTTP request to the webhook
      // const response = await fetch(this.config.webhookUrl, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload),
      // });

      // Simulate Slack notification
      await new Promise(resolve => setTimeout(resolve, 100));
      
      logger.info('Error notification sent to Slack successfully');
    } catch (slackError) {
      logger.error({ slackError }, 'Failed to send error notification to Slack');
    }
  }

  private formatSlackPayload(error: BaseError): any {
    const color = this.getSeverityColor(error.severity);
    
    return {
      channel: this.config.channel,
      username: this.config.username,
      attachments: [
        {
          color,
          title: `🚨 ${error.severity.toUpperCase()} Error Alert`,
          fields: [
            {
              title: 'Error Code',
              value: error.code,
              short: true,
            },
            {
              title: 'Severity',
              value: error.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Message',
              value: error.message,
              short: false,
            },
            {
              title: 'Timestamp',
              value: error.timestamp.toISOString(),
              short: true,
            },
            ...(error.context?.userId ? [{
              title: 'User ID',
              value: error.context.userId,
              short: true,
            }] : []),
            ...(error.context?.strategyId ? [{
              title: 'Strategy ID',
              value: error.context.strategyId,
              short: true,
            }] : []),
          ],
          footer: 'Sistema AURA',
          ts: Math.floor(error.timestamp.getTime() / 1000),
        },
      ],
    };
  }

  private getSeverityColor(severity: ErrorSeverity): string {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 'danger';
      case ErrorSeverity.HIGH:
        return 'warning';
      case ErrorSeverity.MEDIUM:
        return '#ffaa00';
      case ErrorSeverity.LOW:
        return 'good';
      default:
        return '#cccccc';
    }
  }
}

export class WebhookNotificationChannel implements NotificationChannel {
  public name = 'webhook';
  public enabled = true;
  public severityFilter: ErrorSeverity[] = [ErrorSeverity.CRITICAL];

  constructor(private config: WebhookNotificationConfig) {}

  async send(error: BaseError): Promise<void> {
    try {
      const payload = {
        timestamp: error.timestamp.toISOString(),
        severity: error.severity,
        code: error.code,
        message: error.message,
        context: error.context,
        stack: error.stack,
      };

      logger.info({
        webhook: this.config.url,
        error: error.toJSON(),
      }, 'Sending error notification to webhook');

      // In a real implementation, you would make an HTTP request
      // const response = await fetch(this.config.url, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     ...this.config.headers,
      //   },
      //   body: JSON.stringify(payload),
      //   signal: AbortSignal.timeout(this.config.timeout),
      // });

      // Simulate webhook call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      logger.info('Error notification sent to webhook successfully');
    } catch (webhookError) {
      logger.error({ webhookError }, 'Failed to send error notification to webhook');
    }
  }
}

export class NotificationService {
  private channels: NotificationChannel[] = [];
  private rateLimitMap: Map<string, number> = new Map();
  private readonly RATE_LIMIT_WINDOW = 300000; // 5 minutes
  private readonly MAX_NOTIFICATIONS_PER_WINDOW = 10;

  constructor() {
    this.initializeChannels();
  }

  private initializeChannels(): void {
    // Initialize email notifications if configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      const emailConfig: EmailNotificationConfig = {
        smtpHost: process.env.SMTP_HOST,
        smtpPort: parseInt(process.env.SMTP_PORT || '587'),
        smtpUser: process.env.SMTP_USER,
        smtpPassword: process.env.SMTP_PASSWORD || '',
        fromEmail: process.env.FROM_EMAIL || 'noreply@aura-trading.com',
        toEmails: (process.env.ALERT_EMAILS || '').split(',').filter(Boolean),
      };
      
      this.channels.push(new EmailNotificationChannel(emailConfig));
    }

    // Initialize Slack notifications if configured
    if (process.env.SLACK_WEBHOOK_URL) {
      const slackConfig: SlackNotificationConfig = {
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#alerts',
        username: process.env.SLACK_USERNAME || 'AURA Bot',
      };
      
      this.channels.push(new SlackNotificationChannel(slackConfig));
    }

    // Initialize webhook notifications if configured
    if (process.env.WEBHOOK_URL) {
      const webhookConfig: WebhookNotificationConfig = {
        url: process.env.WEBHOOK_URL,
        headers: process.env.WEBHOOK_HEADERS ? JSON.parse(process.env.WEBHOOK_HEADERS) : {},
        timeout: parseInt(process.env.WEBHOOK_TIMEOUT || '5000'),
      };
      
      this.channels.push(new WebhookNotificationChannel(webhookConfig));
    }

    logger.info({
      channelCount: this.channels.length,
      channels: this.channels.map(c => c.name),
    }, 'Notification service initialized');
  }

  public async notifyError(error: BaseError): Promise<void> {
    // Check rate limiting
    if (this.isRateLimited(error)) {
      logger.warn({
        errorCode: error.code,
        severity: error.severity,
      }, 'Error notification rate limited');
      return;
    }

    // Send notifications through all applicable channels
    const promises = this.channels
      .filter(channel => 
        channel.enabled && 
        channel.severityFilter.includes(error.severity)
      )
      .map(channel => this.sendNotification(channel, error));

    await Promise.allSettled(promises);
    
    // Update rate limiting
    this.updateRateLimit(error);
  }

  private async sendNotification(channel: NotificationChannel, error: BaseError): Promise<void> {
    try {
      await channel.send(error);
      
      logger.info({
        channel: channel.name,
        errorCode: error.code,
        severity: error.severity,
      }, 'Error notification sent successfully');
    } catch (notificationError) {
      logger.error({
        channel: channel.name,
        errorCode: error.code,
        notificationError,
      }, 'Failed to send error notification');
    }
  }

  private isRateLimited(error: BaseError): boolean {
    const key = `${error.code}_${error.severity}`;
    const now = Date.now();
    const windowStart = now - this.RATE_LIMIT_WINDOW;
    
    // Clean up old entries
    for (const [rateLimitKey, timestamp] of this.rateLimitMap.entries()) {
      if (timestamp < windowStart) {
        this.rateLimitMap.delete(rateLimitKey);
      }
    }

    // Count notifications in current window
    let count = 0;
    for (const [rateLimitKey, timestamp] of this.rateLimitMap.entries()) {
      if (rateLimitKey.startsWith(key) && timestamp >= windowStart) {
        count++;
      }
    }

    return count >= this.MAX_NOTIFICATIONS_PER_WINDOW;
  }

  private updateRateLimit(error: BaseError): void {
    const key = `${error.code}_${error.severity}_${Date.now()}`;
    this.rateLimitMap.set(key, Date.now());
  }

  public addChannel(channel: NotificationChannel): void {
    this.channels.push(channel);
    
    logger.info({
      channel: channel.name,
      severityFilter: channel.severityFilter,
    }, 'Notification channel added');
  }

  public removeChannel(name: string): boolean {
    const index = this.channels.findIndex(c => c.name === name);
    if (index >= 0) {
      this.channels.splice(index, 1);
      logger.info({ channel: name }, 'Notification channel removed');
      return true;
    }
    return false;
  }

  public getChannels(): NotificationChannel[] {
    return [...this.channels];
  }
}