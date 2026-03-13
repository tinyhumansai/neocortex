package tinyhumans

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// --- isSupported ---

func TestIsSupported(t *testing.T) {
	tests := []struct {
		provider string
		want     bool
	}{
		{"openai", true},
		{"anthropic", true},
		{"google", true},
		{"custom", false},
		{"", false},
		{"other", false},
	}
	for _, tt := range tests {
		if got := isSupported(tt.provider); got != tt.want {
			t.Errorf("isSupported(%q) = %v, want %v", tt.provider, got, tt.want)
		}
	}
}

// --- queryLLM dispatch ---

func TestQueryLLM_EmptyAPIKey(t *testing.T) {
	_, err := queryLLM("prompt", "openai", "model", "", "ctx", nil, nil, "")
	if err == nil || !strings.Contains(err.Error(), "api_key") {
		t.Fatalf("expected api_key error, got %v", err)
	}
}

func TestQueryLLM_WhitespaceAPIKey(t *testing.T) {
	_, err := queryLLM("prompt", "openai", "model", "  ", "ctx", nil, nil, "")
	if err == nil {
		t.Fatal("expected error for whitespace api_key")
	}
}

func TestQueryLLM_UnsupportedProviderNoURL(t *testing.T) {
	_, err := queryLLM("prompt", "unsupported", "model", "key", "ctx", nil, nil, "")
	if err == nil || !strings.Contains(err.Error(), "provider must be one of") {
		t.Fatalf("expected provider error, got %v", err)
	}
}

func TestQueryLLM_URLOverridesProvider(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"choices": []interface{}{
				map[string]interface{}{
					"message": map[string]interface{}{"content": "custom response"},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	resp, err := queryLLM("prompt", "anything", "model", "key", "ctx", nil, nil, server.URL)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Text != "custom response" {
		t.Errorf("Text = %q", resp.Text)
	}
}

// --- OpenAI format ---

func TestLLMPost_OpenAIFormat(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)

		msgs := body["messages"].([]interface{})
		if len(msgs) != 2 {
			t.Errorf("expected 2 messages, got %d", len(msgs))
		}
		sysMsg := msgs[0].(map[string]interface{})
		if sysMsg["role"] != "system" || sysMsg["content"] != "my context" {
			t.Errorf("system message = %v", sysMsg)
		}
		userMsg := msgs[1].(map[string]interface{})
		if userMsg["role"] != "user" || userMsg["content"] != "my prompt" {
			t.Errorf("user message = %v", userMsg)
		}
		if body["model"] != "gpt-4" {
			t.Errorf("model = %v", body["model"])
		}

		resp := map[string]interface{}{
			"choices": []interface{}{
				map[string]interface{}{
					"message": map[string]interface{}{"content": "openai answer"},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	resp, err := queryCustom(server.URL, "my prompt", "gpt-4", "key", "my context", nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp != "openai answer" {
		t.Errorf("response = %q", resp)
	}
}

func TestLLMPost_OpenAINoContext(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		msgs := body["messages"].([]interface{})
		if len(msgs) != 1 {
			t.Errorf("expected 1 message (user only), got %d", len(msgs))
		}
		resp := map[string]interface{}{
			"choices": []interface{}{
				map[string]interface{}{
					"message": map[string]interface{}{"content": "ok"},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	_, err := queryCustom(server.URL, "prompt", "model", "key", "", nil, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLLMPost_CustomBearerAuth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth != "Bearer my-api-key" {
			t.Errorf("Authorization = %q, want 'Bearer my-api-key'", auth)
		}
		resp := map[string]interface{}{
			"choices": []interface{}{
				map[string]interface{}{
					"message": map[string]interface{}{"content": "ok"},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	queryCustom(server.URL, "prompt", "model", "my-api-key", "", nil, nil)
}

func TestLLMPost_MaxTokensAndTemperature(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		if body["max_tokens"].(float64) != 500 {
			t.Errorf("max_tokens = %v", body["max_tokens"])
		}
		if body["temperature"].(float64) != 0.7 {
			t.Errorf("temperature = %v", body["temperature"])
		}
		resp := map[string]interface{}{
			"choices": []interface{}{
				map[string]interface{}{
					"message": map[string]interface{}{"content": "ok"},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	mt := 500
	temp := 0.7
	queryCustom(server.URL, "prompt", "model", "key", "ctx", &mt, &temp)
}

// --- Anthropic format ---

func TestQueryLLM_AnthropicFormat(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("anthropic-version") != "2023-06-01" {
			t.Errorf("missing anthropic-version header")
		}
		if r.Header.Get("x-api-key") == "" {
			t.Error("missing x-api-key header")
		}

		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)

		if body["system"] != "my context" {
			t.Errorf("system = %v, want 'my context'", body["system"])
		}
		if body["max_tokens"].(float64) != 1024 {
			t.Errorf("max_tokens = %v, want 1024 (default)", body["max_tokens"])
		}

		resp := map[string]interface{}{
			"content": []interface{}{
				map[string]interface{}{"type": "text", "text": "anthropic answer"},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	// We can't directly call queryAnthropic with a custom URL since it's hardcoded.
	// Instead, test via llmPost + the Anthropic response parsing path.
	client := &http.Client{}
	data, err := llmPost(client, server.URL, map[string]string{
		"x-api-key":         "test-key",
		"anthropic-version": "2023-06-01",
		"Content-Type":      "application/json",
	}, map[string]interface{}{
		"model":      "claude-3",
		"max_tokens": 1024,
		"system":     "my context",
		"messages":   []map[string]string{{"role": "user", "content": "prompt"}},
	}, "Anthropic")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	content, ok := data["content"].([]interface{})
	if !ok || len(content) == 0 {
		t.Fatal("missing content in response")
	}
	first := content[0].(map[string]interface{})
	text := first["text"].(string)
	if text != "anthropic answer" {
		t.Errorf("text = %q", text)
	}
}

// --- Google format ---

func TestQueryLLM_GoogleFormat(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)

		contents := body["contents"].([]interface{})
		first := contents[0].(map[string]interface{})
		parts := first["parts"].([]interface{})
		part := parts[0].(map[string]interface{})
		text := part["text"].(string)
		if !strings.Contains(text, "Context:") || !strings.Contains(text, "my prompt") {
			t.Errorf("text = %q, expected context+prompt combined", text)
		}

		resp := map[string]interface{}{
			"candidates": []interface{}{
				map[string]interface{}{
					"content": map[string]interface{}{
						"parts": []interface{}{
							map[string]interface{}{"text": "google answer"},
						},
					},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := &http.Client{}
	text := "Context:\nmy context\n\nUser: my prompt"
	data, err := llmPost(client, server.URL, map[string]string{
		"Content-Type": "application/json",
	}, map[string]interface{}{
		"contents": []map[string]interface{}{
			{"parts": []map[string]string{{"text": text}}},
		},
	}, "Google")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	candidates := data["candidates"].([]interface{})
	candidate := candidates[0].(map[string]interface{})
	contentObj := candidate["content"].(map[string]interface{})
	parts := contentObj["parts"].([]interface{})
	part := parts[0].(map[string]interface{})
	result := part["text"].(string)
	if result != "google answer" {
		t.Errorf("text = %q", result)
	}
}

func TestQueryLLM_GoogleGenerationConfig(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		gc, ok := body["generationConfig"].(map[string]interface{})
		if !ok {
			t.Fatal("missing generationConfig")
		}
		if gc["maxOutputTokens"].(float64) != 200 {
			t.Errorf("maxOutputTokens = %v", gc["maxOutputTokens"])
		}
		if gc["temperature"].(float64) != 0.5 {
			t.Errorf("temperature = %v", gc["temperature"])
		}
		resp := map[string]interface{}{
			"candidates": []interface{}{
				map[string]interface{}{
					"content": map[string]interface{}{
						"parts": []interface{}{
							map[string]interface{}{"text": "ok"},
						},
					},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	mt := 200
	temp := 0.5
	client := &http.Client{}
	llmPost(client, server.URL, map[string]string{
		"Content-Type": "application/json",
	}, map[string]interface{}{
		"contents": []map[string]interface{}{
			{"parts": []map[string]string{{"text": "test"}}},
		},
		"generationConfig": map[string]interface{}{
			"maxOutputTokens": mt,
			"temperature":     temp,
		},
	}, "Google")
}

// --- Error handling ---

func TestLLMPost_Non2xx(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(429)
		w.Write([]byte(`{"error":{"message":"rate limited"}}`))
	}))
	defer server.Close()

	client := &http.Client{}
	_, err := llmPost(client, server.URL, map[string]string{}, map[string]interface{}{}, "TestProvider")
	if err == nil {
		t.Fatal("expected error for 429")
	}
	tErr, ok := err.(*TinyHumanError)
	if !ok {
		t.Fatalf("expected TinyHumanError, got %T", err)
	}
	if tErr.Status != 429 {
		t.Errorf("status = %d, want 429", tErr.Status)
	}
	if !strings.Contains(tErr.Message, "TestProvider") {
		t.Errorf("message should contain provider name, got %q", tErr.Message)
	}
	if !strings.Contains(tErr.Message, "rate limited") {
		t.Errorf("message should contain error detail, got %q", tErr.Message)
	}
}

func TestLLMPost_Non2xxPlainMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
		w.Write([]byte(`{"message":"internal error"}`))
	}))
	defer server.Close()

	client := &http.Client{}
	_, err := llmPost(client, server.URL, map[string]string{}, map[string]interface{}{}, "Provider")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "internal error") {
		t.Errorf("error should contain 'internal error', got %v", err)
	}
}

func TestExtractOpenAIResponse_MalformedNoChoices(t *testing.T) {
	_, err := extractOpenAIResponse(map[string]interface{}{})
	if err == nil || !strings.Contains(err.Error(), "no choices") {
		t.Fatalf("expected 'no choices' error, got %v", err)
	}
}

func TestExtractOpenAIResponse_MalformedNoMessage(t *testing.T) {
	data := map[string]interface{}{
		"choices": []interface{}{
			map[string]interface{}{"other": "data"},
		},
	}
	_, err := extractOpenAIResponse(data)
	if err == nil {
		t.Fatal("expected error for missing message")
	}
}

func TestExtractOpenAIResponse_MalformedNoContent(t *testing.T) {
	data := map[string]interface{}{
		"choices": []interface{}{
			map[string]interface{}{
				"message": map[string]interface{}{"role": "assistant"},
			},
		},
	}
	_, err := extractOpenAIResponse(data)
	if err == nil || !strings.Contains(err.Error(), "content") {
		t.Fatalf("expected 'content' error, got %v", err)
	}
}
