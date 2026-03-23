package tinyhumans

import (
	"errors"
	"fmt"
	"net/url"
	"strconv"
)

// ChatMemory sends a chat request with memory context.
// POST /memory/chat
func (c *Client) ChatMemory(messages []ChatMessage, opts *ChatMemoryOptions) (map[string]interface{}, error) {
	if len(messages) == 0 {
		return nil, errors.New("messages must be a non-empty list")
	}
	for _, m := range messages {
		if m.Role == "" {
			return nil, errors.New("each message requires a non-empty role")
		}
		if m.Content == "" {
			return nil, errors.New("each message requires non-empty content")
		}
	}

	body := map[string]interface{}{
		"messages": messages,
	}
	if opts != nil {
		if opts.Temperature != nil {
			body["temperature"] = *opts.Temperature
		}
		if opts.MaxTokens != nil {
			body["maxTokens"] = *opts.MaxTokens
		}
	}

	return c.send("POST", "/memory/chat", body)
}

// ChatMemoryContext sends a chat request via the conversations endpoint.
// POST /memory/conversations
func (c *Client) ChatMemoryContext(messages []ChatMessage, opts *ChatMemoryOptions) (map[string]interface{}, error) {
	if len(messages) == 0 {
		return nil, errors.New("messages must be a non-empty list")
	}

	body := map[string]interface{}{
		"messages": messages,
	}
	if opts != nil {
		if opts.Temperature != nil {
			body["temperature"] = *opts.Temperature
		}
		if opts.MaxTokens != nil {
			body["maxTokens"] = *opts.MaxTokens
		}
	}

	return c.send("POST", "/memory/conversations", body)
}

// InteractMemory records entity interaction signals.
// POST /memory/interact
func (c *Client) InteractMemory(namespace string, entityNames []string, opts *InteractMemoryOptions) (map[string]interface{}, error) {
	return c.sendInteraction("/memory/interact", namespace, entityNames, opts)
}

// RecordInteractions records entity interaction signals via the mirrored endpoint.
// POST /memory/interactions
func (c *Client) RecordInteractions(namespace string, entityNames []string, opts *InteractMemoryOptions) (map[string]interface{}, error) {
	return c.sendInteraction("/memory/interactions", namespace, entityNames, opts)
}

// RecallMemories recalls memories from the Ebbinghaus memory bank.
// POST /memory/memories/recall
func (c *Client) RecallMemories(opts *RecallMemoriesOptions) (map[string]interface{}, error) {
	body := map[string]interface{}{}
	if opts != nil {
		if opts.Namespace != "" {
			body["namespace"] = opts.Namespace
		}
		if opts.TopK != nil {
			body["topK"] = *opts.TopK
		}
		if opts.MinRetention != nil {
			body["minRetention"] = *opts.MinRetention
		}
		if opts.AsOf != nil {
			body["asOf"] = *opts.AsOf
		}
	}

	return c.send("POST", "/memory/memories/recall", body)
}

// RecallThoughts generates reflective thoughts from memory.
// POST /memory/memories/thoughts
func (c *Client) RecallThoughts(opts *RecallThoughtsOptions) (map[string]interface{}, error) {
	body := map[string]interface{}{}
	if opts != nil {
		if opts.Namespace != "" {
			body["namespace"] = opts.Namespace
		}
		if opts.MaxChunks != nil {
			body["maxChunks"] = *opts.MaxChunks
		}
		if opts.Temperature != nil {
			body["temperature"] = *opts.Temperature
		}
		if opts.RandomnessSeed != nil {
			body["randomnessSeed"] = *opts.RandomnessSeed
		}
		if opts.Persist != nil {
			body["persist"] = *opts.Persist
		}
		if opts.EnablePredictionCheck != nil {
			body["enablePredictionCheck"] = *opts.EnablePredictionCheck
		}
		if opts.ThoughtPrompt != "" {
			body["thoughtPrompt"] = opts.ThoughtPrompt
		}
	}

	return c.send("POST", "/memory/memories/thoughts", body)
}

// QueryMemoryContext queries memory context via the queries endpoint.
// POST /memory/queries
func (c *Client) QueryMemoryContext(query string, opts *QueryMemoryContextOptions) (map[string]interface{}, error) {
	if query == "" {
		return nil, errors.New("query is required")
	}

	body := map[string]interface{}{
		"query": query,
	}
	if opts != nil {
		if opts.Namespace != "" {
			body["namespace"] = opts.Namespace
		}
		if opts.IncludeReferences != nil {
			body["includeReferences"] = *opts.IncludeReferences
		}
		if opts.MaxChunks != nil {
			body["maxChunks"] = *opts.MaxChunks
		}
		if opts.DocumentIDs != nil {
			body["documentIds"] = opts.DocumentIDs
		}
		if opts.RecallOnly != nil {
			body["recallOnly"] = *opts.RecallOnly
		}
		if opts.LLMQuery != "" {
			body["llmQuery"] = opts.LLMQuery
		}
	}

	return c.send("POST", "/memory/queries", body)
}

func (c *Client) sendInteraction(path, namespace string, entityNames []string, opts *InteractMemoryOptions) (map[string]interface{}, error) {
	if namespace == "" {
		return nil, errors.New("namespace is required")
	}
	if len(entityNames) == 0 {
		return nil, errors.New("entity_names must be a non-empty list")
	}

	body := map[string]interface{}{
		"namespace":   namespace,
		"entityNames": entityNames,
	}
	if opts != nil {
		if opts.Description != "" {
			body["description"] = opts.Description
		}
		if opts.InteractionLevel != "" {
			body["interactionLevel"] = opts.InteractionLevel
		}
		if opts.InteractionLevels != nil {
			body["interactionLevels"] = opts.InteractionLevels
		}
		if opts.Timestamp != nil {
			body["timestamp"] = *opts.Timestamp
		}
	}

	return c.send("POST", path, body)
}

// InsertDocument ingests a single document.
// POST /memory/documents
func (c *Client) InsertDocument(title, content, namespace string, opts *InsertDocumentOptions) (map[string]interface{}, error) {
	if title == "" {
		return nil, errors.New("title is required")
	}
	if content == "" {
		return nil, errors.New("content is required")
	}
	if namespace == "" {
		return nil, errors.New("namespace is required")
	}

	body := map[string]interface{}{
		"title":     title,
		"content":   content,
		"namespace": namespace,
	}
	if opts != nil {
		if opts.SourceType != "" {
			body["sourceType"] = opts.SourceType
		}
		if opts.Metadata != nil {
			body["metadata"] = opts.Metadata
		}
		if opts.Priority != "" {
			body["priority"] = opts.Priority
		}
		if opts.CreatedAt != nil {
			body["createdAt"] = *opts.CreatedAt
		}
		if opts.UpdatedAt != nil {
			body["updatedAt"] = *opts.UpdatedAt
		}
		if opts.DocumentID != "" {
			body["documentId"] = opts.DocumentID
		}
	}

	return c.send("POST", "/memory/documents", body)
}

// InsertDocumentsBatch ingests multiple documents in one batch call.
// POST /memory/documents/batch
func (c *Client) InsertDocumentsBatch(items []DocumentItem) (map[string]interface{}, error) {
	if len(items) == 0 {
		return nil, errors.New("items must be a non-empty list")
	}
	for i, item := range items {
		if item.Title == "" {
			return nil, fmt.Errorf("item[%d]: title is required", i)
		}
		if item.Content == "" {
			return nil, fmt.Errorf("item[%d]: content is required", i)
		}
		if item.Namespace == "" {
			return nil, fmt.Errorf("item[%d]: namespace is required", i)
		}
	}

	body := map[string]interface{}{
		"items": items,
	}

	return c.send("POST", "/memory/documents/batch", body)
}

// ListDocuments lists ingested documents.
// GET /memory/documents
func (c *Client) ListDocuments(opts *ListDocumentsOptions) (map[string]interface{}, error) {
	params := map[string]string{}
	if opts != nil {
		if opts.Namespace != "" {
			params["namespace"] = opts.Namespace
		}
		if opts.Limit != nil {
			params["limit"] = strconv.Itoa(*opts.Limit)
		}
		if opts.Offset != nil {
			params["offset"] = strconv.Itoa(*opts.Offset)
		}
	}

	return c.sendGet("/memory/documents", params)
}

// GetDocument retrieves details for a single document.
// GET /memory/documents/{documentId}
func (c *Client) GetDocument(documentID string, opts *GetDocumentOptions) (map[string]interface{}, error) {
	if documentID == "" {
		return nil, errors.New("document_id is required")
	}

	path := fmt.Sprintf("/memory/documents/%s", url.PathEscape(documentID))
	params := map[string]string{}
	if opts != nil && opts.Namespace != "" {
		params["namespace"] = opts.Namespace
	}

	return c.sendGet(path, params)
}

// DeleteDocument deletes a single ingested document.
// DELETE /memory/documents/{documentId}
func (c *Client) DeleteDocument(documentID, namespace string) (map[string]interface{}, error) {
	if documentID == "" {
		return nil, errors.New("document_id is required")
	}
	if namespace == "" {
		return nil, errors.New("namespace is required")
	}

	path := fmt.Sprintf("/memory/documents/%s", url.PathEscape(documentID))
	return c.sendDelete(path, map[string]string{"namespace": namespace})
}
