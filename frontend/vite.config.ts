import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:8080';

const sharedProxy = {
  '/api': {
    target: apiTarget,
    changeOrigin: true,
  },
  '/actuator': {
    target: apiTarget,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: false,
    proxy: sharedProxy,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: false,
    proxy: sharedProxy,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
