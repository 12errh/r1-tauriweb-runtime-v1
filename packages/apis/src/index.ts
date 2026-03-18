// Plugin classes (used by kernel registration)
export { FsPlugin } from './fs';
export { PathPlugin } from './path_util';
export { EventPlugin } from './event';
export { CorePlugin } from './core';
export { StorePlugin } from './store';
export { OsPlugin } from './os';
export { HttpPlugin } from './http';
export { MainBridgePlugin } from './main_bridge';
export { WindowPlugin } from './window';

// Core invoke — the most commonly used export
export { invoke, transformCallback, convertFileSrc } from './core';

// Direct function exports (fs, path)
export * from './fs';
export * from './path_util';

// Event API
export * from './event';

// OS + clipboard
export * from './os';
export * from './clipboard';

// Store
export { Store, StorePlugin as StorePluginClass } from './store';

// Notification
export * from './notification';

// HTTP
export * from './http';

// Window API
export {
  appWindow,
  WebviewWindow,
} from './window';

// Dialog API — explicit exports to avoid conflict with shell.open
export {
  open as dialogOpen,
  save,
  message,
  ask,
  confirm,
  type OpenDialogOptions,
  type SaveDialogOptions,
  type MessageDialogOptions,
  type ConfirmDialogOptions,
} from './dialog';

// Shell API — explicit exports to avoid conflict with dialog.open
export {
  open as shellOpen,
  Command,
} from './shell';
