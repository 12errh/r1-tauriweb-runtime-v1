import { Router } from './router';
import { VFS } from './vfs';
import { WasmOrchestrator } from './wasm-orchestrator';
import type { KernelRequest } from './protocol';

const router = new Router();
const vfs = new VFS();
const wasmOrchestrator = new WasmOrchestrator(vfs);

// Ensure VFS is initialised strictly before it handles anything
// In Phase 8, this will be part of a proper Boot sequence
let vfsReady = vfs.init();

// 1.5 - PING handler as the first smoke test
router.register('PING', async () => ({ pong: true, ts: Date.now() }));

// 2.5 - IPC_INVOKE stub handler (will be replaced by full WASM router in Phase 8)
router.register('IPC_INVOKE', async (payload: any) => {
  return `[stub] called: ${payload.command}`;
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
self.onmessage = async (event: MessageEvent<KernelRequest>) => {
  const request = event.data;
  if (!request || !request.id || typeof request.type !== 'string') {
    console.error('[R1 Kernel] Received malformed message:', event.data);
    return;
  }
  
  const response = await router.handle(request);
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
