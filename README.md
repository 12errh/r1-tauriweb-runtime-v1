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

This project is now **100% Functional** through Phase 10. Every core pillar of a Tauri-compatible web runtime is in place and verified.

- **Phase 0:** Setup strict Typescript Monorepo foundations and test suites.
- **Phase 1-2:** Deployed the Kernel Worker JSON Protocol and bridged Global Tauri APIs (`invoke`, `listen`, `emit`).
- **Phase 3:** Built a persistent **Virtual File System (VFS)** on top of OPFS. Data survives browser refreshes.
- **Phase 4-7:** Shipped **WasmOrchestrator** with a full **WASI Shim** and **Event Bridge**. Rust `std::fs` and `app_handle.emit` work out of the box.
- **Phase 8:** Implemented **Tauri APIs Tier 1 & 2** (Fs, Event, Dialog, Os, Clipboard, Store).
- **Phase 9:** Launched the **Virtual Window Manager** with premium OS-themed chrome (macOS, Windows 11, Linux).
- **Phase 10:** Implemented the **Asset Interception Protocol** (`r1-asset://`) for loading VFS assets directly into the DOM via Service Worker.

## 🗺 Roadmap

We are currently heading into the final polishing phase:

- [ ] **Phase 11:** Finalize the **Vite Plugin** for automated one-line developer integration.
- [ ] **Phase 12:** Performance profiling and mobile responsiveness audit.
- [ ] **Phase 13:** Public beta release and template gallery.

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
