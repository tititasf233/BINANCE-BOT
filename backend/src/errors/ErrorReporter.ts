import { BaseError, ErrorSeverity } from './ErrorTypes';
import { logger } from '../utils/logger';

export interface ErrorReport {
  id: string;
  timestamp: Date;
  error: BaseError;
  environment: string;
  version: string;
  userId?: string;
  sessionId?: string;
  additionalContext?: Record<string, any>;
}

export interface ExternalErrorReportingService {
  name: string;
  enabled: boolean;
  reportError(report: ErrorReport): Promise<void>;
}

export class SentryErrorReporting implements ExternalErrorReportingService {
  public name = 'sentry';
  public enabled = true;

  constructor(private dsn: string) {}

  async reportError(report: ErrorReport): Promise<void> {
    try {
      // In a real implementation, you would use @sentry/node
      logger.info({
        service: 'sentry',
        errorId: report.id,
        errorCode: report.error.code,
        severity: report.error.severity,
      }, 'Reporting error to Sentry');

      // Simulate Sentry reporting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      logger.info('Error reported to Sentry successfully');
    } catch (sentryError) {
      logger.error({ sentryError }, 'Failed to report error to Sentry');
    }
  }
}

export class BugsnagErrorReporting implements ExternalErrorReportingService {
  public name = 'bugsnag';
  public enabled = true;

  constructor(private apiKey: string) {}

  async reportError(report: ErrorReport): Promise<void> {
    try {
      logger.info({
        service: 'bugsnag',
        errorId: report.id,
        errorCode: report.error.code,
        severity: report.error.severity,
      }, 'Reporting error to Bugsnag');

      // Simulate Bugsnag reporting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      logger.info('Error reported to Bugsnag successfully');
    } catch (bugsnagError) {
      logger.error({ bugsnagError }, 'Failed to report error to Bugsnag');
    }
  }
}

export class CustomErrorReporting implements ExternalErrorReportingService {
  public name = 'custom';
  public enabled = true;

  constructor(private endpoint: string, private apiKey: string) {}

  async reportError(report: ErrorReport): Promise<void> {
    try {
      const payload = {
        id: report.id,
        timestamp: report.timestamp.toISOString(),
        environment: report.environment,
        version: report.version,
        error: {
          code: report.error.code,
          message: report.error.message,
          severity: report.error.severity,
          stack: report.error.stack,
          context: report.error.context,
        },
        user: {
          id: report.userId,
          sessionId: report.sessionId,
        },
        additionalContext: report.additionalContext,
      };

      logger.info({
        service: 'custom',
        endpoint: this.endpoint,
        errorId: report.id,
        errorCode: report.error.code,
      }, 'Reporting error to custom service');

      // In a real implementation, you would make an HTTP request
      // const response = await fetch(this.endpoint, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${this.apiKey}`,
      //   },
      //   body: JSON.stringify(payload),
      // });

      // Simulate custom service reporting
      await new Promise(resolve => setTimeout(resolve, 100));
      
      logger.info('Error reported to custom service successfully');
    } catch (customError) {
      logger.error({ customError }, 'Failed to report error to custom service');
    }
  }
}

export class ErrorReporter {
  private services: ExternalErrorReportingService[] = [];
  private reportQueue: ErrorReport[] = [];
  private isProcessing = false;
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly BATCH_SIZE = 10;
  private readonly PROCESS_INTERVAL = 5000; // 5 seconds

  constructor() {
    this.initializeServices();
    this.startQueueProcessor();
  }

  private initializeServices(): void {
    // Initialize Sentry if configured
    if (process.env.SENTRY_DSN) {
      this.services.push(new SentryErrorReporting(process.env.SENTRY_DSN));
    }

    // Initialize Bugsnag if configured
    if (process.env.BUGSNAG_API_KEY) {
      this.services.push(new BugsnagErrorReporting(process.env.BUGSNAG_API_KEY));
    }

    // Initialize custom error reporting if configured
    if (process.env.ERROR_REPORTING_ENDPOINT && process.env.ERROR_REPORTING_API_KEY) {
      this.services.push(new CustomErrorReporting(
        process.env.ERROR_REPORTING_ENDPOINT,
        process.env.ERROR_REPORTING_API_KEY
      ));
    }

    logger.info({
      serviceCount: this.services.length,
      services: this.services.map(s => s.name),
    }, 'Error reporting services initialized');
  }

  public reportError(error: BaseError): void {
    // Only report critical errors to external services
    if (error.severity !== ErrorSeverity.CRITICAL) {
      return;
    }

    const report: ErrorReport = {
      id: this.generateReportId(),
      timestamp: new Date(),
      error,
      environment: process.env.NODE_ENV || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      userId: error.context?.userId,
      sessionId: error.context?.requestId,
      additionalContext: {
        ...error.context?.additionalData,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };

    this.queueReport(report);
  }

  private queueReport(report: ErrorReport): void {
    if (this.reportQueue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest report to make room
      this.reportQueue.shift();
      
      logger.warn({
        queueSize: this.reportQueue.length,
        maxSize: this.MAX_QUEUE_SIZE,
      }, 'Error report queue is full, removing oldest report');
    }

    this.reportQueue.push(report);
    
    logger.debug({
      reportId: report.id,
      queueSize: this.reportQueue.length,
    }, 'Error report queued');
  }

  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isProcessing && this.reportQueue.length > 0) {
        this.processQueue();
      }
    }, this.PROCESS_INTERVAL);
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.reportQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = this.reportQueue.splice(0, this.BATCH_SIZE);
      
      logger.info({
        batchSize: batch.length,
        remainingInQueue: this.reportQueue.length,
      }, 'Processing error report batch');

      await Promise.allSettled(
        batch.map(report => this.sendReportToServices(report))
      );
    } catch (processingError) {
      logger.error({ processingError }, 'Error processing report queue');
    } finally {
      this.isProcessing = false;
    }
  }

  private async sendReportToServices(report: ErrorReport): Promise<void> {
    const enabledServices = this.services.filter(s => s.enabled);
    
    if (enabledServices.length === 0) {
      logger.warn('No enabled error reporting services available');
      return;
    }

    const promises = enabledServices.map(service => 
      this.sendToService(service, report)
    );

    await Promise.allSettled(promises);
  }

  private async sendToService(
    service: ExternalErrorReportingService, 
    report: ErrorReport
  ): Promise<void> {
    try {
      await service.reportError(report);
      
      logger.info({
        service: service.name,
        reportId: report.id,
        errorCode: report.error.code,
      }, 'Error report sent to service successfully');
    } catch (serviceError) {
      logger.error({
        service: service.name,
        reportId: report.id,
        serviceError,
      }, 'Failed to send error report to service');
    }
  }

  private generateReportId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public addService(service: ExternalErrorReportingService): void {
    this.services.push(service);
    
    logger.info({
      service: service.name,
    }, 'Error reporting service added');
  }

  public removeService(name: string): boolean {
    const index = this.services.findIndex(s => s.name === name);
    if (index >= 0) {
      this.services.splice(index, 1);
      logger.info({ service: name }, 'Error reporting service removed');
      return true;
    }
    return false;
  }

  public getServices(): ExternalErrorReportingService[] {
    return [...this.services];
  }

  public getQueueStatus(): { size: number; isProcessing: boolean } {
    return {
      size: this.reportQueue.length,
      isProcessing: this.isProcessing,
    };
  }

  public clearQueue(): void {
    this.reportQueue.length = 0;
    logger.info('Error report queue cleared');
  }
}