use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    // This tells wasm-bindgen to expect a global JS function called `__R1_EMIT__`
    #[wasm_bindgen(js_namespace = globalThis, js_name = __R1_EMIT__)]
    fn r1_emit_internal(name: &str, payload: &str);
}

/// Emits an event to the R1 Host (JavaScript).
/// 
/// # Example
/// ```
/// r1::emit("download-progress", r#"{"percent": 75}"#);
/// ```
pub fn emit(event: &str, payload: &str) {
    r1_emit_internal(event, payload);
}
