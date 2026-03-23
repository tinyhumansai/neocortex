package tinyhumans

import (
	"errors"
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
