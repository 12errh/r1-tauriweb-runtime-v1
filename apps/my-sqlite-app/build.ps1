$env:LIBSQLITE3_FLAGS = "-DSQLITE_THREADSAFE=0 -DSQLITE_OS_OTHER=1 -DSQLITE_OMIT_WAL=1"
cd src-tauri
wasm-pack build --target web --release --out-dir ../public/wasm
cd ..
