//! Error types for the Alphahuman Memory SDK.

/// Errors returned by the SDK.
#[derive(Debug, thiserror::Error)]
pub enum AlphahumanError {
    #[error("validation error: {0}")]
    Validation(String),

    #[error("HTTP error: {0}")]
    Http(String),

    #[error("API error ({status}): {message}")]
    Api {
        message: String,
        status: u16,
        body: Option<String>,
    },

    #[error("decode error: {0}")]
    Decode(String),
}
