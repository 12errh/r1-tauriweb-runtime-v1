# @r1-runtime/window

Virtual Window Manager for R1 — macOS, Windows 11, and Linux themed desktop environments.

## Features

- **OS Themes**: Authentic window chrome for macOS, Windows 11, and Linux
- **Window Controls**: Minimize, maximize, close buttons
- **Drag & Drop**: Move windows around the screen
- **Resize**: Resize windows from edges and corners
- **Multiple Windows**: Support for multiple app windows
- **Responsive**: Adapts to browser viewport

## Installation

```bash
npm install @r1-runtime/window
```

## Usage

```typescript
import { WindowManager } from '@r1-runtime/window';
import '@r1-runtime/window/style.css';

// Create window manager
const wm = new WindowManager({
  theme: 'macos', // 'macos' | 'windows11' | 'linux'
  container: document.body,
});

// Create a window
const win = wm.createWindow({
  title: 'My App',
  width: 800,
  height: 600,
  x: 100,
  y: 100,
  content: document.getElementById('app'),
});

// Window controls
win.minimize();
win.maximize();
win.restore();
win.close();

// Events
win.on('close', () => console.log('Window closed'));
win.on('focus', () => console.log('Window focused'));
win.on('resize', (size) => console.log('New size:', size));
```

## Themes

### macOS
- Traffic light buttons (red, yellow, green)
- Centered title
- Translucent title bar

### Windows 11
- Snap layouts on hover
- Rounded corners
- Modern flat design

### Linux (GNOME-style)
- Left-aligned controls
- Minimize, maximize, close buttons
- GTK-inspired styling

## API

### WindowManager

```typescript
interface WindowManagerOptions {
  theme: 'macos' | 'windows11' | 'linux';
  container: HTMLElement;
}

class WindowManager {
  constructor(options: WindowManagerOptions);
  createWindow(options: WindowOptions): Window;
  getWindows(): Window[];
  setTheme(theme: string): void;
}
```

### Window

```typescript
interface WindowOptions {
  title: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  content?: HTMLElement;
  resizable?: boolean;
  minimizable?: boolean;
  maximizable?: boolean;
  closable?: boolean;
}

class Window {
  minimize(): void;
  maximize(): void;
  restore(): void;
  close(): void;
  focus(): void;
  setTitle(title: string): void;
  setSize(width: number, height: number): void;
  setPosition(x: number, y: number): void;
  on(event: string, handler: Function): void;
}
```

## Events

- `close` - Window is closing
- `focus` - Window gained focus
- `blur` - Window lost focus
- `minimize` - Window minimized
- `maximize` - Window maximized
- `restore` - Window restored
- `resize` - Window resized
- `move` - Window moved

## Styling

Import the CSS file:

```typescript
import '@r1-runtime/window/style.css';
```

Or in your HTML:

```html
<link rel="stylesheet" href="node_modules/@r1-runtime/window/dist/style.css">
```

## Example

```typescript
import { WindowManager } from '@r1-runtime/window';
import '@r1-runtime/window/style.css';

const wm = new WindowManager({
  theme: 'macos',
  container: document.body,
});

const mainWindow = wm.createWindow({
  title: 'My Tauri App',
  width: 1024,
  height: 768,
  content: document.getElementById('root'),
});

mainWindow.on('close', () => {
  console.log('App closing...');
});
```

## License

MIT © 2026 R1 Runtime Team
