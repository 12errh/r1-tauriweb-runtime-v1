import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { build } from 'esbuild';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'r1-sw-serve',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url === '/r1-sw.js') {
            try {
              const swPath = resolve(__dirname, '../../packages/sw/src/index.ts');
              const result = await build({
                entryPoints: [swPath],
                bundle: true,
                write: false,
                format: 'iife',
                platform: 'browser',
                minify: false,
                sourcemap: 'inline',
                define: { 'process.env.NODE_ENV': '"development"' }
              });
              res.setHeader('Content-Type', 'application/javascript');
              res.setHeader('Service-Worker-Allowed', '/');
              res.end(result.outputFiles[0].text);
              return;
            } catch (e) {
              console.error('[R1 SW Serve] Error:', e);
              next(e);
            }
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      '@r1/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@r1/kernel/worker': resolve(__dirname, '../../packages/kernel/src/kernel.worker.ts'),
      '@r1/kernel': resolve(__dirname, '../../packages/kernel/src/index.ts'),
      '@r1/apis': resolve(__dirname, '../../packages/apis/src/index.ts'),
      '@r1/window': resolve(__dirname, '../../packages/window/src/index.ts'),
      '@r1/sw': resolve(__dirname, '../../packages/sw/src/index.ts'),
      '@r1/vite-plugin': resolve(__dirname, '../../packages/vite-plugin/src/index.ts'),
    },
  },
});
