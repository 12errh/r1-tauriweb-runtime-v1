# R1 Debug Prompt

**Instructions for the user**: When your R1 app has errors, copy everything below the line, paste it to your AI agent, and add your error output at the bottom.

---

## PROMPT — Debug My R1 App

```
You are debugging a Tauri application running on the R1 TauriWeb Runtime.

Before doing anything, read the skill file at:
PROMTS AND SKILL/R1_SKILL.md

The skill file has a "Common Error Patterns and Fixes" section — check that
section first. The error may already be documented there with a known fix.

MY ERROR OUTPUT:
[USER: PASTE YOUR ERROR HERE — either the npm run build output OR
the browser console output. Include the full error, not just one line.]

STEP 1 — CLASSIFY THE ERROR
Look at the error and determine which category it falls into:

A) Build-time error (appears during npm run build)
   - TypeScript errors
   - Missing exports
   - Rust compile errors
   - wasm-pack failures

B) Runtime error (appears in browser console after serving)
   - VFS not initialized
   - WebAssembly.instantiate() failed
   - R1 boot sequence errors
   - App logic errors after boot

C) Blank screen with no errors
   - R1 boot script not injected
   - Service Worker not registered
   - App-level crash before render

STEP 2 — IDENTIFY THE ROOT CAUSE
For each error message, tell me:
1. Which file is causing it
2. Why it's happening (not just what it is)
3. Whether it's an R1 problem or the app's own problem

STEP 3 — APPLY THE FIX
Apply the fix. Then tell me:
1. Exactly what you changed
2. Which file you changed it in
3. Whether R1 packages need to be rebuilt first

STEP 4 — VERIFY THE FIX
After fixing, tell me the exact commands to run to verify:
- If it was a build error: run npm run build and show expected output
- If it was a runtime error: show what the browser console should show after fix
- If it was a blank screen: show what the network tab should show

REBUILD ORDER — always follow this:
If you changed any R1 package file (packages/apis/, packages/core/, packages/kernel/, packages/vite-plugin/):
  1. cd r1-tauriweb-runtime-v1 && npm run build
  2. cd apps/your-app && npm run build
If you only changed the app's own files:
  1. cd apps/your-app && npm run build

IMPORTANT: Do not change any frontend @tauri-apps/api import statements.
The Vite plugin handles rewriting them. If an import is missing from R1's
API layer, the fix goes in packages/apis/ — not in the app's frontend code.
```
