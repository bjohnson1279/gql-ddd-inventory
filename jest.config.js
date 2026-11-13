const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

// Ensure tests have a secret set
process.env.JWT_SECRET = 'test-secret';

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/index.ts', '!src/**/__tests__/**'],
  coverageReporters: ['text', 'json-summary', 'lcov', 'cobertura'],
  coverageThreshold: {
    global: { statements: 77, branches: 61, functions: 73, lines: 78 },
    './src/application/useCases/ManageJournals.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
  },
  transform: {
    ...tsJestTransformCfg,
  },
  modulePathIgnorePatterns: ["<rootDir>/web"],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
};
