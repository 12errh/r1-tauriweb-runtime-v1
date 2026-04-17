import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { r1Plugin } from '../../packages/vite-plugin/dist/index.js';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    r1Plugin({
      rustSrc: 'src-tauri',
      wasmOut: 'public/wasm'
    })
  ]
});
