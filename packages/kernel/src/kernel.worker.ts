import { Router } from './router';
import { VFS } from './vfs';
import { WasmOrchestrator } from './wasm-orchestrator';
import type { KernelRequest } from './protocol';
import {
  FsPlugin,
  EventPlugin,
  CorePlugin,
  StorePlugin,
  OsPlugin,
  HttpPlugin,
  PathPlugin,
  MainBridgePlugin,
  WindowPlugin
} from '@r1/apis';

const router = new Router();
const vfs = new VFS();

/** Matches MAIN_THREAD_RESPONSE back to calls */
const pendingMainCalls = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();

async function onMainThreadCall(api: string, method: string, args: any): Promise<any> {
  const id = Math.random().toString(36).substring(2, 15);
  return new Promise((resolve, reject) => {
    pendingMainCalls.set(id, { resolve, reject });
    self.postMessage({ type: 'MAIN_THREAD_CALL', id, payload: { api, method, args } });
  });
}

const wasmOrchestrator = new WasmOrchestrator(vfs, router, (event, payload) => {
  self.postMessage({ type: 'EVENT_EMIT', payload: { event, payload } });
});

// Modular Architecture: Plug in standard Tauri APIs
router.use(new FsPlugin(vfs));
router.use(new CorePlugin());
router.use(new StorePlugin(vfs));
router.use(new OsPlugin(onMainThreadCall));
router.use(new HttpPlugin());
router.use(new PathPlugin());
router.use(new WindowPlugin(onMainThreadCall));

// Main Thread Bridged APIs
router.use(new MainBridgePlugin('dialog', onMainThreadCall));
router.use(new MainBridgePlugin('clipboard', onMainThreadCall));
router.use(new MainBridgePlugin('notification', onMainThreadCall));
router.use(new MainBridgePlugin('shell', onMainThreadCall));

router.use(new EventPlugin((event, payload) => {
  self.postMessage({ type: 'EVENT_EMIT', payload: { event, payload } });
}));

// Ensure VFS is initialised strictly before it handles anything
// In Phase 8, this will be part of a proper Boot sequence
let vfsReady = vfs.init();

// 1.5 - PING handler as the first smoke test
router.register('PING', async () => ({ pong: true, ts: Date.now() }));

// 2.5 - IPC_INVOKE handler: Now routes to the hierarchical plugin:command
router.register('IPC_INVOKE', async (payload: any) => {
  const { command, args } = payload;

  // 1. Try routing via plugins first
  const response = await router.handle({ id: 'internal', type: command, payload: args });
  if (!response.error) return response.payload;

  // 2. Fallback: Check if it's a WASM command (mapped as module:fn)
  // or just attempt  // 2. Fallback: Check if it's a WASM command (mapped as module:fn)
  try {
    // If command has no colon, assume 'main:' prefix for the primary app WASM
    const finalCmd = command.includes(':') ? command : `main:${command}`;
    const [module, fn] = finalCmd.split(':');

    // Wrap args in an array if it's not one, as callFunction expects positional args
    const wasmArgs = Array.isArray(args) ? args : [args];
    return await wasmOrchestrator.callFunction(module, fn, wasmArgs);
  } catch (e) {
    // If it was a wasm-specific error, throw that. Otherwise fallback to the router error.
    const wasmError = (e as Error).message;
    if (wasmError.includes('[WasmOrchestrator]')) {
      throw e;
    }
    throw new Error(response.error || wasmError);
  }
});

// 3.6 - VFS Routing Endpoints
router.register('VFS_READ', async ({ path }) => {
  await vfsReady;
  const data = vfs.read(path);
  // Must convert Uint8Array back to numeric array for JSON serialization across postMessage
  return { data: Array.from(data) };
});

router.register('VFS_WRITE', async ({ path, data }) => {
  await vfsReady;
  // Convert standard numeric array back to Uint8Array for the fs
  await vfs.write(path, new Uint8Array(data));
  return {};
});

router.register('VFS_DELETE', async ({ path }) => {
  await vfsReady;
  await vfs.delete(path);
  return {};
});

router.register('VFS_EXISTS', async ({ path }) => {
  await vfsReady;
  const exists = vfs.exists(path);
  return { exists };
});

router.register('VFS_LIST', async ({ dir }) => {
  await vfsReady;
  const ObjectPaths = vfs.list(dir);
  return { paths: ObjectPaths };
});

// 4.6 - WasmOrchestrator Routing Endpoints
router.register('WASM_LOAD', async ({ name, url }) => {
  await wasmOrchestrator.loadModule(name, url);
  return {};
});

router.register('WASM_CALL', async ({ module, fn, args }) => {
  const result = await wasmOrchestrator.callFunction(module, fn, args);
  return { result };
});

router.register('WASM_UNLOAD', async ({ name }) => {
  wasmOrchestrator.unloadModule(name);
  return {};
});

// Receive message from main thread, route it, and post response back
self.onmessage = async (event: MessageEvent<KernelRequest | { type: string, id: string, payload: any, error?: string }>) => {
  const data = event.data;
  if (!data || !data.id || typeof data.type !== 'string') {
    return;
  }

  // Handle responses from the main thread (for MAIN_THREAD_CALL)
  if (data.type === 'MAIN_THREAD_RESPONSE') {
    const response = data as { id: string, payload: any, error?: string };
    const pending = pendingMainCalls.get(response.id);
    if (pending) {
      pendingMainCalls.delete(response.id);
      if (response.error) pending.reject(new Error(response.error));
      else pending.resolve(response.payload);
    }
    return;
  }

  // Ensure VFS is ready before handling any FS-related command
  await vfsReady;

  const response = await router.handle(data as KernelRequest);
  self.postMessage(response);
};

// Catch unhandled errors gracefully so the worker doesn't silently die
self.onerror = (messageOrEvent) => {
  const msg = messageOrEvent instanceof ErrorEvent ? messageOrEvent.message : String(messageOrEvent);
  console.error('[R1 Kernel] Unhandled error in worker:', msg);
};

self.onmessageerror = (event: MessageEvent) => {
  console.error('[R1 Kernel] Message deserialisation failed:', event);
};
