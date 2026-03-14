# tests/fixtures/wasm/

This directory holds pre-compiled `.wasm` test binaries used by the Kernel Worker test suite.

## Rules

- **Never rebuild these in CI.** CI must always be reproducible and fast.
- **Compile locally** using `wasm-pack build --target web` then commit the output `.wasm` file.
- **Source** lives in `tests/fixtures/rust/<name>/`. The compiled output goes here.

## Contents (added per phase)

| File | Phase | Source |
|------|-------|--------|
| `test-module.wasm` | Phase 4 | `tests/fixtures/rust/test-module/` |

## Compiling a new fixture

```bash
# One-time tool install (if not already done)
cargo install wasm-pack

# From the repo root
wasm-pack build tests/fixtures/rust/test-module --target web --out-dir tests/fixtures/wasm
```
