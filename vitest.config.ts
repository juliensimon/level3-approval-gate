import { defineConfig } from 'vitest/config';
import baseline from './gate/baseline.json' with { type: 'json' };

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'scripts/**/*.ts'],
      exclude: ['src/index.ts'],
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: baseline.limits.coverage,
    },
  },
});
