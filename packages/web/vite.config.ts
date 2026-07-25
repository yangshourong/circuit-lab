import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// MVP editor build. The pure-TS engine @circuit/core is imported as TS source
// directly (no separate build step) via the alias below.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@circuit/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    open: false,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
