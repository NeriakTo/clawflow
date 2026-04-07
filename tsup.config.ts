import { defineConfig } from 'tsup';

export default defineConfig([
  // 主入口（library）
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    outDir: 'dist',
    clean: true,
    dts: true,
    sourcemap: true,
    splitting: false,
    shims: true,
  },
  // CLI 入口
  {
    entry: ['src/cli/index.ts'],
    format: ['esm'],
    platform: 'node',
    target: 'node22',
    outDir: 'dist/cli',
    clean: false,
    dts: false,
    sourcemap: true,
    splitting: false,
    shims: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
