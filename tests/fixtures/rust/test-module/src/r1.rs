extern "C" {
    fn r1_emit(name: *const u8, name_len: usize,
               payload: *const u8, payload_len: usize);
}

/// Emits an event to the R1 Host (JavaScript).
/// 
/// # Example
/// ```
/// r1::emit("download-progress", r#"{"percent": 75}"#);
/// ```
pub fn emit(event: &str, payload: &str) {
    unsafe {
        r1_emit(event.as_ptr(), event.len(),
                payload.as_ptr(), payload.len());
    }
}
