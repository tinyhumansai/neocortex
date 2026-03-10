//! Request and response types for the Alphahuman Memory API.

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
    pub document_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InsertMemoryResponse {
    pub success: bool,
    pub data: InsertMemoryData,
}

#[derive(Debug, Clone, Deserialize)]
pub struct InsertMemoryData {
    pub status: String,
    pub stats: serde_json::Value,
    pub usage: Option<Usage>,
}

// ---------- Query ----------

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct QueryMemoryParams {
    pub query: String,
    pub include_references: Option<bool>,
    pub namespace: Option<String>,
    pub max_chunks: Option<u32>,
    pub document_ids: Option<Vec<String>>,
    pub llm_query: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct QueryMemoryResponse {
    pub success: bool,
    pub data: QueryMemoryData,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryMemoryData {
    pub context: Option<QueryContextOut>,
    pub usage: Option<Usage>,
    pub cached: bool,
    pub llm_context_message: Option<String>,
    pub response: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct QueryContextOut {
    pub entities: Vec<serde_json::Value>,
    pub relations: Vec<serde_json::Value>,
    pub chunks: Vec<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Usage {
    pub llm_input_tokens: u64,
    pub llm_output_tokens: u64,
    pub embedding_tokens: u64,
    pub cost_usd: f64,
}

// ---------- Delete ----------

#[derive(Debug, Clone, Default, Serialize)]
pub struct DeleteMemoryParams {
    pub namespace: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DeleteMemoryResponse {
    pub success: bool,
    pub data: DeleteMemoryData,
}

#[derive(Debug, Clone, Deserialize)]
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
    pub namespace: Option<String>,
    pub max_chunks: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecallMemoryResponse {
    pub success: bool,
    pub data: RecallMemoryData,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecallMemoryData {
    pub context: Option<QueryContextOut>,
    pub usage: Option<Usage>,
    pub cached: bool,
    pub llm_context_message: Option<String>,
    pub response: Option<String>,
    pub latency_seconds: Option<f64>,
    pub counts: Option<RecallCounts>,
}

#[derive(Debug, Clone, Deserialize)]
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
    pub namespace: Option<String>,
    pub top_k: Option<f64>,
    pub min_retention: Option<f64>,
    pub as_of: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecallMemoriesResponse {
    pub success: bool,
    pub data: RecallMemoriesData,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RecallMemoriesData {
    pub memories: Vec<MemoryItemRecalled>,
}

#[derive(Debug, Clone, Deserialize)]
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
