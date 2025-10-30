import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    server: {
      host: '127.0.0.1', // Use explicit localhost
      port: 3000,
      strictPort: false, // Allow port fallback
      open: true, // Auto-open browser
      // open: '/markets', // Optional: open to specific path
      // To specify browser, use: open: 'chrome' or 'firefox' or 'safari' or path
      proxy: {
        '/v0': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          secure: false
        }
      }
    },
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        buffer: 'buffer',
      },
    },
    optimizeDeps: {
      include: ['buffer', 'ethers'],
    },
    build: {
      outDir: 'build',
      commonjsOptions: { transformMixedEsModules: true },
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        external: [],
      },
    },
    plugins: [react()],
    css: {
      target: 'async',
    },
  };
});