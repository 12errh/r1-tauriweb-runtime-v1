import { KernelPlugin, KernelHandler, VFS } from '@r1/kernel';

// ─── Plugin (handles invoke() calls) ─────────────────────────────────────────

export class FsPlugin implements KernelPlugin {
  name = 'fs';
  private vfs: VFS;

  constructor(vfs: VFS) {
    this.vfs = vfs;
  }

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    commands.set('read_text_file', async (payload: { path: string }) => {
      return this.vfs.readText(payload.path);
    });

    commands.set('write_text_file', async (payload: { path: string; contents: string }) => {
      await this.vfs.writeText(payload.path, payload.contents);
      return null;
    });

    commands.set('read_file', async (payload: { path: string }) => {
      const bytes = await this.vfs.read(payload.path);
      return Array.from(bytes);
    });

    commands.set('write_file', async (payload: { path: string; contents: number[] }) => {
      await this.vfs.write(payload.path, new Uint8Array(payload.contents));
      return null;
    });

    commands.set('exists', async (payload: { path: string }) => {
      return this.vfs.exists(payload.path);
    });

    commands.set('read_dir', async (payload: { path: string; recursive?: boolean }) => {
      const entries = await this.vfs.list(payload.path);
      return entries.map((p: string) => ({
        name: p.split('/').pop() || p,
        path: p,
        isDirectory: !p.includes('.'),
      }));
    });

    commands.set('create_dir', async (payload: { path: string; recursive?: boolean }) => {
      await this.vfs.mkdir(payload.path);
      return null;
    });

    commands.set('remove_file', async (payload: { path: string }) => {
      await this.vfs.delete(payload.path);
      return null;
    });

    commands.set('remove_dir', async (payload: { path: string }) => {
      await this.vfs.delete(payload.path);
      return null;
    });

    commands.set('rename', async (payload: { oldPath: string; newPath: string }) => {
      const data = await this.vfs.read(payload.oldPath);
      await this.vfs.write(payload.newPath, data);
      await this.vfs.delete(payload.oldPath);
      return null;
    });

    commands.set('copy_file', async (payload: { source: string; destination: string }) => {
      const data = await this.vfs.read(payload.source);
      await this.vfs.write(payload.destination, data);
      return null;
    });

    return commands;
  }
}

// ─── Direct JS exports ────────────────────────────────────────────────────────
// Tauri apps import these directly:
//   import { readDir, readTextFile } from '@tauri-apps/api/fs'
// The Vite plugin rewrites that import to @r1/apis/fs.
// These named exports must exist here so the import resolves.

let _vfs: VFS | null = null;
let _initPromise: Promise<VFS> | null = null;

async function getVfs(): Promise<VFS> {
  if (_vfs) return _vfs;
  if (!_initPromise) {
    _initPromise = (async () => {
      const instance = new VFS();
      await instance.init();
      _vfs = instance;
      return instance;
    })();
  }
  return _initPromise;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory?: boolean;
  children?: FileEntry[];
}

export async function readDir(
  path: string,
  _options?: { recursive?: boolean }
): Promise<FileEntry[]> {
  const vfs = await getVfs();
  const entries = await vfs.list(path);
  return entries.map((p: string) => ({
    name: p.split('/').pop() || p,
    path: p,
    isDirectory: !p.split('/').pop()?.includes('.'),
  }));
}

export async function readTextFile(
  path: string,
  _options?: object
): Promise<string> {
  const vfs = await getVfs();
  return vfs.readText(path);
}

export async function writeTextFile(
  path: string,
  contents: string,
  _options?: object
): Promise<void> {
  const vfs = await getVfs();
  return vfs.writeText(path, contents);
}

export async function readBinaryFile(
  path: string,
  _options?: object
): Promise<Uint8Array> {
  const vfs = await getVfs();
  return vfs.read(path);
}

export async function writeBinaryFile(
  path: string,
  contents: Uint8Array | number[],
  _options?: object
): Promise<void> {
  const vfs = await getVfs();
  const data = contents instanceof Uint8Array
    ? contents
    : new Uint8Array(contents);
  return vfs.write(path, data);
}

export async function exists(path: string): Promise<boolean> {
  const vfs = await getVfs();
  return vfs.exists(path);
}

export async function removeFile(
  path: string,
  _options?: object
): Promise<void> {
  const vfs = await getVfs();
  return vfs.delete(path);
}

export async function removeDir(
  path: string,
  _options?: object
): Promise<void> {
  const vfs = await getVfs();
  return vfs.delete(path);
}

export async function createDir(
  path: string,
  _options?: { recursive?: boolean }
): Promise<void> {
  const vfs = await getVfs();
  return vfs.mkdir(path);
}

export async function renameFile(
  oldPath: string,
  newPath: string
): Promise<void> {
  const vfs = await getVfs();
  const data = await vfs.read(oldPath);
  await vfs.write(newPath, data);
  await vfs.delete(oldPath);
}

export async function copyFile(
  source: string,
  destination: string
): Promise<void> {
  const vfs = await getVfs();
  const data = await vfs.read(source);
  await vfs.write(destination, data);
}