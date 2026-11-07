import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vortex Dashboard dev server.
 * - Binds 0.0.0.0 so the Arena live-preview proxy can reach it.
 * - `allowedHosts: true` accepts the dynamic e2b preview hostnames.
 * - Browser code only ever calls relative `/api/*` URLs; the dev server
 *   proxies them to the Vortex Storage Engine on 127.0.0.1:8787
 *   (proxying happens inside the sandbox, so no browser→localhost calls).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
