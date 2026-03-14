// Phase 4 Test Fixture
// Minimal Rust module that exports add() and multiply() directly to WebAssembly
// without any advanced glue code (no wasm-bindgen).

#[no_mangle]
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[no_mangle]
pub fn multiply(a: i32, b: i32) -> i32 {
    a * b
}

// A panic function to test the trap-catching logic in WasmOrchestrator
#[no_mangle]
pub fn force_panic() {
    panic!("Simulated Rust Panic");
}
