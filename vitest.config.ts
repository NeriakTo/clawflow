import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/server/**'],
      exclude: ['src/web/**', 'src/cli/**'],
    },
  },
});
