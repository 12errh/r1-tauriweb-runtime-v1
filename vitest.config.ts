import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    // Auto-discovers *.test.ts in all packages and apps
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    // Exit with code 0 even if no tests are found
    passWithNoTests: true,
    // Provide a mocked DOM environment for testing window globals
    environment: 'happy-dom',
    globals: true,
    reporters: ['verbose'],
  },
  resolve: {
    alias: {
      '@r1/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@r1/kernel': resolve(__dirname, 'packages/kernel/src/index.ts'),
      '@r1/apis/window': resolve(__dirname, 'packages/apis/src/window.ts'),
      '@r1/apis': resolve(__dirname, 'packages/apis/src/index.ts'),
      '@r1/window': resolve(__dirname, 'packages/window/src/index.ts'),
      '@r1/sw': resolve(__dirname, 'packages/sw/src/index.ts'),
      '@r1/vite-plugin': resolve(__dirname, 'packages/vite-plugin/src/index.ts'),
    },
  },
});
