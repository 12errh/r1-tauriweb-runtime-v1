import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Shared Vite config for all @r1/* library packages.
 * Each package's vite.config.ts merges with this.
 */
export const baseLibConfig = defineConfig({
  build: {
    lib: {
      entry: resolve(process.cwd(), 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        '@r1/core',
        '@r1/kernel',
        '@r1/apis',
        '@r1/window',
        '@r1/sw',
        '@r1/vite-plugin',
      ],
    },
    sourcemap: true,
    minify: false,
  },
});
