import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'https://ghoostchat-2.onrender.com',
        ws: true,
        changeOrigin: true,
      },
      '/api': {
        target: 'https://ghoostchat-2.onrender.com',
        changeOrigin: true,
      },
      '/health': {
        target: 'https://ghoostchat-2.onrender.com',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
  },
});
