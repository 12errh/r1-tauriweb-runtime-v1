use r1_macros::command;
use serde::{Deserialize, Serialize};

// Test 1: Function with no parameters
#[command]
pub fn get_version() -> String {
    "0.3.0".to_string()
}

#[test]
fn test_no_params() {
    let result = get_version("{}");
    assert_eq!(result, r#""0.3.0""#);
}

// Test 2: Function with one parameter
#[command]
pub fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

#[test]
fn test_one_param() {
    let payload = r#"{"name":"Alice"}"#;
    let result = greet(payload);
    assert_eq!(result, r#""Hello, Alice!""#);
}

// Test 3: Function with multiple parameters
#[command]
pub fn add(a: f64, b: f64) -> f64 {
    a + b
}

#[test]
fn test_multiple_params() {
    let payload = r#"{"a":5.5,"b":3.2}"#;
    let result = add(payload);
    assert_eq!(result, "8.7");
}

// Test 4: Function with integer parameters
#[command]
pub fn multiply(x: i32, y: i32) -> i32 {
    x * y
}

#[test]
fn test_integer_params() {
    let payload = r#"{"x":7,"y":6}"#;
    let result = multiply(payload);
    assert_eq!(result, "42");
}

// Test 5: Function returning boolean
#[command]
pub fn is_positive(num: f64) -> bool {
    num > 0.0
}

#[test]
fn test_boolean_return() {
    let payload = r#"{"num":5.0}"#;
    let result = is_positive(payload);
    assert_eq!(result, "true");
    
    let payload = r#"{"num":-3.0}"#;
    let result = is_positive(payload);
    assert_eq!(result, "false");
}

// Test 6: Function with custom struct return type
#[derive(Serialize, Deserialize)]
pub struct User {
    name: String,
    age: u32,
}

#[command]
pub fn create_user(name: String, age: u32) -> User {
    User { name, age }
}

#[test]
fn test_struct_return() {
    let payload = r#"{"name":"Bob","age":30}"#;
    let result = create_user(payload);
    assert_eq!(result, r#"{"name":"Bob","age":30}"#);
}

// Test 7: Function with three parameters
#[command]
pub fn calculate(a: f64, b: f64, c: f64) -> f64 {
    (a + b) * c
}

#[test]
fn test_three_params() {
    let payload = r#"{"a":2.0,"b":3.0,"c":4.0}"#;
    let result = calculate(payload);
    assert_eq!(result, "20.0");
}

// Test 8: Error handling - invalid JSON
#[test]
fn test_invalid_json() {
    let payload = "not valid json";
    let result = greet(payload);
    assert!(result.contains("error"));
    assert!(result.contains("Deserialization error"));
}

// Test 9: Error handling - missing field
#[test]
fn test_missing_field() {
    let payload = r#"{}"#;
    let result = greet(payload);
    assert!(result.contains("error"));
}

// Test 10: Error handling - wrong type
#[test]
fn test_wrong_type() {
    let payload = r#"{"a":"not a number","b":3.0}"#;
    let result = add(payload);
    assert!(result.contains("error"));
}

// Test 11: Function with String slice conversion
#[command]
pub fn uppercase(text: String) -> String {
    text.to_uppercase()
}

#[test]
fn test_string_param() {
    let payload = r#"{"text":"hello world"}"#;
    let result = uppercase(payload);
    assert_eq!(result, r#""HELLO WORLD""#);
}

// Test 12: Function with complex logic
#[command]
pub fn fibonacci(n: u32) -> u64 {
    match n {
        0 => 0,
        1 => 1,
        _ => {
            let mut a = 0u64;
            let mut b = 1u64;
            for _ in 2..=n {
                let temp = a + b;
                a = b;
                b = temp;
            }
            b
        }
    }
}

#[test]
fn test_complex_logic() {
    let payload = r#"{"n":10}"#;
    let result = fibonacci(payload);
    assert_eq!(result, "55");
}

// Test 13: Function returning Vec
#[command]
pub fn range(start: i32, end: i32) -> Vec<i32> {
    (start..end).collect::<Vec<i32>>()
}

#[test]
fn test_vec_return() {
    let payload = r#"{"start":1,"end":5}"#;
    let result = range(payload);
    assert_eq!(result, "[1,2,3,4]");
}

// Test 14: Function with Option return type
#[command]
pub fn divide(a: f64, b: f64) -> Option<f64> {
    if b == 0.0 {
        None
    } else {
        Some(a / b)
    }
}

#[test]
fn test_option_return() {
    let payload = r#"{"a":10.0,"b":2.0}"#;
    let result = divide(payload);
    assert_eq!(result, "5.0");
    
    let payload = r#"{"a":10.0,"b":0.0}"#;
    let result = divide(payload);
    assert_eq!(result, "null");
}

// Test 15: Function with Result return type
#[derive(Serialize, Deserialize)]
pub struct DivisionError {
    message: String,
}

#[command]
pub fn safe_divide(a: f64, b: f64) -> Result<f64, DivisionError> {
    if b == 0.0 {
        Err(DivisionError {
            message: "Division by zero".to_string(),
        })
    } else {
        Ok(a / b)
    }
}

#[test]
fn test_result_return() {
    let payload = r#"{"a":10.0,"b":2.0}"#;
    let result = safe_divide(payload);
    assert!(result.contains("Ok") || result.contains("5"));
    
    let payload = r#"{"a":10.0,"b":0.0}"#;
    let result = safe_divide(payload);
    assert!(result.contains("Err") || result.contains("Division by zero"));
}
