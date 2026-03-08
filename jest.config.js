export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.js',
  ],
  testTimeout: 30000,
  collectCoverageFrom: [
    'graphql/resolvers/**/*.js',
    'middleware/**/*.js',
    'utils/billingCron.js',
    '!**/__tests__/**',
  ],
  coverageReporters: ['text', 'lcov'],
};
