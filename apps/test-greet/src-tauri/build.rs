fn main() {
    // Skip tauri build when compiling for WASM
    let target = std::env::var("TARGET").unwrap_or_default();
    if target.contains("wasm32") {
        return;
    }

    #[cfg(not(target_arch = "wasm32"))]
    tauri_build::build()
}
