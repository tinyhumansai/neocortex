//! TinyHuman Neocortex SDK for Rust.
//! Aligned with TinyHuman memory API routes.

pub mod error;
pub mod types;

pub use error::TinyHumansError;
pub use types::*;

use reqwest::{Client, Method};
use serde::de::DeserializeOwned;

/// Default base URL when none is provided and env is unset.
pub const DEFAULT_BASE_URL: &str = "https://api.tinyhumans.ai";
/// Preferred environment variable for base URL override.
pub const TINYHUMANS_BASE_URL: &str = "TINYHUMANS_BASE_URL";
/// Alias environment variable for base URL override.
pub const NEOCORTEX_BASE_URL: &str = "NEOCORTEX_BASE_URL";

/// Configuration for the TinyHuman client.
#[derive(Clone, Debug)]
pub struct TinyHumanConfig {
    /// Bearer token (API key or JWT).
    pub token: String,
    /// Base URL of the TinyHuman backend. If None, uses TINYHUMANS_BASE_URL, then NEOCORTEX_BASE_URL, then default.
    pub base_url: Option<String>,
}

impl TinyHumanConfig {
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
            .or_else(|| std::env::var(TINYHUMANS_BASE_URL).ok())
            .or_else(|| std::env::var(NEOCORTEX_BASE_URL).ok())
            .or_else(|| std::env::var(TINYHUMANS_BASE_URL).ok())
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string())
            .trim_end_matches('/')
            .to_string()
    }
}

/// Async client for the TinyHuman memory API.
#[derive(Clone)]
pub struct TinyHumansMemoryClient {
    client: Client,
    base_url: String,
    token: String,
}

impl TinyHumansMemoryClient {
    /// Create a new client. Token must be non-empty.
    pub fn new(config: TinyHumanConfig) -> Result<Self, TinyHumansError> {
        let token = config.token.trim().to_string();
        if token.is_empty() {
            log::warn!("[tinyhumansai] client init failed: token is empty");
            return Err(TinyHumansError::Validation("token is required".into()));
        }
        let base_url = TinyHumanConfig {
            token: token.clone(),
            base_url: config.base_url,
        }
        .resolve_base_url();
        log::info!(
            "[tinyhumansai] initializing client: base_url={base_url} token_len={}",
            token.len()
        );
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .use_rustls_tls()
            .build()
            .map_err(|e| TinyHumansError::Http(e.to_string()))?;
        log::info!("[tinyhumansai] client ready");
        Ok(Self {
            client,
            base_url,
            token,
        })
    }

    /// Insert (ingest) a document into memory. POST /memory/insert
    pub async fn insert_memory(
        &self,
        params: InsertMemoryParams,
    ) -> Result<InsertMemoryResponse, TinyHumansError> {
        if params.title.is_empty() {
            return Err(TinyHumansError::Validation(
                "title is required and must be a string".into(),
            ));
        }
        if params.content.is_empty() {
            return Err(TinyHumansError::Validation(
                "content is required and must be a string".into(),
            ));
        }
        if params.namespace.is_empty() {
            return Err(TinyHumansError::Validation(
                "namespace is required and must be a string".into(),
            ));
        }
        if params.document_id.is_empty() {
            return Err(TinyHumansError::Validation(
                "documentId is required and must be a non-empty string".into(),
            ));
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
        self.post("/memory/insert", &body).await
    }

    /// Query memory via RAG. POST /memory/query
    pub async fn query_memory(
        &self,
        params: QueryMemoryParams,
    ) -> Result<QueryMemoryResponse, TinyHumansError> {
        if params.query.is_empty() {
            return Err(TinyHumansError::Validation(
                "query is required and must be a string".into(),
            ));
        }
        if let Some(mc) = params.max_chunks {
            if mc <= 0.0 {
                return Err(TinyHumansError::Validation(
                    "maxChunks must be a positive number".into(),
                ));
            }
        }
        self.post("/memory/query", &params).await
    }

    /// Delete memory (admin). POST /memory/admin/delete
    pub async fn delete_memory(
        &self,
        params: DeleteMemoryParams,
    ) -> Result<DeleteMemoryResponse, TinyHumansError> {
        self.post("/memory/admin/delete", &params).await
    }

    /// Recall context from Master node. POST /memory/recall
    pub async fn recall_memory(
        &self,
        params: RecallMemoryParams,
    ) -> Result<RecallMemoryResponse, TinyHumansError> {
        if let Some(mc) = params.max_chunks {
            if mc <= 0.0 {
                return Err(TinyHumansError::Validation(
                    "maxChunks must be a positive number".into(),
                ));
            }
        }
        self.post("/memory/recall", &params).await
    }

    /// Recall memories from Ebbinghaus bank. POST /memory/memories/recall
    pub async fn recall_memories(
        &self,
        params: RecallMemoriesParams,
    ) -> Result<RecallMemoriesResponse, TinyHumansError> {
        if let Some(tk) = params.top_k {
            if tk <= 0.0 {
                return Err(TinyHumansError::Validation(
                    "topK must be a positive number".into(),
                ));
            }
        }
        if let Some(mr) = params.min_retention {
            if mr < 0.0 {
                return Err(TinyHumansError::Validation(
                    "minRetention must be a non-negative number".into(),
                ));
            }
        }
        self.post("/memory/memories/recall", &params).await
    }

    /// Recall memory context. POST /memory/memories/context
    pub async fn recall_memories_context(
        &self,
        params: RecallMemoriesContextParams,
    ) -> Result<RecallMemoriesContextResponse, TinyHumansError> {
        self.post("/memory/memories/context", &params).await
    }

    /// Generate reflective thoughts from recalled memory context. POST /memory/memories/thoughts
    pub async fn memory_thoughts(
        &self,
        params: MemoryThoughtsParams,
    ) -> Result<MemoryThoughtsResponse, TinyHumansError> {
        self.post("/memory/memories/thoughts", &params).await
    }

    /// Record entity interactions. POST /memory/interact
    pub async fn interact_memory(
        &self,
        params: MemoryInteractionsParams,
    ) -> Result<MemoryInteractionsResponse, TinyHumansError> {
        self.validate_interactions(&params)?;
        self.post("/memory/interact", &params).await
    }

    /// Record interaction signals for entities. POST /memory/interactions
    pub async fn record_interactions(
        &self,
        params: MemoryInteractionsParams,
    ) -> Result<MemoryInteractionsResponse, TinyHumansError> {
        self.validate_interactions(&params)?;
        self.post("/memory/interactions", &params).await
    }

    /// Query memory context (alias route). POST /memory/queries
    pub async fn query_memories(
        &self,
        params: QueryMemoriesParams,
    ) -> Result<QueryMemoriesResponse, TinyHumansError> {
        if params.query.is_empty() {
            return Err(TinyHumansError::Validation(
                "query is required and must be a string".into(),
            ));
        }
        self.post("/memory/queries", &params).await
    }

    /// Chat with memory context. POST /memory/conversations
    pub async fn memory_conversation(
        &self,
        params: MemoryConversationParams,
    ) -> Result<MemoryConversationResponse, TinyHumansError> {
        if params.messages.is_empty() {
            return Err(TinyHumansError::Validation(
                "messages is required and must be non-empty".into(),
            ));
        }
        self.post("/memory/conversations", &params).await
    }

    /// Chat with DeltaNet memory cache. POST /memory/chat
    pub async fn memory_chat(
        &self,
        params: MemoryChatParams,
    ) -> Result<MemoryChatResponse, TinyHumansError> {
        if params.messages.is_empty() {
            return Err(TinyHumansError::Validation(
                "messages is required and must be non-empty".into(),
            ));
        }
        self.post("/memory/chat", &params).await
    }

    /// Ingest a single memory document. POST /memory/documents
    pub async fn ingest_document(
        &self,
        params: IngestDocumentParams,
    ) -> Result<IngestDocumentResponse, TinyHumansError> {
        if params.title.is_empty() {
            return Err(TinyHumansError::Validation(
                "title is required and must be a string".into(),
            ));
        }
        if params.content.is_empty() {
            return Err(TinyHumansError::Validation(
                "content is required and must be a string".into(),
            ));
        }
        if params.namespace.is_empty() {
            return Err(TinyHumansError::Validation(
                "namespace is required and must be a string".into(),
            ));
        }
        if params.document_id.is_empty() {
            return Err(TinyHumansError::Validation(
                "documentId is required and must be a non-empty string".into(),
            ));
        }
        self.post("/memory/documents", &params).await
    }

    /// Ingest multiple memory documents in batch. POST /memory/documents/batch
    pub async fn ingest_documents_batch(
        &self,
        params: BatchIngestDocumentsParams,
    ) -> Result<BatchIngestDocumentsResponse, TinyHumansError> {
        if params.items.is_empty() {
            return Err(TinyHumansError::Validation(
                "items must be a non-empty list".into(),
            ));
        }
        for (i, item) in params.items.iter().enumerate() {
            if item.document_id.is_empty() {
                return Err(TinyHumansError::Validation(
                    format!("items[{}]: documentId is required", i),
                ));
            }
        }
        self.post("/memory/documents/batch", &params).await
    }

    /// List ingested memory documents. GET /memory/documents
    pub async fn list_documents(&self) -> Result<ListDocumentsResponse, TinyHumansError> {
        self.get("/memory/documents").await
    }

    /// Get details for a memory document. GET /memory/documents/{documentId}
    pub async fn get_document(
        &self,
        document_id: &str,
        namespace: Option<&str>,
    ) -> Result<GetDocumentResponse, TinyHumansError> {
        if document_id.trim().is_empty() {
            return Err(TinyHumansError::Validation(
                "document_id is required".into(),
            ));
        }
        let mut path = format!("/memory/documents/{document_id}");
        if let Some(ns) = namespace {
            if !ns.trim().is_empty() {
                path = format!("{path}?namespace={ns}");
            }
        }
        self.get(&path).await
    }

    /// Delete a memory document. DELETE /memory/documents/{documentId}
    pub async fn delete_document(
        &self,
        document_id: &str,
        namespace: &str,
    ) -> Result<DeleteDocumentResponse, TinyHumansError> {
        if document_id.trim().is_empty() {
            return Err(TinyHumansError::Validation(
                "document_id is required".into(),
            ));
        }
        if namespace.trim().is_empty() {
            return Err(TinyHumansError::Validation("namespace is required".into()));
        }
        self.delete(&format!(
            "/memory/documents/{document_id}?namespace={namespace}"
        ))
        .await
    }

    /// Sync OpenClaw memory files to backend. POST /memory/sync
    pub async fn sync_memory(
        &self,
        params: SyncMemoryParams,
    ) -> Result<SyncMemoryResponse, TinyHumansError> {
        if params.workspace_id.is_empty() {
            return Err(TinyHumansError::Validation(
                "workspaceId is required".into(),
            ));
        }
        if params.agent_id.is_empty() {
            return Err(TinyHumansError::Validation("agentId is required".into()));
        }
        if params.files.is_empty() {
            return Err(TinyHumansError::Validation(
                "files is required and must be non-empty".into(),
            ));
        }
        self.post("/memory/sync", &params).await
    }

    /// Check memory server health status. GET /memory/health
    pub async fn memory_health(&self) -> Result<MemoryHealthResponse, TinyHumansError> {
        self.get("/memory/health").await
    }

    /// Get memory ingestion job status. GET /memory/ingestion/jobs/{jobId}
    pub async fn ingestion_job_status(
        &self,
        job_id: &str,
    ) -> Result<IngestionJobStatusResponse, TinyHumansError> {
        if job_id.trim().is_empty() {
            return Err(TinyHumansError::Validation("job_id is required".into()));
        }
        self.get(&format!("/memory/ingestion/jobs/{job_id}")).await
    }

    fn validate_interactions(
        &self,
        params: &MemoryInteractionsParams,
    ) -> Result<(), TinyHumansError> {
        if params.namespace.trim().is_empty() {
            return Err(TinyHumansError::Validation("namespace is required".into()));
        }
        if params.entity_names.is_empty() {
            return Err(TinyHumansError::Validation(
                "entityNames is required and must be non-empty".into(),
            ));
        }
        Ok(())
    }

    async fn post<T: DeserializeOwned, B: serde::Serialize>(
        &self,
        path: &str,
        body: &B,
    ) -> Result<T, TinyHumansError> {
        self.request(Method::POST, path, Some(body)).await
    }

    async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, TinyHumansError> {
        self.request::<T, serde_json::Value>(Method::GET, path, None)
            .await
    }

    async fn delete<T: DeserializeOwned>(&self, path: &str) -> Result<T, TinyHumansError> {
        self.request::<T, serde_json::Value>(Method::DELETE, path, None)
            .await
    }

    async fn request<T: DeserializeOwned, B: serde::Serialize>(
        &self,
        method: Method,
        path: &str,
        body: Option<&B>,
    ) -> Result<T, TinyHumansError> {
        let url = format!("{}{}", self.base_url, path);
        log::info!("[tinyhumansai] → {} {}", method, url);
        if let Some(body) = body {
            match serde_json::to_string(body) {
                Ok(json) => log::debug!("[tinyhumansai] request body: {}", json),
                Err(e) => log::warn!("[tinyhumansai] could not serialize body for logging: {e}"),
            }
        }

        let mut req = self
            .client
            .request(method.clone(), &url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {}", self.token));

        if let Some(body) = body {
            req = req.json(body);
        }

        let res = req.send().await.map_err(|e| {
            let mut cause = String::new();
            let mut src: &dyn std::error::Error = &e;
            loop {
                cause.push_str(&format!(" → {src}"));
                match src.source() {
                    Some(next) => src = next,
                    None => break,
                }
            }
            log::warn!("[tinyhumansai] ← {} {} send error:{}", method, url, cause);
            TinyHumansError::Http(e.to_string())
        })?;

        let status = res.status();
        log::info!(
            "[tinyhumansai] ← {} {} status={}",
            method,
            url,
            status.as_u16()
        );

        let text = res
            .text()
            .await
            .map_err(|e| TinyHumansError::Http(e.to_string()))?;

        if !status.is_success() {
            log::warn!("[tinyhumansai] error response body: {}", text);
            let err_payload: ErrorPayload =
                serde_json::from_str(&text).unwrap_or_else(|_| ErrorPayload::default());
            let message = err_payload
                .error
                .or(err_payload.message)
                .unwrap_or_else(|| format!("HTTP {status}"));
            return Err(TinyHumansError::Api {
                message,
                status: status.as_u16(),
                body: Some(text),
            });
        }

        log::debug!("[tinyhumansai] response body: {}", text);
        serde_json::from_str(&text).map_err(|e| TinyHumansError::Decode(e.to_string()))
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
    #[serde(rename = "documentId")]
    document_id: String,
}

#[derive(serde::Deserialize, Default)]
struct ErrorPayload {
    error: Option<String>,
    message: Option<String>,
}
