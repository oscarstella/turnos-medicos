import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/turnos/',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5060',
        changeOrigin: true
      }
    }
  }
});
