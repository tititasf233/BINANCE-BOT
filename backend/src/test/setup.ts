/**
 * Jest test setup file
 * This file is executed before each test suite
 */

import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods in tests to reduce noise
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

// Global test timeout
jest.setTimeout(30000);

// Setup global test utilities
global.beforeAll(async () => {
  // Any global setup can go here
});

global.afterAll(async () => {
  // Any global cleanup can go here
});

export {};