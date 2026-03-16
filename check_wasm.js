const fs = require('fs');

async function checkWasm(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const module = await WebAssembly.compile(buffer);
    const exports = WebAssembly.Module.exports(module);
    console.log(`Exports for ${filePath}:`);
    console.log(JSON.stringify(exports, null, 2));
    
    const imports = WebAssembly.Module.imports(module);
    console.log(`Imports for ${filePath}:`);
    console.log(JSON.stringify(imports, null, 2));
  } catch (e) {
    console.error(`Failed to check ${filePath}: ${e.message}`);
  }
}

const wasmPath = process.argv[2];
if (wasmPath) {
  checkWasm(wasmPath);
} else {
  console.log('Usage: node check_wasm.js <path_to_wasm>');
}
