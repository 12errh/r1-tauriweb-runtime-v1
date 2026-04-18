use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, ItemFn, FnArg};

/// Procedural macro that transforms a Tauri-style command into a WASM-compatible function.
///
/// # Example
///
/// ```rust
/// use r1_macros::command;
///
/// #[command]
/// pub fn greet(name: String) -> String {
///     format!("Hello, {}!", name)
/// }
/// ```
///
/// This expands to a function that:
/// - Accepts a JSON payload string
/// - Deserializes it into typed arguments
/// - Executes the function body
/// - Serializes the result back to JSON
#[proc_macro_attribute]
pub fn command(_attr: TokenStream, item: TokenStream) -> TokenStream {
    let input = parse_macro_input!(item as ItemFn);
    let fn_name = &input.sig.ident;
    let fn_body = &input.block;
    let fn_vis = &input.vis;

    // Extract parameter names and types
    let params: Vec<_> = input.sig.inputs.iter().filter_map(|arg| {
        if let FnArg::Typed(pat_type) = arg {
            Some(pat_type)
        } else {
            None
        }
    }).collect();

    // Handle functions with no parameters
    if params.is_empty() {
        let expanded = quote! {
            #[wasm_bindgen::prelude::wasm_bindgen]
            #fn_vis fn #fn_name(_payload: &str) -> String {
                let __r1_result = (|| #fn_body)();

                match serde_json::to_string(&__r1_result) {
                    Ok(s) => s,
                    Err(e) => serde_json::json!({ "error": format!("Serialization error: {}", e) }).to_string(),
                }
            }
        };
        return TokenStream::from(expanded);
    }

    // Generate the Args struct fields
    let struct_fields = params.iter().map(|p| {
        let name = &p.pat;
        let ty = &p.ty;
        quote! { #name: #ty }
    });

    // Generate the destructuring
    let destructure = params.iter().map(|p| {
        let name = &p.pat;
        quote! { let #name = args.#name; }
    });

    // Generate the expanded function
    let expanded = quote! {
        #[wasm_bindgen::prelude::wasm_bindgen]
        #fn_vis fn #fn_name(payload: &str) -> String {
            #[derive(serde::Deserialize)]
            #[allow(non_snake_case)]
            struct __R1Args {
                #(#struct_fields),*
            }

            let args: __R1Args = match serde_json::from_str(payload) {
                Ok(a) => a,
                Err(e) => return serde_json::json!({ "error": format!("Deserialization error: {}", e) }).to_string(),
            };

            #(#destructure)*

            let __r1_result = (|| #fn_body)();

            match serde_json::to_string(&__r1_result) {
                Ok(s) => s,
                Err(e) => serde_json::json!({ "error": format!("Serialization error: {}", e) }).to_string(),
            }
        }
    };

    TokenStream::from(expanded)
}
