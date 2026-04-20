import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { build as esbuild } from 'esbuild';
import { existsSync, writeFileSync, mkdirSync } from 'fs';

// Pre-build the kernel worker and service worker into dist/
// so they are available when the plugin is installed from npm.
async function buildWorkers() {
  const distDir = resolve(__dirname, 'dist');
  if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

  // Kernel Worker (sw.js)
  const kernelEntry = resolve(__dirname, '../kernel/src/kernel.worker.ts');
  if (existsSync(kernelEntry)) {
    const result = await esbuild({
      entryPoints: [kernelEntry],
      bundle: true,
      write: false,
      format: 'iife',
      minify: true,
      loader: { '.css': 'empty' },
    });
    writeFileSync(resolve(distDir, 'sw.js'), result.outputFiles[0].text);
    console.log('[R1 Build] Emitted dist/sw.js');
  } else {
    console.warn('[R1 Build] kernel.worker.ts not found — dist/sw.js will not be built');
  }

  // Service Worker (r1-sw.js)
  const swEntry = resolve(__dirname, '../sw/src/index.ts');
  if (existsSync(swEntry)) {
    const result = await esbuild({
      entryPoints: [swEntry],
      bundle: true,
      write: false,
      format: 'iife',
      minify: true,
      loader: { '.css': 'empty' },
    });
    writeFileSync(resolve(distDir, 'r1-sw.js'), result.outputFiles[0].text);
    console.log('[R1 Build] Emitted dist/r1-sw.js');
  } else {
    console.warn('[R1 Build] sw/src/index.ts not found — dist/r1-sw.js will not be built');
  }
}

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'R1VitePlugin',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['vite', 'fs', 'path', 'url', 'child_process', 'crypto', 'esbuild'],
      output: {
        globals: {
          vite: 'Vite'
        }
      }
    }
  },
  plugins: [
    dts({ skipDiagnostics: true }),
    {
      name: 'build-workers',
      async closeBundle() {
        await buildWorkers();
      }
    }
  ]
});
