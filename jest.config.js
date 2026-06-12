export default {
  testEnvironment: 'node',
  // Transform TypeScript sources to ESM via ts-jest (native ESM, no type-check).
  // Plain .js test/source files stay native ESM (package.json "type": "module").
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
        // Tests should not fail on type errors — `npm run build` (tsc --noEmit)
        // is the dedicated type-check gate. Keeps test runs fast & decoupled.
        diagnostics: false,
      },
    ],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: [
    '**/__tests__/**/*.test.{js,ts}',
  ],
  testTimeout: 30000,
  collectCoverageFrom: [
    'graphql/resolvers/**/*.ts',
    'middleware/**/*.ts',
    'utils/billingCron.ts',
    '!**/__tests__/**',
  ],
  coverageReporters: ['text', 'lcov'],
};
