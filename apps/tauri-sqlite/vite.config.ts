import { defineConfig } from "vite";
import { r1Plugin } from "@r1/vite-plugin";

const mobile =
  process.env.TAURI_PLATFORM === "android" ||
  process.env.TAURI_PLATFORM === "ios";

// R1 SQLite Build Fix: Inject flags to avoid missing stdio.h in libsqlite3-sys on Windows
if (process.env.TARGET?.includes('wasm32')) {
  process.env.LIBSQLITE3_FLAGS = "-DSQLITE_OMIT_LOAD_EXTENSION -DSQLITE_THREADSAFE=0 -DSQLITE_ENABLE_MEMSYS5";
  // Attempt to use clang if available, but the flags are the primary fix
  if (!process.env.CC) process.env.CC = "clang";
}

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    r1Plugin({ rustSrc: './src-tauri' })
  ],
  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  // prevent vite from obscuring rust errors
  clearScreen: false,
  // tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
  },
  // to make use of `TAURI_DEBUG` and other env variables
  // https://tauri.studio/v1/api/config#buildconfig.beforedevcommand
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // Tauri supports es2021
    target: process.env.TAURI_PLATFORM == "windows" ? "chrome105" : "safari13",
    // don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    // produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
  },
}));
