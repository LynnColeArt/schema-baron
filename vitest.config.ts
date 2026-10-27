import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['scripts/workspace/**/*.test.ts', 'packages/**/*.test.ts', 'apps/**/*.test.ts', 'tests/contracts/**/*.test.ts', 'tests/integration/**/*.test.ts'], exclude: ['**/node_modules/**', '**/dist/**'], passWithNoTests: false, testTimeout: 30000 } });
