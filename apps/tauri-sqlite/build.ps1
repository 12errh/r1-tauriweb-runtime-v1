$env:CC_wasm32_wasi      = "C:\LLVM\bin\clang.exe"
$env:CC_wasm32_wasip1    = "C:\LLVM\bin\clang.exe"
$env:CC_wasm32_unknown_unknown = "C:\LLVM\bin\clang.exe"
$env:AR_wasm32_wasi      = "C:\LLVM\bin\llvm-ar.exe"
$env:AR_wasm32_wasip1    = "C:\LLVM\bin\llvm-ar.exe"
$env:AR_wasm32_unknown_unknown = "C:\LLVM\bin\llvm-ar.exe"
$env:CFLAGS_wasm32_wasi  = "--sysroot=C:\wasi-sdk\share\wasi-sysroot -I C:\wasi-sdk\share\wasi-sysroot\include\wasm32-wasi"
$env:CFLAGS_wasm32_wasip1= "--sysroot=C:\wasi-sdk\share\wasi-sysroot -I C:\wasi-sdk\share\wasi-sysroot\include\wasm32-wasip1"
$env:CFLAGS_wasm32_unknown_unknown = "--sysroot=C:\wasi-sdk\share\wasi-sysroot -I C:\wasi-sdk\share\wasi-sysroot\include\wasm32-wasi"
$env:LIBSQLITE3_FLAGS    = "-DSQLITE_THREADSAFE=0 -DSQLITE_OS_OTHER=1 -DSQLITE_OMIT_WAL=1 -DSQLITE_OMIT_LOAD_EXTENSION=1"

$env:PATH = "C:\LLVM\bin;" + $env:PATH

cd src-tauri
Write-Host "Running wasm-pack build --target web --release > build.log 2>&1..."
wasm-pack build --target web --release > build.log 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "wasm-pack failed with exit code $LASTEXITCODE. Check build.log"
    exit $LASTEXITCODE
}
