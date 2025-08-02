import { teardownIntegrationTests } from './setup';

export default async (): Promise<void> => {
  console.log('Tearing down integration test environment...');
  
  try {
    await teardownIntegrationTests();
    console.log('Integration test environment teardown complete');
  } catch (error) {
    console.error('Failed to teardown integration test environment:', error);
  }
};