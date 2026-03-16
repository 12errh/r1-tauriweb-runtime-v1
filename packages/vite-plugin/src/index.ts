import { Plugin, ResolvedConfig } from 'vite';
import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const _dirname = dirname(fileURLToPath(import.meta.url));

export interface R1PluginOptions {
  rustSrc?: string; // Default: 'src-tauri'
  wasmOut?: string; // Default: 'public/wasm'
  swSrc?: string;   // Optional override for Service Worker source
}

export function r1Plugin(options: R1PluginOptions = {}): Plugin {
  const {
    rustSrc = 'src-tauri',
    wasmOut = 'public/wasm',
  } = options;

  let config: ResolvedConfig;

  const getWasmName = () => {
    const cargoPath = resolve(config?.root || process.cwd(), rustSrc, 'Cargo.toml');
    if (existsSync(cargoPath)) {
      const content = readFileSync(cargoPath, 'utf8');
      
      // Try to find [lib] name first
      const libMatch = content.match(/\[lib\][^]*?name\s*=\s*"([^"]+)"/);
      if (libMatch) return libMatch[1].replace(/-/g, '_');

      // Fallback to [package] name
      const pkgMatch = content.match(/\[package\][^]*?name\s*=\s*"([^"]+)"/);
      if (pkgMatch) return pkgMatch[1].replace(/-/g, '_');

      // Broad fallback
      const match = content.match(/name\s*=\s*"([^"]+)"/);
      if (match) return match[1].replace(/-/g, '_');
    }
    return 'app';
  };
  return {
    name: 'vite-plugin-r1',
    enforce: 'pre',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    async buildStart() {
      const cargoPath = resolve(config.root, rustSrc, 'Cargo.toml');
      if (existsSync(cargoPath)) {
        console.log(`[R1] Found Rust source at ${rustSrc}. Building WASM...`);
        
        await new Promise<void>((resolvePromise, reject) => {
          const child = spawn('wasm-pack', [
            'build',
            rustSrc,
            '--target', 'web',
            '--out-dir', resolve(config.root, wasmOut)
          ], { stdio: 'inherit', shell: true });

          child.on('error', (err: any) => {
            if (err.code === 'ENOENT') {
              console.warn('[R1] wasm-pack not found. Please install it: https://rustwasm.github.io/wasm-pack/installer/');
              resolvePromise(); // Don't crash the build stage if wasm-pack is missing, just warn
            } else {
              reject(err);
            }
          });

          child.on('close', (code) => {
            if (code === 0) resolvePromise();
            else {
              console.warn(`[R1] wasm-pack failed with code ${code}. Skipping WASM build.`);
              resolvePromise(); // Warn but proceed
            }
          });
        });
      }
    },

    transform(code, id) {
      if (!id.match(/\.(js|ts|jsx|tsx)$/)) return null;
      if (id.includes('node_modules')) return null;

      // Import map for Tauri API paths to R1 equivalents
      const importMap: Record<string, string> = {
        '@tauri-apps/api/core':         '@r1/apis/core',
        '@tauri-apps/api/tauri':        '@r1/apis/core',
        '@tauri-apps/api/fs':           '@r1/apis/fs',
        '@tauri-apps/api/path':         '@r1/apis/path',
        '@tauri-apps/api/event':        '@r1/apis/event',
        '@tauri-apps/api/window':       '@r1/apis/window',
        '@tauri-apps/api/dialog':       '@r1/apis/dialog',
        '@tauri-apps/api/clipboard':    '@r1/apis/clipboard',
        '@tauri-apps/api/notification': '@r1/apis/notification',
        '@tauri-apps/api/os':           '@r1/apis/os',
        '@tauri-apps/api/shell':        '@r1/apis/shell',
        '@tauri-apps/api/http':         '@r1/apis/http',
        '@tauri-apps/api/store':        '@r1/apis/store',
        '@tauri-apps/plugin-store':     '@r1/apis/store',
        '@tauri-apps/api':              '@r1/apis',
      };

      // Check if code contains any Tauri imports
      if (code.includes('@tauri-apps/api') || code.includes('@tauri-apps/plugin-store')) {
        let newCode = code;
        
        // Sort keys by length (longest first) to match sub-paths before bare imports
        const sortedKeys = Object.keys(importMap).sort((a, b) => b.length - a.length);
        
        for (const tauriPath of sortedKeys) {
          const r1Path = importMap[tauriPath];
          // Match both single and double quotes
          const regex = new RegExp(`(['"])${tauriPath.replace(/\//g, '\\/')}\\1`, 'g');
          newCode = newCode.replace(regex, `$1${r1Path}$1`);
        }
        
        return {
          code: newCode,
          map: null
        };
      }

      return null;
    },

    async transformIndexHtml(html: string) {
      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { type: 'module', src: '/r1-boot.js' },
            injectTo: 'head-prepend'
          }
        ]
      };
    },

    async generateBundle() {
      // 1. Bundle and emit the Service Worker
      const swEntry = options.swSrc || resolve(_dirname, '../../sw/src/index.ts');
      if (existsSync(swEntry)) {
        console.log(`[R1] Bundling Service Worker from ${swEntry}...`);
        const result = await esbuild.build({
          entryPoints: [swEntry],
          bundle: true,
          write: false,
          format: 'iife',
          minify: true,
          loader: { '.css': 'empty' },
        });

        this.emitFile({
          type: 'asset',
          fileName: 'r1-sw.js',
          source: result.outputFiles[0].text
        });
      }

      // 2. Bundle and emit the Kernel Worker (sw.js)
      const kernelEntry = resolve(_dirname, '../../kernel/src/kernel.worker.ts');
      if (existsSync(kernelEntry)) {
        console.log(`[R1] Bundling Kernel Worker from ${kernelEntry}...`);
        const result = await esbuild.build({
          entryPoints: [kernelEntry],
          bundle: true,
          write: false,
          format: 'iife',
          minify: true,
          loader: { '.css': 'empty' },
        });

        this.emitFile({
          type: 'asset',
          fileName: 'sw.js',
          source: result.outputFiles[0].text
        });
      }

      // 3. Bundle and emit the R1 Boot script (to avoid bare import errors)
      const wasmName = getWasmName();
      const bootScript = `
        import { R1Runtime } from '@r1/core';
        console.log('[R1] Booting Runtime...');
        const r1 = new R1Runtime();
        r1.boot({ 
          wasmPath: '/wasm/${wasmName}.js' 
        }).then(() => {
          console.log('[R1] Boot complete.');
          window.dispatchEvent(new Event('r1:ready'));
        });
      `;
      
      console.log('[R1] Bundling R1 Boot script...');
      const result = await esbuild.build({
        stdin: {
          contents: bootScript,
          resolveDir: process.cwd(),
          loader: 'ts'
        },
        bundle: true,
        write: false,
        format: 'esm',
        minify: true,
        loader: { '.css': 'empty' },
      });

      this.emitFile({
        type: 'asset',
        fileName: 'r1-boot.js',
        source: result.outputFiles[0].text
      });
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/r1-sw.js') {
          const swEntry = options.swSrc || resolve(_dirname, '../../sw/src/index.ts');
          if (existsSync(swEntry)) {
             const result = await esbuild.build({ 
               entryPoints: [swEntry], 
               bundle: true, 
               write: false, 
               format: 'iife',
               loader: { '.css': 'empty' }
             });
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Service-Worker-Allowed', '/');
            res.end(result.outputFiles![0].text);
            return;
          }
        }
        if (req.url === '/sw.js') {
          const kernelEntry = resolve(_dirname, '../../kernel/src/kernel.worker.ts');
          if (existsSync(kernelEntry)) {
             const result = await esbuild.build({ 
               entryPoints: [kernelEntry], 
               bundle: true, 
               write: false, 
               format: 'iife',
               loader: { '.css': 'empty' }
             });
            res.setHeader('Content-Type', 'application/javascript');
            res.end(result.outputFiles![0].text);
            return;
          }
        }
        if (req.url === '/r1-boot.js') {
          const wasmName = getWasmName();
          const bootScript = `
            import { R1Runtime } from '@r1/core';
            console.log('[R1] Booting Runtime...');
            const r1 = new R1Runtime();
            r1.boot({ 
              wasmPath: '/wasm/${wasmName}.js' 
            }).then(() => {
              console.log('[R1] Boot complete.');
              window.dispatchEvent(new Event('r1:ready'));
            });
          `;
          const result = await esbuild.build({
            stdin: {
              contents: bootScript,
              resolveDir: process.cwd(),
              loader: 'ts'
            },
            bundle: true,
            write: false,
            format: 'esm',
            loader: { '.css': 'empty' }
          });
          res.setHeader('Content-Type', 'application/javascript');
          res.end(result.outputFiles![0].text);
          return;
        }
        next();
      });
    }
  };
}
