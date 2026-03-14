interface WasmModule {
  instance: WebAssembly.Instance;
  exports: WebAssembly.Exports;
}

/**
 * WasmOrchestrator runs exclusively inside the Kernel Web Worker.
 * It is responsible for fetching, evaluating, holding, and gracefully proxying 
 * executions into `.wasm` modules deployed via the Module Registry mapping.
 */
export class WasmOrchestrator {
  private modules: Map<string, WasmModule> = new Map();

  /**
   * Instantiates a WASM module and caches it in memory under `name`.
   * Unloads any currently mapped instance holding that `name`.
   * @param name - Module identifier string mapping (e.g. 'my-app')
   * @param url - Relative or absolute URL asset mapping path to binary payload
   */
  async loadModule(name: string, url: string): Promise<void> {
    if (this.modules.has(name)) {
      this.unloadModule(name);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);

      // Future phases (e.g. WASI, Event Bridge) will inject host proxy functions into `importObject`.
      // For now, it evaluates purely mathematically without host-system hooks.
      const importObject = {};

      let result;
      // instantiateStreaming is heavily optimized by V8/SpiderMonkey if headers allow it.
      if (typeof WebAssembly.instantiateStreaming === 'function') {
        try {
          result = await WebAssembly.instantiateStreaming(response, importObject);
        } catch (e) {
          // Fallback if Content-Type was non-standard standard (e.g. inside test runners)
          const buffer = await response.arrayBuffer();
          result = await WebAssembly.instantiate(buffer, importObject);
        }
      } else {
        const buffer = await response.arrayBuffer();
        result = await WebAssembly.instantiate(buffer, importObject);
      }

      this.modules.set(name, {
        instance: result.instance,
        exports: result.instance.exports
      });

    } catch (error) {
       throw new Error(`[WasmOrchestrator] Failed to load module '${name}': ${(error as Error).message}`);
    }
  }

  /**
   * Evaluates an exported WebAssembly function and wraps panics cleanly.
   */
  callFunction(moduleName: string, fnName: string, args: unknown[] = []): any {
    const wasm = this.modules.get(moduleName);
    if (!wasm) throw new Error(`[WasmOrchestrator] Module '${moduleName}' is not loaded.`);

    const func = wasm.exports[fnName];
    if (typeof func !== 'function') throw new Error(`[WasmOrchestrator] Function '${fnName}' not exported by '${moduleName}'.`);

    try {
      // For basic numeric evaluations we can spread directly (Phase 4).
      // Arrays of numbers map 1:1 to i32/f32 function signatures in WebAssembly cleanly.
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
