<div align="center">
  <h1>🚀 R1 TauriWeb Runtime</h1>
  <p>Run native Tauri applications directly inside the browser. Zero servers. Zero installations. 100% WebAssembly.</p>
</div>

![License](https://img.shields.io/badge/license-MIT-blue)
![Tests](https://img.shields.io/badge/tests-passing-green)

---

## 📖 What is R1 TauriWeb Runtime?

R1 TauriWeb Runtime is a zero-server bridge that allows end-users to visit a URL and immediately execute a native **Tauri application** compiled completely to WebAssembly. The end-user doesn't need to download desktop installers, and developers don't need to run dedicated backend servers or adapt complex networking protocols to convert desktop apps to Web.

If your Tauri app uses `invoke`, `fs`, `event`, and `dialog`, it works out of the box in the browser!

### The Vision
- **Scale:** Deploy apps to static Vercel, Netlify, or GitHub Pages.
- **Isolate:** Move Rust execution completely off the main thread into a Background Kernel Web Worker so UI performance never hitches.
- **Persist:** Simulate native filesystems by wrapping OPFS (the browser's native Origin Private File System).

## 🏗 Structure & Architecture

R1 is built strictly around non-blocking multithreading. It acts as an "Operating System" inside the browser sandbox.

- **Main Thread (`@r1/core` & `@r1/window`)**: Bootloads the runtime. Intercepts Tauri IPC API calls and proxies them. Renders Virtual OS floating window canvases instead of native OS views.
- **Kernel Worker (`@r1/kernel`)**: A headless Web Worker acting as the Backend. It runs the WebAssembly engine (`WasmOrchestrator`), evaluates Rust bounds, and manages the Virtual File System mapped to the hard disk storage.
- **Service Worker (`@r1/sw`)**: Manages the `asset://` asset extraction protocol seamlessly serving static Frontend HTML/JS/CSS assets straight from the internal File System.

## ✅ Progress So Far

This project is actively being developed iteratively in strict phases. So far we have completed up to **Phase 4**:

- **Phase 0:** Setup strict Typescript Monorepo foundations and test suites.
- **Phase 1:** Deployed the Kernel Worker JSON Protocol mapping IPC routes across threading borders gracefully accounting for panic catchings.
- **Phase 2:** Successfully reverse-engineered and patched Global Tauri APIs (`window.__TAURI_INTERNALS__` and `window.__TAURI_IPC__`) to transparently bypass `invoke()` requests perfectly into our isolated Kernel layer.
- **Phase 3:** Built a fully persistent **Virtual File System (VFS)** operating inside the Kernel wrapper utilizing instant memory caching mirrored constantly to the asynchronous browser `OPFS` disk layer. Paths written literally survive browser refreshes identically to native OS storage.
- **Phase 4:** Shipped the **WasmOrchestrator** — The isolated Web Worker executable environment natively instantiating WebAssembly files dynamically against internal Module Registries and seamlessly throwing traps/panics directly out as readable Javascript Exceptions effortlessly.

## 🗺 Roadmap

We are currently heading into Phase 5:

- [ ] **Phase 5:** Systematized exact Serde JSON bridges so Rust backends can directly manipulate dynamically typed JavaScript Objects without generic unsafe memory boundary pointers via `serde`.
- [ ] **Phase 6:** Construct the WASI (WebAssembly System Interface) Shim translating C/Rust filesystem IO directly to our Phase 3 VFS.
- [ ] **Phase 7:** Publish the `r1-tauri-vite-plugin` to automatically adapt `src-tauri` folders into Web bindings seamlessly during `npm run build`.
- [ ] **Phase 8:** Event bridge and full Tauri API mappings (e.g., Dialogs, Notifications, Global Shortcuts mapping to Web standards bounds).

## 🛠 Usage & Development

### Local Dev Setup
```bash
# Clone repository
git clone https://github.com/12errh/r1-tauriweb-runtime-v1.git
cd r1-tauriweb-runtime-v1

# Install monorepo workspaces
npm install

# Run the live mock Demo application
npm run dev -w apps/demo 
```

### Running Tests
Currently, we run isolated specs utilizing the `happy-dom` node DOM-simulation environment.
```bash
npm test
```

## 🤝 Contributing
Open source contributions are extremely welcome! We are working hard to expand our WASI shims and system interface implementations. Please read `CONTRIBUTING.md` to understand our rules preventing WASM memory leaks and threading blocks.

## 📄 License
MIT License.
