import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * The SPA compiles to static assets served from S3 behind CloudFront (ADR-0016), so there
 * is no server process here — `vite build` output is the entire deployable.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    /**
     * Dev-only proxy. In production the SPA and the API share one CloudFront origin
     * (ADR-0016), so the client always calls `/api` relative — no CORS, no base URL to
     * configure per environment.
     */
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // No source maps in the published build: anything in dist is public, and a map hands out
    // the full original source (ADR-0034).
    sourcemap: false,
    rollupOptions: {
      output: {
        /**
         * React Flow plus d3 is meaningful bundle weight (ADR-0005). The chart route is
         * lazy-loaded, and splitting the vendor chunk keeps it out of the initial payload.
         */
        manualChunks(id) {
          if (id.includes('@xyflow/react') || id.includes('d3-hierarchy')) {
            return 'chart';
          }
          return undefined;
        },
      },
    },
  },
});
