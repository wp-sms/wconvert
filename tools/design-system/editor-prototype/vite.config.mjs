import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: { alias: {
    '@renderer': fileURLToPath(new URL('../../../resources/renderer/src', import.meta.url)),
    '@loader': fileURLToPath(new URL('../../../resources/loader/src', import.meta.url)),
    '@': fileURLToPath(new URL('../../../resources/admin/src', import.meta.url)),
  } },
  server: { host: '127.0.0.1', port: 5188, strictPort: true },
  build: { outDir: '../out/editor-prototype', emptyOutDir: true },
});
