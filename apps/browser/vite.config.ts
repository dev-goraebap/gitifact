import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

const apiPort = process.env.TRYCE_API_PORT ?? '4317';
if (!/^\d+$/.test(apiPort) || Number(apiPort) < 1 || Number(apiPort) > 65535) throw new Error('TRYCE_API_PORT must be between 1 and 65535.');

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true,
    proxy: { '/api': { target: 'http://127.0.0.1:' + apiPort, changeOrigin: true } },
  },
  preview: { host: '127.0.0.1' },
});
