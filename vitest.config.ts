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
      '@r1-runtime/core': resolve(__dirname, 'packages/core/src/index.ts'),
      '@r1-runtime/kernel': resolve(__dirname, 'packages/kernel/src/index.ts'),
      '@r1-runtime/apis/window': resolve(__dirname, 'packages/apis/src/window.ts'),
      '@r1-runtime/apis/core': resolve(__dirname, 'packages/apis/src/tauri/index.ts'),
      '@r1-runtime/apis/fs': resolve(__dirname, 'packages/apis/src/fs.ts'),
      '@r1-runtime/apis/event': resolve(__dirname, 'packages/apis/src/event.ts'),
      '@r1-runtime/apis/path': resolve(__dirname, 'packages/apis/src/path_util.ts'),
      '@r1-runtime/apis/dialog': resolve(__dirname, 'packages/apis/src/dialog/index.ts'),
      '@r1-runtime/apis/clipboard': resolve(__dirname, 'packages/apis/src/clipboard/index.ts'),
      '@r1-runtime/apis/os': resolve(__dirname, 'packages/apis/src/os.ts'),
      '@r1-runtime/apis/store': resolve(__dirname, 'packages/apis/src/store.ts'),
      '@r1-runtime/apis/sql': resolve(__dirname, 'packages/apis/src/sql.ts'),
      '@r1-runtime/apis/notification': resolve(__dirname, 'packages/apis/src/notification.ts'),
      '@r1-runtime/apis/shell': resolve(__dirname, 'packages/apis/src/shell.ts'),
      '@r1-runtime/apis/http': resolve(__dirname, 'packages/apis/src/http.ts'),
      '@r1-runtime/apis': resolve(__dirname, 'packages/apis/src/index.ts'),
      '@r1-runtime/window': resolve(__dirname, 'packages/window/src/index.ts'),
      '@r1-runtime/sw': resolve(__dirname, 'packages/sw/src/index.ts'),
      '@r1-runtime/vite-plugin': resolve(__dirname, 'packages/vite-plugin/src/index.ts'),
      // Keep old aliases for any remaining references
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
