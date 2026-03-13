// Package tinyhumans provides a Go client for the TinyHumans Neocortex memory API.
package tinyhumans

const (
	// DefaultBaseURL is the default API endpoint.
	DefaultBaseURL = "https://api.tinyhumans.ai"

	// BaseURLEnv is the environment variable name for overriding the base URL.
	BaseURLEnv = "TINYHUMANS_BASE_URL"
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
