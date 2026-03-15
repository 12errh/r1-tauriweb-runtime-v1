import { Plugin } from 'vite';
import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function r1VitePlugin(): Plugin {
  return {
    name: 'r1-vite-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/sw.js') {
          try {
            // Point to the kernel worker source
            const workerPath = resolve(__dirname, '../../kernel/src/kernel.worker.ts');
            
            const result = await build({
              entryPoints: [workerPath],
              bundle: true,
              write: false,
              format: 'iife',
              platform: 'browser',
              minify: false,
              sourcemap: 'inline',
              define: {
                'process.env.NODE_ENV': '"development"'
              }
            });

            res.setHeader('Content-Type', 'application/javascript');
            res.end(result.outputFiles[0].text);
            return;
          } catch (e) {
            console.error('[R1 Vite Plugin] Failed to bundle worker:', e);
            next(e);
          }
        } else {
          next();
        }
      });
    }
  };
}
