//! Alphahuman Memory SDK for Rust.
//! Aligned with AlphaHuman backend API: insert, query, admin/delete, recall, memories/recall.

pub mod error;
pub mod types;

pub use error::AlphahumanError;
pub use types::*;

use reqwest::Client;
use serde::de::DeserializeOwned;

/// Default base URL when none is provided and env is unset.
pub const DEFAULT_BASE_URL: &str = "https://staging-api.alphahuman.xyz";
/// Environment variable for base URL override.
pub const BASE_URL_ENV: &str = "ALPHAHUMAN_BASE_URL";

/// Configuration for the Alphahuman Memory client.
#[derive(Clone, Debug)]
pub struct AlphahumanConfig {
    /// Bearer token (API key or JWT).
    pub token: String,
    /// Base URL of the Alphahuman backend. If None, uses BASE_URL_ENV or DEFAULT_BASE_URL.
    pub base_url: Option<String>,
}

impl AlphahumanConfig {
    pub fn new(token: impl Into<String>) -> Self {
        Self {
            token: token.into(),
            base_url: None,
        }
    }

    pub fn with_base_url(mut self, base_url: impl Into<String>) -> Self {
        self.base_url = Some(base_url.into());
        self
    }

    fn resolve_base_url(&self) -> String {
        self.base_url
            .clone()
            .or_else(|| std::env::var(BASE_URL_ENV).ok())
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string())
            .trim_end_matches('/')
            .to_string()
    }
}

/// Async client for the Alphahuman Memory API.
#[derive(Clone)]
pub struct AlphahumanMemoryClient {
    client: Client,
    base_url: String,
    token: String,
}

impl AlphahumanMemoryClient {
    /// Create a new client. Token must be non-empty.
    pub fn new(config: AlphahumanConfig) -> Result<Self, AlphahumanError> {
        let token = config.token.trim().to_string();
        if token.is_empty() {
            return Err(AlphahumanError::Validation("token is required".into()));
        }
        let base_url = AlphahumanConfig {
            token: token.clone(),
            base_url: config.base_url,
        }
        .resolve_base_url();
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(|e| AlphahumanError::Http(e.to_string()))?;
        Ok(Self {
            client,
            base_url,
            token,
        })
    }

    /// Insert (ingest) a document into memory. POST /v1/memory/insert
    pub async fn insert_memory(
        &self,
        params: InsertMemoryParams,
    ) -> Result<InsertMemoryResponse, AlphahumanError> {
        if params.title.is_empty() {
            return Err(AlphahumanError::Validation("title is required and must be a string".into()));
        }
        if params.content.is_empty() {
            return Err(AlphahumanError::Validation("content is required and must be a string".into()));
        }
        if params.namespace.is_empty() {
            return Err(AlphahumanError::Validation("namespace is required and must be a string".into()));
        }
        let body = InsertMemoryBody {
            title: params.title,
            content: params.content,
            namespace: params.namespace,
            source_type: params.source_type.unwrap_or(SourceType::Doc),
            metadata: params.metadata,
            priority: params.priority,
            created_at: params.created_at,
            updated_at: params.updated_at,
            document_id: params.document_id,
        };
        self.post("/v1/memory/insert", &body).await
    }

    /// Query memory via RAG. POST /v1/memory/query
    pub async fn query_memory(
        &self,
        params: QueryMemoryParams,
    ) -> Result<QueryMemoryResponse, AlphahumanError> {
        if params.query.is_empty() {
            return Err(AlphahumanError::Validation("query is required and must be a string".into()));
        }
        if let Some(mc) = params.max_chunks {
            if !(1..=200).contains(&mc) {
                return Err(AlphahumanError::Validation("maxChunks must be between 1 and 200".into()));
            }
        }
        self.post("/v1/memory/query", &params).await
    }

    /// Delete memory (admin). POST /v1/memory/admin/delete
    pub async fn delete_memory(
        &self,
        params: DeleteMemoryParams,
    ) -> Result<DeleteMemoryResponse, AlphahumanError> {
        self.post("/v1/memory/admin/delete", &params).await
    }

    /// Recall context from Master node. POST /v1/memory/recall
    pub async fn recall_memory(
        &self,
        params: RecallMemoryParams,
    ) -> Result<RecallMemoryResponse, AlphahumanError> {
        if let Some(mc) = params.max_chunks {
            if mc <= 0 {
                return Err(AlphahumanError::Validation("maxChunks must be a positive integer".into()));
            }
        }
        self.post("/v1/memory/recall", &params).await
    }

    /// Recall memories from Ebbinghaus bank. POST /v1/memory/memories/recall
    pub async fn recall_memories(
        &self,
        params: RecallMemoriesParams,
    ) -> Result<RecallMemoriesResponse, AlphahumanError> {
        if let Some(tk) = params.top_k {
            if tk <= 0.0 {
                return Err(AlphahumanError::Validation("topK must be a positive number".into()));
            }
        }
        if let Some(mr) = params.min_retention {
            if mr < 0.0 {
                return Err(AlphahumanError::Validation("minRetention must be a non-negative number".into()));
            }
        }
        self.post("/v1/memory/memories/recall", &params).await
    }

    async fn post<T: DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, AlphahumanError> {
        let url = format!("{}{}", self.base_url, path);
        let res = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.token))
            .json(body)
            .send()
            .await
            .map_err(|e| AlphahumanError::Http(e.to_string()))?;
        let status = res.status();
        let text = res
            .text()
            .await
            .map_err(|e| AlphahumanError::Http(e.to_string()))?;
        if !status.is_success() {
            let err_msg: ErrorPayload = serde_json::from_str(&text).unwrap_or(ErrorPayload {
                success: false,
                error: format!("HTTP {}", status),
            });
            return Err(AlphahumanError::Api {
                message: err_msg.error,
                status: status.as_u16(),
                body: Some(text),
            });
        }
        serde_json::from_str(&text).map_err(|e| AlphahumanError::Decode(e.to_string()))
    }
}

#[derive(serde::Serialize)]
struct InsertMemoryBody {
    title: String,
    content: String,
    namespace: String,
    #[serde(rename = "sourceType")]
    source_type: SourceType,
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    priority: Option<Priority>,
    #[serde(rename = "createdAt", skip_serializing_if = "Option::is_none")]
    created_at: Option<f64>,
    #[serde(rename = "updatedAt", skip_serializing_if = "Option::is_none")]
    updated_at: Option<f64>,
    #[serde(rename = "documentId", skip_serializing_if = "Option::is_none")]
    document_id: Option<String>,
}

#[derive(serde::Deserialize)]
struct ErrorPayload {
    #[allow(dead_code)]
    success: bool,
    error: String,
}
