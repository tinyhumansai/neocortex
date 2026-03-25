//! Request and response types for the TinyHuman memory API.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SourceType {
    Doc,
    Chat,
    Email,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Priority {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum InteractionLevel {
    View,
    Read,
    React,
    Engage,
    Create,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub llm_input_tokens: u64,
    pub llm_output_tokens: u64,
    pub embedding_tokens: u64,
    pub cost_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryContextOut {
    pub entities: Vec<serde_json::Value>,
    pub relations: Vec<serde_json::Value>,
    pub chunks: Vec<serde_json::Value>,
}

// ---------- Insert ----------

#[derive(Debug, Clone, Default)]
pub struct InsertMemoryParams {
    pub title: String,
    pub content: String,
    pub namespace: String,
    pub source_type: Option<SourceType>,
    pub metadata: Option<serde_json::Value>,
    pub priority: Option<Priority>,
    pub created_at: Option<f64>,
    pub updated_at: Option<f64>,
    pub document_id: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InsertMemoryResponse {
    pub success: bool,
    pub data: InsertMemoryData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InsertMemoryData {
    pub status: Option<String>,
    pub stats: Option<serde_json::Value>,
    pub usage: Option<Usage>,
    #[serde(rename = "jobId")]
    pub job_id: Option<String>,
    pub state: Option<String>,
}

// ---------- Query ----------

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct QueryMemoryParams {
    pub query: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub include_references: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_chunks: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub document_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_query: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct QueryMemoryResponse {
    pub success: bool,
    pub data: QueryMemoryData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryMemoryData {
    pub context: Option<QueryContextOut>,
    pub usage: Option<Usage>,
    pub cached: bool,
    pub llm_context_message: Option<String>,
    pub response: Option<String>,
}

// ---------- Delete ----------

#[derive(Debug, Clone, Default, Serialize)]
pub struct DeleteMemoryParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeleteMemoryResponse {
    pub success: bool,
    pub data: DeleteMemoryData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteMemoryData {
    pub status: String,
    pub user_id: String,
    pub namespace: Option<String>,
    pub nodes_deleted: u64,
    pub message: String,
}

// ---------- Recall ----------

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecallMemoryParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_chunks: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecallMemoryResponse {
    pub success: bool,
    pub data: RecallMemoryData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecallMemoryData {
    pub context: Option<serde_json::Value>,
    pub usage: Option<serde_json::Value>,
    pub cached: bool,
    pub llm_context_message: Option<String>,
    pub response: Option<String>,
    pub latency_seconds: Option<f64>,
    pub counts: Option<RecallCounts>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecallCounts {
    pub num_entities: u64,
    pub num_relations: u64,
    pub num_chunks: u64,
}

// ---------- Recall memories ----------

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecallMemoriesParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_k: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_retention: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub as_of: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecallMemoriesResponse {
    pub success: bool,
    pub data: RecallMemoriesData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecallMemoriesData {
    pub memories: Vec<MemoryItemRecalled>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct MemoryItemRecalled {
    #[serde(rename = "type")]
    pub type_: String,
    pub id: String,
    pub content: String,
    pub score: f64,
    pub retention: f64,
    pub last_accessed_at: Option<String>,
    pub access_count: u64,
    pub stability_days: f64,
}

// ---------- Memories context ----------

#[derive(Debug, Clone, Serialize, Default)]
pub struct RecallMemoriesContextParams {
    #[serde(skip_serializing_if = "Option::is_none", rename = "namespace")]
    pub namespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "maxChunks")]
    pub max_chunks: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "max_chunks")]
    pub max_chunks_snake: Option<f64>,
}

// Response schema is not specified in swagger.
pub type RecallMemoriesContextResponse = serde_json::Value;

// ---------- Memories thoughts ----------

#[derive(Debug, Clone, Serialize, Default)]
pub struct MemoryThoughtsParams {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "maxChunks")]
    pub max_chunks: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "max_chunks")]
    pub max_chunks_snake: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "randomnessSeed")]
    pub randomness_seed: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "randomness_seed")]
    pub randomness_seed_snake: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub persist: Option<bool>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        rename = "enablePredictionCheck"
    )]
    pub enable_prediction_check: Option<bool>,
    #[serde(
        skip_serializing_if = "Option::is_none",
        rename = "enable_prediction_check"
    )]
    pub enable_prediction_check_snake: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "thoughtPrompt")]
    pub thought_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "thought_prompt")]
    pub thought_prompt_snake: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MemoryThoughtsResponse {
    pub success: bool,
    pub data: MemoryThoughtsData,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MemoryThoughtsData {
    pub thought: Option<String>,
    pub context: Option<serde_json::Value>,
    pub llm_context_message: Option<String>,
    pub usage: Option<Usage>,
    pub cached: Option<bool>,
    pub latency_seconds: Option<f64>,
    pub persisted: Option<bool>,
}

// ---------- Interactions ----------

#[derive(Debug, Clone, Serialize, Default)]
pub struct MemoryInteractionsParams {
    pub namespace: String,
    #[serde(rename = "entityNames")]
    pub entity_names: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "entity_names")]
    pub entity_names_snake: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "interactionLevel")]
    pub interaction_level: Option<InteractionLevel>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "interaction_level")]
    pub interaction_level_snake: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "interactionLevels")]
    pub interaction_levels: Option<Vec<InteractionLevel>>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "interaction_levels")]
    pub interaction_levels_snake: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<f64>,
}

// Response schema is not specified in swagger.
pub type MemoryInteractionsResponse = serde_json::Value;

// ---------- Query context alias ----------

#[derive(Debug, Clone, Serialize, Default)]
pub struct QueryMemoriesParams {
    pub query: String,
    #[serde(skip_serializing_if = "Option::is_none", rename = "includeReferences")]
    pub include_references: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "include_references")]
    pub include_references_snake: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub namespace: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "maxChunks")]
    pub max_chunks: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "max_chunks")]
    pub max_chunks_snake: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "documentIds")]
    pub document_ids: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "document_ids")]
    pub document_ids_snake: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "recallOnly")]
    pub recall_only: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "recall_only")]
    pub recall_only_snake: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "llmQuery")]
    pub llm_query: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "llm_query")]
    pub llm_query_snake: Option<String>,
}

// Response schema is not specified in swagger.
pub type QueryMemoriesResponse = serde_json::Value;

// ---------- Conversations / chat ----------

#[derive(Debug, Clone, Serialize, Default)]
pub struct MemoryConversationParams {
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "maxTokens")]
    pub max_tokens: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "max_tokens")]
    pub max_tokens_snake: Option<f64>,
}

// Response schema is not specified in swagger.
pub type MemoryConversationResponse = serde_json::Value;

#[derive(Debug, Clone, Serialize, Default)]
pub struct MemoryChatParams {
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "maxTokens")]
    pub max_tokens: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MemoryChatResponse {
    pub success: bool,
    pub data: MemoryChatData,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MemoryChatData {
    pub content: Option<String>,
    pub usage: Option<ChatUsage>,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatUsage {
    pub prompt_tokens: Option<u64>,
    pub completion_tokens: Option<u64>,
    pub total_tokens: Option<u64>,
}

// ---------- Documents ----------

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct IngestDocumentParams {
    pub title: String,
    pub content: String,
    pub namespace: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_type: Option<SourceType>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<Priority>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<f64>,
    pub document_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDocumentItem {
    pub title: String,
    pub content: String,
    pub namespace: String,
    pub document_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct BatchIngestDocumentsParams {
    pub items: Vec<BatchDocumentItem>,
}

// Document route response schemas are not specified in swagger.
pub type IngestDocumentResponse = serde_json::Value;
pub type BatchIngestDocumentsResponse = serde_json::Value;
pub type ListDocumentsResponse = serde_json::Value;
pub type GetDocumentResponse = serde_json::Value;
pub type DeleteDocumentResponse = serde_json::Value;

// ---------- Sync ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncSource {
    Startup,
    AgentEnd,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncFile {
    pub file_path: String,
    pub content: String,
    pub timestamp: String,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMemoryParams {
    pub workspace_id: String,
    pub agent_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source: Option<SyncSource>,
    pub files: Vec<SyncFile>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SyncMemoryResponse {
    pub success: bool,
    pub data: SyncMemoryData,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SyncMemoryData {
    pub synced: i64,
}

// ---------- Health ----------

#[derive(Debug, Clone, Deserialize)]
pub struct MemoryHealthResponse {
    pub success: bool,
    pub data: MemoryHealthData,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MemoryHealthData {
    pub status: Option<String>,
    pub cache_stats: Option<serde_json::Value>,
    pub uptime_seconds: Option<f64>,
}

// ---------- Ingestion job ----------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestionJobStatusResponse {
    pub success: bool,
    pub data: IngestionJobStatusData,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestionJobStatusData {
    pub job_id: Option<String>,
    pub state: Option<String>,
    pub endpoint: Option<String>,
    pub attempts: Option<f64>,
    pub error: Option<String>,
    pub response: Option<serde_json::Value>,
    pub created_at: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}
