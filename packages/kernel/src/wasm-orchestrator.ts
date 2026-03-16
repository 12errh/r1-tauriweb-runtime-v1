import { VFS } from './vfs';
import { WasiShim } from './wasi-shim';
import type { Router } from './router';

interface WasmModule {
  instance?: WebAssembly.Instance;
  exports: any;
  wasi?: WasiShim;
}

/**
 * WasmOrchestrator runs exclusively inside the Kernel Web Worker.
 * It is responsible for fetching, evaluating, holding, and gracefully proxying 
 * executions into `.wasm` modules deployed via the Module Registry mapping.
 */
export class WasmOrchestrator {
  private modules: Map<string, WasmModule> = new Map();
  private vfs: VFS;
  private router: Router;
  private onEvent: (event: string, payload: any) => void;

  constructor(vfs: VFS, router: Router, onEvent: (event: string, payload: any) => void) {
    this.vfs = vfs;
    this.router = router;
    this.onEvent = onEvent;
  }

  private readString(memory: WebAssembly.Memory, ptr: number, len: number): string {
    const buffer = new Uint8Array(memory.buffer, ptr, len);
    return new TextDecoder().decode(buffer);
  }

  /**
   * Instantiates a WASM module and caches it in memory under `name`.
   * Unloads any currently mapped instance holding that `name`.
   * @param name - Module identifier string mapping (e.g. 'my-app')
   * @param url - URL to either raw `.wasm` (Phase 4) or `.js` glue (Phase 5)
   */
  async loadModule(name: string, url: string): Promise<void> {
    if (this.modules.has(name)) {
      this.unloadModule(name);
    }

    try {
      const wasi = new WasiShim(this.vfs);
      
      const createEnv = (instanceGetter: () => WebAssembly.Instance | undefined) => ({
        r1_emit: (namePtr: number, nameLen: number, payloadPtr: number, payloadLen: number) => {
          const instance = instanceGetter();
          if (!instance) return;
          const memory = instance.exports.memory as WebAssembly.Memory;
          const eventName = this.readString(memory, namePtr, nameLen);
          const payloadString = this.readString(memory, payloadPtr, payloadLen);
          
          let payload;
          try {
            payload = JSON.parse(payloadString);
          } catch {
            payload = payloadString;
          }
          this.onEvent(eventName, payload);
        }
      });

      if (url.endsWith('.js')) {
        // Phase 5: Advanced `wasm-bindgen` JS glue module
        const jsModule = await import(/* @vite-ignore */ url);
        
        const wasmUrl = url.replace('.js', '_bg.wasm');
        const response = await fetch(wasmUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${wasmUrl}`);
        const buffer = await response.arrayBuffer();

        // For wasm-bindgen, we might need to satisfy its imports.
        // Usually, wasm-bindgen's load script handles imports.
        // But if we want to inject OUR imports into it, we might need to wrap the instantiation.
        // However, standard wasm-bindgen (target web) doesn't use extern "C" imports directly easily 
        // without some glue. 
        // For Phase 7, we'll focus on the raw WASM case and assume wasm-bindgen can use it too 
        // if we merge the import objects.
        
        let instanceRef: WebAssembly.Instance | undefined;
        
        const r1Imports = {
            ...wasi.getImports(),
            env: createEnv(() => instanceRef)
        };

        // wasm-bindgen init returns the exports object.
        // Importantly, we must call it to initialize the module's internal `wasm` variable.
        const wasmExports = await jsModule.default(buffer, r1Imports);
        instanceRef = { exports: wasmExports } as WebAssembly.Instance;

        if (wasmExports.memory instanceof WebAssembly.Memory) {
            wasi.setMemory(wasmExports.memory);
        }

        // We store the jsModule as 'exports' because we want to call the WRAPPER functions (like echo_object),
        // not the raw wasm functions (like wasm.echo_object).
        this.modules.set(name, { exports: jsModule, wasi, instance: instanceRef });
        this.registerModuleCommands(name, jsModule);

      } else {
        // Phase 4 & 6: Raw WASI compilation payloads
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);

        const buffer = await response.arrayBuffer();
        
        // First, compile the module to inspect its imports
        const module = await WebAssembly.compile(buffer);
        const imports = WebAssembly.Module.imports(module);
        
        let instanceRef: WebAssembly.Instance | undefined;
        
        // Create import object with all necessary imports
        const importObject: any = {
            ...wasi.getImports(),
            env: createEnv(() => instanceRef)
        };
        
        // Add wasm-bindgen imports dynamically based on what the module needs
        for (const imp of imports) {
          if (imp.module.endsWith('_bg.js') || imp.module.startsWith('./')) {
            // Ensure the module object exists
            if (!importObject[imp.module]) {
              importObject[imp.module] = {};
            }
            
            // Provide stub implementations based on import kind
            if (imp.kind === 'function') {
              if (imp.name.startsWith('__wbindgen_')) {
                importObject[imp.module][imp.name] = (...args: any[]) => {
                  if (imp.name === '__wbindgen_throw') {
                    throw new Error('WASM panic');
                  }
                  return 0;
                };
              } else if (imp.name.startsWith('__wbg_')) {
                importObject[imp.module][imp.name] = (...args: any[]) => {
                  console.log(`[WASM] Called ${imp.name}`);
                  return 0;
                };
              } else {
                importObject[imp.module][imp.name] = (...args: any[]) => {
                  console.log(`[WASM] Called ${imp.module}.${imp.name}`);
                  return 0;
                };
              }
            }
          }
        }

        const result = await WebAssembly.instantiate(module, importObject);

        const instance = result;
        instanceRef = instance;

        if (instance.exports.memory instanceof WebAssembly.Memory) {
            wasi.setMemory(instance.exports.memory);
        }

        this.modules.set(name, {
          instance: instance,
          exports: instance.exports,
          wasi
        });

        // Call __wbindgen_start if it exists (initializes wasm-bindgen runtime)
        if (instance.exports.__wbindgen_start) {
          (instance.exports.__wbindgen_start as Function)();
        }

        this.registerModuleCommands(name, instance.exports);
      }
    } catch (error) {
       throw new Error(`[WasmOrchestrator] Failed to load module '${name}': ${(error as Error).message}`);
    }
  }

  /**
   * Auto-discovers exported functions and registers them in the kernel router.
   */
  private registerModuleCommands(moduleName: string, exports: any) {
    // Module namespace objects might not work well with Object.entries in some environments
    const keys = Object.keys(exports).concat(Object.getOwnPropertyNames(exports));
    const uniqueKeys = Array.from(new Set(keys));
    
    for (const fnName of uniqueKeys) {
      const func = exports[fnName];
      if (typeof func === 'function' && !fnName.startsWith('__') && fnName !== 'default') {
        const fullCmdName = `${moduleName}:${fnName}`;
        console.log(`[WasmOrchestrator] Registering command: ${fullCmdName}`);
        this.router.register(fullCmdName, async (payload: any) => {
          const args = Array.isArray(payload) ? payload : [payload];
          return this.callFunction(moduleName, fnName, args);
        });
      }
    }
  }

  /**
   * Evaluates an exported WebAssembly function and wraps panics cleanly.
   * If invoking using complex JS Objects, the Serde JSON contract automatically translates strings seamlessly.
   */
  callFunction(moduleName: string, fnName: string, args: unknown[] = []): any {
    const wasm = this.modules.get(moduleName);
    if (!wasm) throw new Error(`[WasmOrchestrator] Module '${moduleName}' is not loaded.`);

    const func = wasm.exports[fnName];
    if (typeof func !== 'function') throw new Error(`[WasmOrchestrator] Function '${fnName}' not exported by '${moduleName}'.`);

    try {
      // For wasm-bindgen functions, the first argument is a string and the return is a pointer pair
      if (args.length === 1 && typeof args[0] === 'object' && !Array.isArray(args[0]) && args[0] !== null) {
        const jsonString = JSON.stringify(args[0]);
        
        // Check if this is a wasm-bindgen module (has __wbindgen_malloc)
        const isWasmBindgen = '__wbindgen_malloc' in wasm.exports;
        
        console.log('[WasmOrchestrator] Calling function:', fnName);
        console.log('[WasmOrchestrator] Is wasm-bindgen:', isWasmBindgen);
        
        if (isWasmBindgen) {
          // wasm-bindgen string handling
          
          // 1. Allocate memory for the input string
          const encoder = new TextEncoder();
          const encoded = encoder.encode(jsonString);
          
          // Allocate memory in WASM
          const malloc = wasm.exports.__wbindgen_malloc as Function;
          const ptr = malloc(encoded.length, 1);
          
          // Write string to WASM memory
          const memory = wasm.exports.memory as WebAssembly.Memory;
          const memoryArray = new Uint8Array(memory.buffer);
          memoryArray.set(encoded, ptr);
          
          // Call the function with pointer and length
          const result = (func as Function)(ptr, encoded.length);
          
          // wasm-bindgen returns [ptr, len] directly as a multi-value return
          let resultPtr: number;
          let resultLen: number;
          
          if (Array.isArray(result)) {
            // Multi-value return: [ptr, len]
            [resultPtr, resultLen] = result;
          } else {
            // Single value return: pointer to [ptr, len] pair
            const dataView = new DataView(memory.buffer);
            resultPtr = dataView.getUint32(result, true);
            resultLen = dataView.getUint32(result + 4, true);
          }
          
          const resultBytes = new Uint8Array(memory.buffer, resultPtr, resultLen);
          const resultString = new TextDecoder().decode(resultBytes);
          
          // Free the input memory
          const free = wasm.exports.__wbindgen_free as Function;
          free(ptr, encoded.length, 1);
          
          // Parse the result - the Rust function already returns a JSON string
          let parsed;
          try {
            parsed = JSON.parse(resultString);
          } catch (e) {
            // If it's not JSON, return the string as-is
            return resultString;
          }

          // If parsed is a string, it's the final result (already unwrapped by Rust)
          if (typeof parsed === 'string') {
            return parsed;
          }

          // If it's an object, check for error/ok pattern
          if (parsed.error !== undefined) {
            throw new Error(parsed.error);
          }
          
          return parsed.ok !== undefined ? parsed.ok : parsed;
        } else {
          // Non-wasm-bindgen: original JSON contract
          console.log('[WasmOrchestrator] Using non-wasm-bindgen path');
          const response = (func as Function)(jsonString);
          
          if (typeof response === 'string') {
            let parsed;
            try {
              parsed = JSON.parse(response);
            } catch (e) {
              // If it's a raw string, return it
              return response;
            }

            if (parsed.error !== undefined) {
              throw new Error(parsed.error);
            }
            
            return parsed.ok !== undefined ? parsed.ok : parsed;
          }
          
          return response;
        }
      }

      // Raw array / primitives evaluation mapping (Phase 4)
      return (func as Function)(...args);
    } catch (e) {
      // WASM trap errors surface into Javascript here perfectly. 
      // Wrapping this cleanly means the entire Kernel thread doesn't destruct wildly.
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`[WasmOrchestrator] WASM Panic in ${moduleName}::${fnName}: ${msg}`);
    }
  }

  /**
   * Dropping references allows the V8 garbage collector to evict WebAssembly memory.
   */
  unloadModule(name: string): void {
    if (!this.modules.has(name)) {
      console.warn(`[WasmOrchestrator] unloadModule called for unknown module '${name}'`);
      return;
    }
    this.modules.delete(name);
  }
}
