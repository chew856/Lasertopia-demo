import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The concurrency test drives one SQLite file; running suites in parallel would have
    // unrelated tests fighting the same write lock and produce flaky, meaningless failures.
    fileParallelism: false,
  },
});
