package tinyhumans

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

// Client is the TinyHumans memory API client.
type Client struct {
	baseURL string
	token   string
	modelID string
	http    *http.Client
}

// NewClient creates a new TinyHumans client with the default model ID.
// token is required. baseURL is optional (uses env var or default).
func NewClient(token string, baseURL ...string) (*Client, error) {
	return NewClientWithModelID(token, "", baseURL...)
}

// NewClientWithModelID creates a new TinyHumans client with a custom model ID.
// token is required. modelID defaults to "neocortex-mk1" if empty.
// baseURL is optional (uses env var or default).
func NewClientWithModelID(token, modelID string, baseURL ...string) (*Client, error) {
	if strings.TrimSpace(token) == "" {
		return nil, errors.New("token is required")
	}

	if modelID == "" {
		modelID = DefaultModelID
	}

	resolved := ""
	if len(baseURL) > 0 && baseURL[0] != "" {
		resolved = baseURL[0]
	}
	if resolved == "" {
		resolved = os.Getenv(BaseURLEnv)
	}
	if resolved == "" {
		resolved = DefaultBaseURL
	}
	resolved = strings.TrimRight(resolved, "/")

	return &Client{
		baseURL: resolved,
		token:   token,
		modelID: modelID,
		http:    &http.Client{Timeout: 30 * time.Second},
	}, nil
}

// Close releases any resources held by the client.
func (c *Client) Close() {
	c.http.CloseIdleConnections()
}

// IngestMemory ingests (upserts) a single memory item.
func (c *Client) IngestMemory(item MemoryItem) (*IngestMemoryResponse, error) {
	return c.IngestMemories([]MemoryItem{item})
}

// IngestMemories ingests (upserts) one or more memory items.
func (c *Client) IngestMemories(items []MemoryItem) (*IngestMemoryResponse, error) {
	if len(items) == 0 {
		return nil, errors.New("items must be a non-empty list")
	}

	ingested := 0
	updated := 0
	errCount := 0

	for _, item := range items {
		if item.DocumentID == "" {
			return nil, errors.New("documentId is required for each memory item")
		}
		if err := validateTimestamps(item.CreatedAt, item.UpdatedAt); err != nil {
			return nil, err
		}

		body := map[string]interface{}{
			"title":      item.Key,
			"content":    item.Content,
			"namespace":  item.Namespace,
			"documentId": item.DocumentID,
			"sourceType": "doc",
			"metadata":   item.Metadata,
		}
		if item.Metadata == nil {
			body["metadata"] = map[string]interface{}{}
		}
		if item.CreatedAt != nil {
			body["createdAt"] = *item.CreatedAt
		}
		if item.UpdatedAt != nil {
			body["updatedAt"] = *item.UpdatedAt
		}

		data, err := c.send("POST", "/memory/insert", body)
		if err != nil {
			errCount++
			continue
		}

		status, _ := data["status"].(string)
		if status == "completed" {
			ingested++
		} else {
			updated++
		}
	}

	return &IngestMemoryResponse{
		Ingested: ingested,
		Updated:  updated,
		Errors:   errCount,
	}, nil
}

// RecallMemory retrieves an LLM-friendly context string from stored memory.
func (c *Client) RecallMemory(namespace, prompt string, opts *RecallMemoryOptions) (*GetContextResponse, error) {
	numChunks := 10
	if opts != nil && opts.NumChunks > 0 {
		numChunks = opts.NumChunks
	}
	if numChunks < 1 {
		return nil, errors.New("num_chunks must be >= 1")
	}

	body := map[string]interface{}{
		"namespace": namespace,
		"maxChunks": numChunks,
	}

	data, err := c.send("POST", "/memory/recall", body)
	if err != nil {
		return nil, err
	}

	var items []ReadMemoryItem

	if ctxObj, ok := data["context"].(map[string]interface{}); ok {
		if chunks, ok := ctxObj["chunks"].([]interface{}); ok {
			for _, ch := range chunks {
				chunk, ok := ch.(map[string]interface{})
				if !ok {
					continue
				}
				key := strVal(chunk, "id")
				if key == "" {
					key = strVal(chunk, "document_id")
				}
				content := strVal(chunk, "content")
				if content == "" {
					content = strVal(chunk, "text")
				}
				var metadata map[string]interface{}
				if m, ok := chunk["metadata"].(map[string]interface{}); ok {
					metadata = m
				} else {
					metadata = map[string]interface{}{}
				}
				items = append(items, ReadMemoryItem{
					Key:       key,
					Content:   content,
					Namespace: namespace,
					Metadata:  metadata,
					CreatedAt: strVal(chunk, "createdAt"),
					UpdatedAt: strVal(chunk, "updatedAt"),
				})
			}
		}
	}

	if len(items) > numChunks {
		items = items[:numChunks]
	}

	var context string
	if llmCtx, ok := data["llmContextMessage"].(string); ok && llmCtx != "" {
		context = llmCtx
	} else {
		var parts []string
		for _, it := range items {
			header := fmt.Sprintf("[%s:%s]", it.Namespace, it.Key)
			parts = append(parts, header+"\n"+it.Content)
		}
		context = strings.Join(parts, "\n\n")
	}

	return &GetContextResponse{
		Context: context,
		Items:   items,
		Count:   len(items),
	}, nil
}

// DeleteMemory deletes memory items by namespace.
func (c *Client) DeleteMemory(namespace string, opts *DeleteMemoryOptions) (*DeleteMemoryResponse, error) {
	body := map[string]interface{}{
		"namespace": namespace,
	}

	data, err := c.send("POST", "/memory/admin/delete", body)
	if err != nil {
		return nil, err
	}

	deleted := 0
	if v, ok := data["nodesDeleted"].(float64); ok {
		deleted = int(v)
	}

	return &DeleteMemoryResponse{Deleted: deleted}, nil
}

// RecallWithLLM runs a prompt through a supported LLM with optional context.
// If opts.Context is empty, context is fetched via RecallMemory using opts.Namespace.
func (c *Client) RecallWithLLM(prompt, apiKey string, opts RecallWithLLMOptions) (*LLMQueryResponse, error) {
	context := opts.Context

	if strings.TrimSpace(context) == "" {
		if opts.Namespace == "" {
			return nil, errors.New("when context is not provided, namespace must be set so context can be fetched from memory via RecallMemory")
		}
		numChunks := opts.NumChunks
		if numChunks == 0 {
			numChunks = 10
		}
		ctx, err := c.RecallMemory(opts.Namespace, prompt, &RecallMemoryOptions{NumChunks: numChunks})
		if err != nil {
			return nil, err
		}
		context = ctx.Context
	}

	provider := opts.Provider
	if provider == "" {
		provider = "openai"
	}
	model := opts.Model
	if model == "" {
		model = "gpt-4o-mini"
	}

	return queryLLM(prompt, provider, model, apiKey, context, opts.MaxTokens, opts.Temperature, opts.URL)
}

// sendGet performs an HTTP GET request with query parameters and returns the parsed data.
func (c *Client) sendGet(path string, params map[string]string) (map[string]interface{}, error) {
	req, err := http.NewRequest("GET", c.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if len(params) > 0 {
		q := req.URL.Query()
		for k, v := range params {
			q.Set(k, v)
		}
		req.URL.RawQuery = q.Encode()
	}

	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("X-Model-Id", c.modelID)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	return c.parseResponse(resp)
}

// sendDelete performs an HTTP DELETE request with query parameters and returns the parsed data.
func (c *Client) sendDelete(path string, params map[string]string) (map[string]interface{}, error) {
	req, err := http.NewRequest("DELETE", c.baseURL+path, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	if len(params) > 0 {
		q := req.URL.Query()
		for k, v := range params {
			q.Set(k, v)
		}
		req.URL.RawQuery = q.Encode()
	}

	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("X-Model-Id", c.modelID)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	return c.parseResponse(resp)
}

// send performs an HTTP request with JSON body and returns the parsed data.
func (c *Client) send(method, path string, body map[string]interface{}) (map[string]interface{}, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest(method, c.baseURL+path, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("X-Model-Id", c.modelID)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	return c.parseResponse(resp)
}

// parseResponse extracts the "data" field from the API response.
func (c *Client) parseResponse(resp *http.Response) (map[string]interface{}, error) {
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(respBody, &payload); err != nil {
		return nil, &TinyHumansError{
			Message: fmt.Sprintf("HTTP %d: non-JSON response", resp.StatusCode),
			Status:  resp.StatusCode,
			Body:    string(respBody),
		}
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		message := fmt.Sprintf("HTTP %d", resp.StatusCode)
		if errMsg, ok := payload["error"].(string); ok {
			message = errMsg
		}
		return nil, &TinyHumansError{
			Message: message,
			Status:  resp.StatusCode,
			Body:    payload,
		}
	}

	data, ok := payload["data"].(map[string]interface{})
	if !ok {
		return map[string]interface{}{}, nil
	}
	return data, nil
}

// validateTimestamp validates a single Unix timestamp.
func validateTimestamp(value *float64, name string) error {
	if value == nil {
		return nil
	}
	if *value < 0 {
		return fmt.Errorf("%s must be non-negative (Unix timestamp in seconds), got %f", name, *value)
	}
	maxFuture := float64(time.Now().Unix()) + (100 * 365 * 24 * 60 * 60)
	if *value > maxFuture {
		return fmt.Errorf("%s is too far in the future (max ~100 years), got %f", name, *value)
	}
	return nil
}

// validateTimestamps validates created_at and updated_at together.
func validateTimestamps(createdAt, updatedAt *float64) error {
	if err := validateTimestamp(createdAt, "created_at"); err != nil {
		return err
	}
	if err := validateTimestamp(updatedAt, "updated_at"); err != nil {
		return err
	}
	if createdAt != nil && updatedAt != nil && *updatedAt < *createdAt {
		return fmt.Errorf("updated_at (%f) must be >= created_at (%f)", *updatedAt, *createdAt)
	}
	return nil
}

// strVal extracts a string value from a map, returning "" if not found or not a string.
func strVal(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}
