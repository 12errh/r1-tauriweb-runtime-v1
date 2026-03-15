/// <reference lib="webworker" />

/**
 * R1 Asset Protocol Service Worker
 * Intercepts r1-asset:// requests and serves them from OPFS.
 */

const MIME_TYPES: Record<string, string> = {
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'webp': 'image/webp',
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'css': 'text/css',
  'js': 'application/javascript',
  'json': 'application/json',
  'html': 'text/html',
  'txt': 'text/plain',
  'wasm': 'application/wasm',
};

function getMimeType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function normalizePath(path: string): string {
  // r1-asset://foo/bar -> /foo/bar
  let p = path.replace(/\\/g, '/');
  if (!p.startsWith('/')) p = '/' + p;
  while (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

self.addEventListener('install', (event: any) => {
  event.waitUntil((self as any).skipWaiting());
});

self.addEventListener('activate', (event: any) => {
  event.waitUntil((self as any).clients.claim());
});

self.addEventListener('fetch', (event: any) => {
  const url = new URL(event.request.url);
  
  // Intercept r1-asset:// or /r1-asset/ prefix depending on how it's used
  // Browser might convert r1-asset:// to http://current-origin/r1-asset/
  if (url.origin === self.location.origin && url.pathname.startsWith('/r1-asset/')) {
    event.respondWith(handleAssetRequest(url.pathname.replace('/r1-asset/', '/')));
  } else if (url.protocol === 'r1-asset:') {
    event.respondWith(handleAssetRequest(url.pathname));
  }
});

async function handleAssetRequest(path: string): Promise<Response> {
  const normalized = normalizePath(path);
  
  try {
    const root = await navigator.storage.getDirectory();
    const parts = normalized.split('/').filter(Boolean);
    let currentDir = root;
    
    // Walk the directory handle tree
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i]);
    }
    
    const filename = parts[parts.length - 1];
    const fileHandle = await currentDir.getFileHandle(filename);
    const file = await fileHandle.getFile();
    
    return new Response(file, {
      status: 200,
      headers: {
        'Content-Type': getMimeType(normalized),
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e) {
    console.error(`[R1 SW] Failed to serve asset ${normalized}:`, e);
    return new Response(`Asset not found: ${normalized}`, { status: 404 });
  }
}

export {};
