import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Tell Vite to look in public/ for static assets like favicons
  publicDir: 'public',
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': { target: 'http://backend:5000', changeOrigin: true }
    }
  }
});
