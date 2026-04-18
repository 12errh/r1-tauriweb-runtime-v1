# Contributing to R1 TauriWeb Runtime

R1 is at v0.3 (Phase 4 complete) and the most valuable thing you can do right now is **test it with your own Tauri app** and report what breaks. v0.3 added SQLite support, automatic migration via `npx r1 sync` CLI, and comprehensive WASI shim implementation.

That said, all contributions are welcome — bug fixes, new API implementations, WASI shim additions, and documentation improvements.

---

## The Most Useful Thing You Can Do Right Now

Take a simple Tauri app — yours or an open source one — and try to run it through R1. Then open an issue describing:

- Which app you tried
- What broke and at what step
- The exact error message from the browser console or build output

This is how the gaps get found. A detailed bug report is more valuable than a PR at this stage.

---

## Getting the Code Running

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/r1-tauriweb-runtime-v1.git
cd r1-tauriweb-runtime-v1

# 2. Install dependencies
npm install

# 3. Build all packages
npm run build

# 4. Run the test suite — all 63 should pass
npm test

# 5. Start the demo app to verify everything works
cd apps/todo-demo
npm run dev
```

---

## Where to Contribute

These are the areas most likely to have impact right now:

### WASI Shim (`packages/kernel/src/wasi-shim.ts`)
The shim covers the most common syscalls but not all of them. If you run an app that hits an unimplemented syscall, adding it here is well-scoped work. Every syscall function has the same shape — look at the existing implementations as a template.

### API Plugins (`packages/apis/src/`)
Each Tauri API is a plugin class. If a command returns wrong data or is missing entirely, this is the right file to edit. Each plugin has a `getCommands()` method that returns a map of command names to handler functions.

### VFS (`packages/kernel/src/vfs.ts`)
Edge cases around path handling, large files, and directory operations. If you find a bug with file persistence or paths, this is where it lives.

### Documentation
If a step in any guide is unclear or wrong, fixing it is a real contribution. The docs live in the markdown files at the repo root.

---

## Submitting a Pull Request

1. Create a branch from `main` with a descriptive name:
   ```bash
   git checkout -b fix/wasi-fd-seek-offset
   git checkout -b feat/clipboard-read-image
   ```

2. Make your changes. If you added a feature or fixed a bug, add a test in the relevant `*.test.ts` file.

3. Make sure the test suite still passes:
   ```bash
   npm test
   ```

4. Make sure TypeScript compiles without errors:
   ```bash
   npm run build
   ```

5. Open a pull request against `main`. In the description, explain:
   - What problem this solves
   - How you tested it
   - Any known limitations or edge cases

---

## Reporting Bugs

Open an issue on GitHub. A good bug report includes:

**What you were trying to do** — one sentence is fine.

**Steps to reproduce** — the exact commands or code that triggers the bug.

**What you expected** — what should have happened.

**What actually happened** — the exact error message, including the full browser console output or terminal output if relevant.

**Environment** — browser name and version, OS, Node.js version, Rust version.

The more specific you are, the faster it gets fixed.

---

## Code Style

- TypeScript strict mode is enabled — no `any` types without a comment explaining why
- All public functions need a JSDoc comment
- Every new feature needs at least one test in Vitest
- Keep packages independent — `@r1/kernel` must never import from `@r1/core`, and `@r1/core` must never import from `@r1/apis`

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License that covers this project.