import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { r1Plugin } from '../../packages/vite-plugin/src/index';

export default defineConfig({
  plugins: [
    react(),
    r1Plugin({
      rustSrc: resolve(__dirname, '../../tests/fixtures/rust/test-module'),
      wasmOut: 'public/wasm'
    })
  ],
  resolve: {
    alias: {
      '@r1-runtime/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@r1-runtime/kernel/worker': resolve(__dirname, '../../packages/kernel/src/kernel.worker.ts'),
      '@r1-runtime/kernel': resolve(__dirname, '../../packages/kernel/src/index.ts'),
      '@r1-runtime/apis/window': resolve(__dirname, '../../packages/apis/src/window.ts'),
      '@r1-runtime/apis': resolve(__dirname, '../../packages/apis/src/index.ts'),
      '@r1-runtime/window': resolve(__dirname, '../../packages/window/src/index.ts'),
      '@r1-runtime/sw': resolve(__dirname, '../../packages/sw/src/index.ts'),
      '@r1-runtime/vite-plugin': resolve(__dirname, '../../packages/vite-plugin/src/index.ts'),
    },
  },
});
