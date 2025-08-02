import { setupIntegrationTests } from './setup';

export default async (): Promise<void> => {
  console.log('Setting up integration test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = process.env.DB_NAME + '_test' || 'aura_trading_test';
  process.env.REDIS_DB = '15'; // Use database 15 for tests
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  
  try {
    await setupIntegrationTests();
    console.log('Integration test environment setup complete');
  } catch (error) {
    console.error('Failed to setup integration test environment:', error);
    process.exit(1);
  }
};