import { KernelPlugin, KernelHandler } from '@r1/kernel';

// ─── Helpers ────────────────────────────────────────────────────────────────

function posixJoin(...parts: string[]): string {
  return parts
    .join('/')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/';
}

function posixNormalize(path: string): string {
  const parts = path.split('/');
  const result: string[] = [];
  for (const p of parts) {
    if (p === '..') result.pop();
    else if (p !== '.') result.push(p);
  }
  return result.join('/') || '/';
}

// ─── VFS "special directory" roots ──────────────────────────────────────────
// In the browser there is no real OS filesystem.
// We map every Tauri special directory to a sensible VFS path.

const VFS_DIRS: Record<string, string> = {
  home: '/home/user',
  app: '/app',
  appData: '/app/data',
  appConfig: '/app/config',
  appLog: '/app/logs',
  appCache: '/app/cache',
  appLocalData: '/app/local',
  desktop: '/home/user/Desktop',
  document: '/home/user/Documents',
  download: '/home/user/Downloads',
  picture: '/home/user/Pictures',
  video: '/home/user/Videos',
  audio: '/home/user/Music',
  temp: '/tmp',
  resource: '/app/resources',
  runtime: '/tmp/runtime',
};

// ─── Plugin ──────────────────────────────────────────────────────────────────

export class PathPlugin implements KernelPlugin {
  name = 'path';

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    // ── Manipulation ──────────────────────────────────────────────────────

    commands.set('join', async (payload: { paths: string[] }) => {
      return posixJoin(...payload.paths);
    });

    commands.set('resolve', async (payload: { pathSegments: string[] }) => {
      const joined = posixJoin(...payload.pathSegments);
      return posixNormalize(joined);
    });

    commands.set('normalize', async (payload: { path: string }) => {
      return posixNormalize(payload.path);
    });

    commands.set('basename', async (payload: { path: string; ext?: string }) => {
      let base = payload.path.split('/').pop() || '';
      if (payload.ext && base.endsWith(payload.ext)) {
        base = base.slice(0, -payload.ext.length);
      }
      return base;
    });

    commands.set('dirname', async (payload: { path: string }) => {
      const parts = payload.path.split('/');
      parts.pop();
      return parts.join('/') || '/';
    });

    commands.set('extname', async (payload: { path: string }) => {
      const base = payload.path.split('/').pop() || '';
      const dot = base.lastIndexOf('.');
      return dot > 0 ? base.slice(dot) : '';
    });

    commands.set('isAbsolute', async (payload: { path: string }) => {
      return payload.path.startsWith('/');
    });

    // ── Special directories ───────────────────────────────────────────────

    for (const [key, vfsPath] of Object.entries(VFS_DIRS)) {
      commands.set(`${key}Dir`, async () => vfsPath);
    }

    // Aliases Tauri uses
    commands.set('sep', async () => '/');
    commands.set('delimiter', async () => ':');

    return commands;
  }
}

// ─── Direct JS exports (used by @tauri-apps/api/path imports) ────────────────
// When a developer writes:
//   import { homeDir, resolve } from '@tauri-apps/api/path'
// The Vite plugin rewrites it to @r1/apis/path.
// These named exports must exist here so the import resolves correctly.

export const homeDir = () => Promise.resolve(VFS_DIRS.home);
export const appDir = () => Promise.resolve(VFS_DIRS.app);
export const appDataDir = () => Promise.resolve(VFS_DIRS.appData);
export const appConfigDir = () => Promise.resolve(VFS_DIRS.appConfig);
export const appLogDir = () => Promise.resolve(VFS_DIRS.appLog);
export const appCacheDir = () => Promise.resolve(VFS_DIRS.appCache);
export const appLocalDataDir = () => Promise.resolve(VFS_DIRS.appLocalData);
export const desktopDir = () => Promise.resolve(VFS_DIRS.desktop);
export const documentDir = () => Promise.resolve(VFS_DIRS.document);
export const downloadDir = () => Promise.resolve(VFS_DIRS.download);
export const pictureDir = () => Promise.resolve(VFS_DIRS.picture);
export const videoDir = () => Promise.resolve(VFS_DIRS.video);
export const audioDir = () => Promise.resolve(VFS_DIRS.audio);
export const tempDir = () => Promise.resolve(VFS_DIRS.temp);
export const resourceDir = () => Promise.resolve(VFS_DIRS.resource);

export const resolve = (...paths: string[]) =>
  Promise.resolve(posixNormalize(posixJoin(...paths)));

export const normalize = (path: string) =>
  Promise.resolve(posixNormalize(path));

export const join = (...paths: string[]) =>
  Promise.resolve(posixJoin(...paths));

export const basename = (path: string, ext?: string) => {
  let base = path.split('/').pop() || '';
  if (ext && base.endsWith(ext)) base = base.slice(0, -ext.length);
  return Promise.resolve(base);
};

export const dirname = (path: string) => {
  const parts = path.split('/');
  parts.pop();
  return Promise.resolve(parts.join('/') || '/');
};

export const extname = (path: string) => {
  const base = path.split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  return Promise.resolve(dot > 0 ? base.slice(dot) : '');
};

export const isAbsolute = (path: string) =>
  Promise.resolve(path.startsWith('/'));

export const sep = '/';
export const delimiter = ':';