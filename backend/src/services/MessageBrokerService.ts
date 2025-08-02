import { EventEmitter } from 'events';
import { redisService } from './RedisService';
import { logger } from '@/utils/logger';

export interface BrokerMessage {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  source: string;
  retryCount?: number;
}

export interface MessageHandler {
  (message: BrokerMessage): Promise<void>;
}

export interface SubscriptionOptions {
  maxRetries?: number;
  retryDelay?: number;
  deadLetterQueue?: string;
}

export class MessageBrokerService extends EventEmitter {
  private handlers: Map<string, MessageHandler[]> = new Map();
  private subscriptions: Set<string> = new Set();
  private isConnected = false;
  private processingQueues: Set<string> = new Set();

  constructor() {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('error', (error) => {
      logger.error('MessageBroker error:', error);
    });

    this.on('message_processed', (data) => {
      logger.debug('Message processed successfully', data);
    });

    this.on('message_failed', (data) => {
      logger.warn('Message processing failed', data);
    });
  }

  /**
   * Initialize the message broker
   */
  async initialize(): Promise<void> {
    try {
      if (!redisService.isReady()) {
        await redisService.connect();
      }

      this.isConnected = true;
      logger.info('MessageBroker initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize MessageBroker:', error);
      throw error;
    }
  }

  /**
   * Publish a message to a topic
   */
  async publish(topic: string, payload: any, source = 'unknown'): Promise<void> {
    if (!this.isConnected) {
      throw new Error('MessageBroker not initialized');
    }

    try {
      const message: BrokerMessage = {
        id: this.generateMessageId(),
        type: topic,
        payload,
        timestamp: Date.now(),
        source,
        retryCount: 0
      };

      // Publish to Redis pub/sub for real-time subscribers
      await redisService.publish(topic, message);

      // Also add to a queue for reliable processing
      await redisService.lpush(`queue:${topic}`, message);

      logger.debug('Message published', { 
        topic, 
        messageId: message.id, 
        source 
      });

      this.emit('message_published', { topic, messageId: message.id });

    } catch (error) {
      logger.error('Failed to publish message:', { topic, error });
      throw error;
    }
  }

  /**
   * Subscribe to a topic with real-time updates
   */
  async subscribe(
    topic: string, 
    handler: MessageHandler, 
    options: SubscriptionOptions = {}
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('MessageBroker not initialized');
    }

    try {
      // Add handler to the list
      if (!this.handlers.has(topic)) {
        this.handlers.set(topic, []);
      }
      this.handlers.get(topic)!.push(handler);

      // Subscribe to Redis pub/sub if not already subscribed
      if (!this.subscriptions.has(topic)) {
        await redisService.subscribe(topic, async (message, channel) => {
          try {
            const brokerMessage: BrokerMessage = JSON.parse(message);
            await this.processMessage(channel, brokerMessage, options);
          } catch (error) {
            logger.error('Error processing subscribed message:', { channel, error });
          }
        });

        this.subscriptions.add(topic);
      }

      // Start processing the queue for this topic
      this.startQueueProcessor(topic, options);

      logger.info('Subscribed to topic', { topic });

    } catch (error) {
      logger.error('Failed to subscribe to topic:', { topic, error });
      throw error;
    }
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribe(topic: string, handler?: MessageHandler): Promise<void> {
    try {
      if (handler) {
        // Remove specific handler
        const handlers = this.handlers.get(topic);
        if (handlers) {
          const index = handlers.indexOf(handler);
          if (index > -1) {
            handlers.splice(index, 1);
          }
          
          // If no handlers left, unsubscribe completely
          if (handlers.length === 0) {
            this.handlers.delete(topic);
            await redisService.unsubscribe(topic);
            this.subscriptions.delete(topic);
            this.processingQueues.delete(topic);
          }
        }
      } else {
        // Remove all handlers for topic
        this.handlers.delete(topic);
        await redisService.unsubscribe(topic);
        this.subscriptions.delete(topic);
        this.processingQueues.delete(topic);
      }

      logger.info('Unsubscribed from topic', { topic });

    } catch (error) {
      logger.error('Failed to unsubscribe from topic:', { topic, error });
      throw error;
    }
  }

  /**
   * Start processing messages from a queue
   */
  private startQueueProcessor(topic: string, options: SubscriptionOptions): void {
    if (this.processingQueues.has(topic)) {
      return; // Already processing
    }

    this.processingQueues.add(topic);

    const processQueue = async () => {
      try {
        const queueKey = `queue:${topic}`;
        const message = await redisService.rpop<BrokerMessage>(queueKey, true);

        if (message) {
          await this.processMessage(topic, message, options);
        }

        // Continue processing if still subscribed
        if (this.processingQueues.has(topic)) {
          // Use setTimeout to prevent blocking the event loop
          setTimeout(processQueue, 100);
        }

      } catch (error) {
        logger.error('Error in queue processor:', { topic, error });
        
        // Retry after delay if still subscribed
        if (this.processingQueues.has(topic)) {
          setTimeout(processQueue, 1000);
        }
      }
    };

    // Start processing
    processQueue();
  }

  /**
   * Process a message with all registered handlers
   */
  private async processMessage(
    topic: string, 
    message: BrokerMessage, 
    options: SubscriptionOptions
  ): Promise<void> {
    const handlers = this.handlers.get(topic);
    if (!handlers || handlers.length === 0) {
      return;
    }

    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;

    for (const handler of handlers) {
      try {
        await handler(message);
        
        this.emit('message_processed', {
          topic,
          messageId: message.id,
          handler: handler.name
        });

      } catch (error) {
        logger.error('Handler failed to process message:', {
          topic,
          messageId: message.id,
          error,
          retryCount: message.retryCount || 0
        });

        // Retry logic
        const currentRetries = message.retryCount || 0;
        if (currentRetries < maxRetries) {
          message.retryCount = currentRetries + 1;
          
          // Add back to queue with delay
          setTimeout(async () => {
            await redisService.lpush(`queue:${topic}`, message);
          }, retryDelay * Math.pow(2, currentRetries)); // Exponential backoff

          this.emit('message_retry', {
            topic,
            messageId: message.id,
            retryCount: message.retryCount
          });

        } else {
          // Max retries reached, send to dead letter queue if configured
          if (options.deadLetterQueue) {
            await redisService.lpush(options.deadLetterQueue, {
              ...message,
              failedAt: Date.now(),
              originalTopic: topic,
              error: error instanceof Error ? error.message : String(error)
            });
          }

          this.emit('message_failed', {
            topic,
            messageId: message.id,
            error,
            maxRetriesReached: true
          });
        }
      }
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(topic: string): Promise<{
    queueLength: number;
    deadLetterLength?: number;
  }> {
    try {
      const queueKey = `queue:${topic}`;
      const queueLength = await redisService.client.lLen(queueKey);

      const stats: any = { queueLength };

      // Check dead letter queue if it exists
      const deadLetterKey = `dlq:${topic}`;
      if (await redisService.exists(deadLetterKey)) {
        stats.deadLetterLength = await redisService.client.lLen(deadLetterKey);
      }

      return stats;

    } catch (error) {
      logger.error('Failed to get queue stats:', { topic, error });
      throw error;
    }
  }

  /**
   * Clear a queue
   */
  async clearQueue(topic: string): Promise<void> {
    try {
      const queueKey = `queue:${topic}`;
      await redisService.del(queueKey);
      
      logger.info('Queue cleared', { topic });

    } catch (error) {
      logger.error('Failed to clear queue:', { topic, error });
      throw error;
    }
  }

  /**
   * Get all active subscriptions
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  /**
   * Get broker status
   */
  getStatus(): {
    connected: boolean;
    subscriptions: number;
    processingQueues: number;
  } {
    return {
      connected: this.isConnected,
      subscriptions: this.subscriptions.size,
      processingQueues: this.processingQueues.size
    };
  }

  /**
   * Shutdown the message broker
   */
  async shutdown(): Promise<void> {
    try {
      // Stop all queue processors
      this.processingQueues.clear();

      // Unsubscribe from all topics
      for (const topic of this.subscriptions) {
        await redisService.unsubscribe(topic);
      }

      this.subscriptions.clear();
      this.handlers.clear();
      this.isConnected = false;

      logger.info('MessageBroker shutdown completed');

    } catch (error) {
      logger.error('Error during MessageBroker shutdown:', error);
      throw error;
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Create singleton instance
export const messageBroker = new MessageBrokerService();
export default messageBroker;