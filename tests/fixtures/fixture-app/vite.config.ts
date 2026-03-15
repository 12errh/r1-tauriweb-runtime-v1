import { defineConfig } from 'vite';
import { r1Plugin } from '../../../packages/vite-plugin/dist/index.js';

export default defineConfig({
  plugins: [r1Plugin()],
  build: {
    minify: false,
    outDir: 'dist'
  }
});
