module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/integration/**/*.integration.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/test/**',
  ],
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/integration/jest.setup.ts'],
  globalSetup: '<rootDir>/src/__tests__/integration/jest.globalSetup.ts',
  globalTeardown: '<rootDir>/src/__tests__/integration/jest.globalTeardown.ts',
  testTimeout: 60000, // 60 seconds timeout for integration tests
  maxWorkers: 1, // Run tests sequentially to avoid database conflicts
  verbose: true,
  detectOpenHandles: true,
  forceExit: true,
};