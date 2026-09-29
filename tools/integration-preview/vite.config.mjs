import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: '../destinations/api', replacement: fileURLToPath(new URL('./mock-api.ts', import.meta.url)) },
    { find: '@', replacement: fileURLToPath(new URL('../../resources/admin/src', import.meta.url)) },
    { find: '@renderer', replacement: fileURLToPath(new URL('../../resources/renderer/src', import.meta.url)) },
  ] },
  server: { host: '127.0.0.1', port: 5195, strictPort: true },
});
