use proc_macro::TokenStream;
use quote::quote;
use syn::{parse_macro_input, ItemFn, FnArg, Type, Pat, GenericParam, GenericArgument, PathArguments};

/// Procedural macro that transforms a Tauri-style command into a WASM-compatible function.
#[proc_macro_attribute]
pub fn command(_attr: TokenStream, item: TokenStream) -> TokenStream {
    let input = parse_macro_input!(item as ItemFn);
    let fn_name = &input.sig.ident;
    let fn_vis = &input.vis;
    let fn_body = &input.block;

    let mut deserialize_fields = Vec::new();
    let mut param_assignments = Vec::new();
    let mut has_deserializable = false;

    for arg in &input.sig.inputs {
        if let FnArg::Typed(pat_type) = arg {
            if let Pat::Ident(pat_ident) = &*pat_type.pat {
                let name = &pat_ident.ident;
                let ty = &pat_type.ty;

                if is_tauri_type(ty) {
                    param_assignments.push(quote! {
                        #[allow(unused_variables)]
                        let #name: #ty = unsafe { std::mem::zeroed() };
                    });
                } else {
                    let owned_ty = strip_lifetimes(ty);
                    deserialize_fields.push(quote! { pub #name: #owned_ty });
                    param_assignments.push(quote! {
                        let #name = args.#name;
                    });
                    has_deserializable = true;
                }
            }
        }
    }

    let args_logic = if has_deserializable {
        quote! {
            #[derive(serde::Deserialize)]
            #[allow(non_snake_case)]
            struct __R1Args {
                #(#deserialize_fields),*
            }
            let args: __R1Args = match serde_json::from_str(payload) {
                Ok(a) => a,
                Err(e) => return serde_json::json!({ "error": format!("Deserialization error: {}", e) }).to_string(),
            };
        }
    } else {
        quote! {}
    };

    let expanded = quote! {
        #[wasm_bindgen::prelude::wasm_bindgen]
        #fn_vis fn #fn_name(payload: &str) -> String {
            #args_logic
            #(#param_assignments)*

            // Wrap in a closure that returns a Result to handle type inference for Result<T, E>
            // We use 'as _' to help with some inference issues if needed
            let __r1_result = (|| {
                #fn_body
            })();

            match serde_json::to_string(&__r1_result) {
                Ok(s) => {
                    if (s.starts_with("{\"ok\":") || s.starts_with("{\"error\":")) && s.ends_with('}') {
                        s
                    } else {
                         serde_json::json!({ "ok": __r1_result }).to_string()
                    }
                },
                Err(e) => serde_json::json!({ "error": format!("Serialization error: {}", e) }).to_string(),
            }
        }
    };

    TokenStream::from(expanded)
}

fn is_tauri_type(ty: &Type) -> bool {
    let path = match ty {
        Type::Path(p) => &p.path,
        _ => return false,
    };

    if let Some(segment) = path.segments.last() {
        let name = segment.ident.to_string();
        if name == "State" || name == "Window" || name == "AppHandle" || name == "Manager" || name == "WebviewWindow" || name == "Runtime" {
            return true;
        }
    }
    false
}

fn strip_lifetimes(ty: &Type) -> Type {
    let mut new_ty = ty.clone();
    match new_ty {
        Type::Reference(ref mut r) => {
            r.lifetime = None;
            if let Type::Path(ref p) = *r.elem {
                if p.path.is_ident("str") {
                    return syn::parse_quote! { String };
                }
            }
            *r.elem = Box::new(strip_lifetimes(&r.elem));
        }
        Type::Path(ref mut p) => {
            for segment in &mut p.path.segments {
                if let PathArguments::AngleBracketed(ref mut args) = segment.arguments {
                    for arg in &mut args.args {
                        if let GenericArgument::Type(ref mut inner_ty) = arg {
                            *inner_ty = strip_lifetimes(inner_ty);
                        } else if let GenericArgument::Lifetime(ref mut l) = arg {
                            *l = syn::parse_quote! { 'static };
                        }
                    }
                }
            }
        }
        _ => {}
    }
    new_ty
}
