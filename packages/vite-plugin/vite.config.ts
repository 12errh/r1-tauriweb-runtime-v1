import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'R1VitePlugin',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['vite', 'fs', 'path', 'child_process', 'crypto', 'esbuild'],
      output: {
        globals: {
          vite: 'Vite'
        }
      }
    }
  },
  plugins: [dts()]
});
