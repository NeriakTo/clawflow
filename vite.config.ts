import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  root: '.',
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3700',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:3700',
        ws: true,
      },
    },
  },
});
