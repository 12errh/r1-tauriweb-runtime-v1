fn main() {
    let target_arch = std::env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    
    if target_arch == "wasm32" {
        // WASM-specific build: compile our custom VFS
        cc::Build::new()
            .file("src/wasm_vfs.c")
            .flag("-DSQLITE_OS_OTHER=1")
            .flag("-DSQLITE_OMIT_LOAD_EXTENSION=1")
            .flag("-DSQLITE_THREADSAFE=0")
            .compiler("C:\\LLVM\\bin\\clang.exe")
            .compile("wasm_vfs");
            
        println!("cargo:rerun-if-changed=src/wasm_vfs.c");
    } else {
        // Native build: run standard Tauri build
        // We use a conditional block to avoid compiling this when tauri-build is missing (WASM target)
        #[cfg(not(target_arch = "wasm32"))]
        {
            // This will only be reached on non-WASM targets where tauri-build is in dependencies
            extern crate tauri_build;
            tauri_build::build();
        }
    }
}
