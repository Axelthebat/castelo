import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // host 0.0.0.0 deixa o front acessível também pelo IP da máquina na rede local.
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // O site é servido por trás de um proxy com domínio próprio. O ponto
    // inicial permite qualquer subdomínio de x3r0ththeproto.shop.
    allowedHosts: ['localhost', '127.0.0.1', '.x3r0ththeproto.shop'],
    proxy: {
      '/api': 'http://localhost:4000',
      '/ws': {
        target: 'ws://localhost:4000',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
