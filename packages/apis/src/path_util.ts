import { KernelPlugin, KernelHandler } from '@r1-runtime/kernel';

// --- Helpers ----------------------------------------------------------------

function posixJoin(...parts: string[]): string {
  return parts
    .filter(p => !!p)
    .join('/')
    .replace(/\/+/g, '/');
}

function posixNormalize(path: string): string {
  if (!path) return '.';
  const isAbsolute = path.startsWith('/');
  const trailingSlash = path.endsWith('/') && path !== '/';
  
  const parts = path.split('/');
  const result: string[] = [];
  
  for (const p of parts) {
    if (p === '..') {
      if (result.length > 0 && result[result.length - 1] !== '..') {
        result.pop();
      } else if (!isAbsolute) {
        result.push('..');
      }
    } else if (p !== '.' && p !== '') {
      result.push(p);
    }
  }
  
  let normalized = result.join('/');
  if (isAbsolute) normalized = '/' + normalized;
  if (normalized === '' && !isAbsolute) normalized = '.';
  if (trailingSlash && !normalized.endsWith('/')) normalized += '/';
  
  return normalized || '/';
}

function posixRelative(from: string, to: string): string {
  const fromParts = posixNormalize(from).split('/').filter(p => !!p);
  const toParts = posixNormalize(to).split('/').filter(p => !!p);
  
  let commonLength = 0;
  const minLength = Math.min(fromParts.length, toParts.length);
  
  for (let i = 0; i < minLength; i++) {
    if (fromParts[i] !== toParts[i]) break;
    commonLength++;
  }
  
  const upCount = fromParts.length - commonLength;
  const downParts = toParts.slice(commonLength);
  
  const result = [];
  for (let i = 0; i < upCount; i++) result.push('..');
  result.push(...downParts);
  
  return result.join('/') || '.';
}

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
  config: '/app/config',
  data: '/app/data',
  cache: '/app/cache',
  log: '/app/logs',
};

export class PathPlugin implements KernelPlugin {
  name = 'path';

  getCommands(): Map<string, KernelHandler> {
    const commands = new Map<string, KernelHandler>();

    commands.set('join', async (payload: { paths: string[] }) => {
      return posixJoin(...(payload.paths || []));
    });

    commands.set('resolve', async (payload: { pathSegments: string[] }) => {
      let resolved = '';
      for (const seg of (payload.pathSegments || [])) {
        if (!seg) continue;
        if (seg.startsWith('/')) resolved = seg;
        else resolved = posixJoin(resolved, seg);
      }
      return posixNormalize(resolved || '/');
    });

    commands.set('relative', async (payload: { from: string; to: string }) => {
      return posixRelative(payload.from || '/', payload.to || '/');
    });

    commands.set('normalize', async (payload: { path: string }) => {
      return posixNormalize(payload.path || '.');
    });

    commands.set('basename', async (payload: { path: string; ext?: string }) => {
      const path = payload.path || '';
      if (!path) return '';
      const p = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
      let base = p.split('/').pop() || '';
      if (payload.ext && base.endsWith(payload.ext)) {
        base = base.slice(0, -payload.ext.length);
      }
      return base;
    });

    commands.set('dirname', async (payload: { path: string }) => {
      if (!payload.path) return '/';
      const parts = payload.path.split('/');
      parts.pop();
      return parts.join('/') || '/';
    });

    commands.set('extname', async (payload: { path: string }) => {
      const path = payload.path || '';
      const base = path.split('/').pop() || '';
      const dot = base.lastIndexOf('.');
      return dot > 0 ? base.slice(dot) : '';
    });

    commands.set('isAbsolute', async (payload: { path: string }) => {
      const path = payload.path || '';
      return path.startsWith('/') || path.startsWith('\\');
    });

    for (const [key, vfsPath] of Object.entries(VFS_DIRS)) {
      commands.set(`${key}Dir`, async () => vfsPath);
    }

    commands.set('sep', async () => '/');
    commands.set('delimiter', async () => ':');

    return commands;
  }
}

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
export const runtimeDir = () => Promise.resolve(VFS_DIRS.runtime);
export const configDir = () => Promise.resolve(VFS_DIRS.config);
export const dataDir = () => Promise.resolve(VFS_DIRS.data);
export const cacheDir = () => Promise.resolve(VFS_DIRS.cache);
export const logDir = () => Promise.resolve(VFS_DIRS.log);

export const resolve = (...paths: string[]) => {
  let resolved = '';
  for (const seg of paths) {
    if (!seg) continue;
    if (seg.startsWith('/')) resolved = seg;
    else resolved = posixJoin(resolved, seg);
  }
  return Promise.resolve(posixNormalize(resolved || '/'));
};

export const normalize = (path: string) => Promise.resolve(posixNormalize(path || '.'));
export const join = (...paths: string[]) => Promise.resolve(posixJoin(...paths.filter(Boolean)));
export const relative = (from: string, to: string) => Promise.resolve(posixRelative(from || '/', to || '/'));

export const basename = (path: string, ext?: string) => {
  if (!path) return Promise.resolve('');
  const p = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
  let base = p.split('/').pop() || '';
  if (ext && base.endsWith(ext)) base = base.slice(0, -ext.length);
  return Promise.resolve(base);
};

export const dirname = (path: string) => {
  if (!path) return Promise.resolve('/');
  const parts = path.split('/');
  parts.pop();
  return Promise.resolve(parts.join('/') || '/');
};

export const extname = (path: string) => {
  if (!path) return Promise.resolve('');
  const base = path.split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  return Promise.resolve(dot > 0 ? base.slice(dot) : '');
};

export const isAbsolute = (path: string) => Promise.resolve(!!path && (path.startsWith('/') || path.startsWith('\\')));
export const sep = '/';
export const delimiter = ':';
