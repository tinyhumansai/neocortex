// Package tinyhumans provides a Go client for the TinyHumans Neocortex memory API.
package tinyhumans

const (
	// DefaultBaseURL is the default API endpoint.
	DefaultBaseURL = "https://api.tinyhumans.ai"

	// BaseURLEnv is the environment variable name for overriding the base URL.
	BaseURLEnv = "TINYHUMANS_BASE_URL"

	// DefaultModelID is the default model identifier sent with every request.
	DefaultModelID = "neocortex-mk1"
)

// MemoryItem represents a single memory item to ingest.
type MemoryItem struct {
	Key       string                 `json:"key"`
	Content   string                 `json:"content"`
	Namespace string                 `json:"namespace"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
	CreatedAt *float64               `json:"created_at,omitempty"`
	UpdatedAt *float64               `json:"updated_at,omitempty"`
}

// ReadMemoryItem represents a memory item returned from recall.
type ReadMemoryItem struct {
	Key       string                 `json:"key"`
	Content   string                 `json:"content"`
	Namespace string                 `json:"namespace"`
	Metadata  map[string]interface{} `json:"metadata"`
	CreatedAt string                 `json:"created_at"`
	UpdatedAt string                 `json:"updated_at"`
}

// IngestMemoryResponse contains counts from a memory ingest operation.
type IngestMemoryResponse struct {
	Ingested int `json:"ingested"`
	Updated  int `json:"updated"`
	Errors   int `json:"errors"`
}

// GetContextResponse contains an LLM-friendly context string and the source items.
type GetContextResponse struct {
	Context string           `json:"context"`
	Items   []ReadMemoryItem `json:"items"`
	Count   int              `json:"count"`
}

// DeleteMemoryResponse contains the count of deleted items.
type DeleteMemoryResponse struct {
	Deleted int `json:"deleted"`
}

// LLMQueryResponse contains the text response from an LLM query.
type LLMQueryResponse struct {
	Text string `json:"text"`
}

// RecallMemoryOptions holds optional parameters for RecallMemory.
type RecallMemoryOptions struct {
	NumChunks int
	Key       string
	Keys      []string
}

// DeleteMemoryOptions holds optional parameters for DeleteMemory.
type DeleteMemoryOptions struct {
	Key       string
	Keys      []string
	DeleteAll bool
}

// RecallWithLLMOptions holds parameters for RecallWithLLM.
type RecallWithLLMOptions struct {
	Provider    string
	Model       string
	Context     string
	Namespace   string
	NumChunks   int
	MaxTokens   *int
	Temperature *float64
	URL         string
}

// --- Chat & Interaction types ---

// ChatMessage represents a single message in a chat conversation.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatMemoryOptions holds optional parameters for ChatMemory and ChatMemoryContext.
type ChatMemoryOptions struct {
	Temperature *float64
	MaxTokens   *int
}

// InteractMemoryOptions holds optional parameters for InteractMemory and RecordInteractions.
type InteractMemoryOptions struct {
	Description       string
	InteractionLevel  string
	InteractionLevels []string
	Timestamp         *float64
}

// --- Advanced Recall types ---

// RecallMemoriesOptions holds optional parameters for RecallMemories (Ebbinghaus bank).
type RecallMemoriesOptions struct {
	Namespace    string
	TopK         *int
	MinRetention *float64
	AsOf         *float64
}

// RecallThoughtsOptions holds optional parameters for RecallThoughts.
type RecallThoughtsOptions struct {
	Namespace             string
	MaxChunks             *int
	Temperature           *float64
	RandomnessSeed        *int
	Persist               *bool
	EnablePredictionCheck *bool
	ThoughtPrompt         string
}

// QueryMemoryOptions holds optional parameters for QueryMemory.
type QueryMemoryOptions struct {
	Namespace   string
	MaxChunks   *int
	DocumentIDs []string
}

// QueryMemoryContextOptions holds optional parameters for QueryMemoryContext.
type QueryMemoryContextOptions struct {
	Namespace         string
	IncludeReferences *bool
	MaxChunks         *int
	DocumentIDs       []string
	RecallOnly        *bool
	LLMQuery          string
}

// --- Document types ---

// InsertDocumentOptions holds optional parameters for InsertDocument.
type InsertDocumentOptions struct {
	SourceType string
	Metadata   map[string]interface{}
	Priority   string
	CreatedAt  *float64
	UpdatedAt  *float64
	DocumentID string
}

// DocumentItem represents a single document in a batch insert.
type DocumentItem struct {
	Title      string                 `json:"title"`
	Content    string                 `json:"content"`
	Namespace  string                 `json:"namespace"`
	SourceType string                 `json:"sourceType,omitempty"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
	Priority   string                 `json:"priority,omitempty"`
	CreatedAt  *float64               `json:"createdAt,omitempty"`
	UpdatedAt  *float64               `json:"updatedAt,omitempty"`
	DocumentID string                 `json:"documentId,omitempty"`
}

// ListDocumentsOptions holds optional parameters for ListDocuments.
type ListDocumentsOptions struct {
	Namespace string
	Limit     *int
	Offset    *int
}

// GetDocumentOptions holds optional parameters for GetDocument.
type GetDocumentOptions struct {
	Namespace string
}

// --- Admin & Utility types ---

// GraphSnapshotOptions holds optional parameters for GetGraphSnapshot.
type GraphSnapshotOptions struct {
	Namespace string
	Mode      string
	Limit     *int
	SeedLimit *int
}

// RecallMemoriesContextOptions holds optional parameters for RecallMemoriesContext.
type RecallMemoriesContextOptions struct {
	Namespace string
	MaxChunks float64
}

// SyncMemoryOptions holds optional parameters for SyncMemory.
type SyncMemoryOptions struct {
	WorkspaceID string
	AgentID     string
}

// WaitForIngestionJobOptions holds optional parameters for WaitForIngestionJob.
type WaitForIngestionJobOptions struct {
	TimeoutSeconds      float64
	PollIntervalSeconds float64
}
