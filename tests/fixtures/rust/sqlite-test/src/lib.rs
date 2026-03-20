use std::fs;
use std::io::{Write, Seek, SeekFrom};
use std::slice;
use std::mem;

#[no_mangle]
pub extern "C" fn r1_alloc(size: usize) -> *mut u8 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    mem::forget(buf);
    ptr
}

#[no_mangle]
pub extern "C" fn r1_free(ptr: *mut u8, size: usize) {
    unsafe {
        Vec::from_raw_parts(ptr, size, size);
    }
}

unsafe fn read_str(ptr: *const u8, len: usize) -> String {
    let slice = slice::from_raw_parts(ptr, len);
    String::from_utf8_lossy(slice).into_owned()
}

unsafe fn return_str(s: String) -> *mut u8 {
    let len = s.len();
    let ptr = r1_alloc(len + 4); 
    // We'll store length in first 4 bytes for simplicity in our raw contract
    let len_bytes = (len as u32).to_le_bytes();
    for i in 0..4 {
        *ptr.add(i) = len_bytes[i];
    }
    for i in 0..len {
        *ptr.add(i + 4) = s.as_bytes()[i];
    }
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn test_metadata(ptr: *const u8, len: usize) -> *mut u8 {
    let json = read_str(ptr, len);
    let args: serde_json::Value = serde_json::from_str(&json).unwrap_or_default();
    let path = args["path"].as_str().unwrap_or("");
    
    let res = match fs::metadata(path) {
        Ok(meta) => serde_json::json!({ "ok": { "size": meta.len(), "is_file": meta.is_file() } }),
        Err(e) => serde_json::json!({ "error": e.to_string() }),
    };
    return_str(res.to_string())
}

#[no_mangle]
pub unsafe extern "C" fn test_seek_and_tell(ptr: *const u8, len: usize) -> *mut u8 {
    let json = read_str(ptr, len);
    let args: serde_json::Value = serde_json::from_str(&json).unwrap_or_default();
    let path = args["path"].as_str().unwrap_or("");

    let res = match (|| -> Result<u64, Box<dyn std::error::Error>> {
        let mut file = fs::OpenOptions::new().read(true).open(path)?;
        file.seek(SeekFrom::Start(5))?;
        Ok(file.stream_position()?)
    })() {
        Ok(pos) => serde_json::json!({ "ok": { "pos": pos } }),
        Err(e) => serde_json::json!({ "error": e.to_string() }),
    };
    return_str(res.to_string())
}

#[no_mangle]
pub unsafe extern "C" fn test_sync(ptr: *const u8, len: usize) -> *mut u8 {
    let json = read_str(ptr, len);
    let args: serde_json::Value = serde_json::from_str(&json).unwrap_or_default();
    let path = args["path"].as_str().unwrap_or("");
    let content = args["content"].as_str().unwrap_or("");
    
    let res = match (|| -> Result<(), Box<dyn std::error::Error>> {
        let mut file = fs::OpenOptions::new().write(true).create(true).open(path)?;
        file.write_all(content.as_bytes())?;
        file.sync_all()?;
        Ok(())
    })() {
        Ok(_) => serde_json::json!({ "ok": true }),
        Err(e) => serde_json::json!({ "error": e.to_string() }),
    };
    return_str(res.to_string())
}

#[no_mangle]
pub unsafe extern "C" fn test_rename(ptr: *const u8, len: usize) -> *mut u8 {
    let json = read_str(ptr, len);
    let args: serde_json::Value = serde_json::from_str(&json).unwrap_or_default();
    let old_path = args["oldPath"].as_str().unwrap_or("");
    let new_path = args["newPath"].as_str().unwrap_or("");
    
    let res = match fs::rename(old_path, new_path) {
        Ok(_) => serde_json::json!({ "ok": true }),
        Err(e) => serde_json::json!({ "error": e.to_string() }),
    };
    return_str(res.to_string())
}
