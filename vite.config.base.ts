import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Shared Vite config for all @r1-runtime/* library packages.
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
        '@r1-runtime/core',
        '@r1-runtime/kernel',
        '@r1-runtime/apis',
        /^@r1-runtime\/apis\/.*/,   // sub-paths like @r1-runtime/apis/window
        '@r1-runtime/window',
        '@r1-runtime/sw',
        '@r1-runtime/vite-plugin',
        // Keep old names as external too in case any dist still references them
        '@r1/core',
        '@r1/kernel',
        '@r1/apis',
        /^@r1\/apis\/.*/,
        '@r1/window',
        '@r1/sw',
        '@r1/vite-plugin',
      ],
    },
    sourcemap: true,
    minify: false,
  },
});
