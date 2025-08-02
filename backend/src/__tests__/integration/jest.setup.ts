import { setupIntegrationTests, teardownIntegrationTests } from './setup';

// Setup before all tests
beforeAll(async () => {
  await setupIntegrationTests();
});

// Teardown after all tests
afterAll(async () => {
  await teardownIntegrationTests();
});

// Increase timeout for integration tests
jest.setTimeout(60000);