package tinyhumans

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// --- ChatMemory ---

func TestChatMemory_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/memory/chat" {
			t.Errorf("path = %s, want /memory/chat", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("method = %s, want POST", r.Method)
		}

		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)

		msgs, ok := body["messages"].([]interface{})
		if !ok || len(msgs) != 1 {
			t.Fatalf("messages = %v", body["messages"])
		}

		w.Write([]byte(`{"data":{"response":"hello back"}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	data, err := c.ChatMemory([]ChatMessage{{Role: "user", Content: "hello"}}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["response"] != "hello back" {
		t.Errorf("response = %v", data["response"])
	}
}

func TestChatMemory_EmptyMessages(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.ChatMemory([]ChatMessage{}, nil)
	if err == nil {
		t.Fatal("expected error for empty messages")
	}
}

func TestChatMemory_EmptyRole(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.ChatMemory([]ChatMessage{{Role: "", Content: "hi"}}, nil)
	if err == nil {
		t.Fatal("expected error for empty role")
	}
}

func TestChatMemory_EmptyContent(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.ChatMemory([]ChatMessage{{Role: "user", Content: ""}}, nil)
	if err == nil {
		t.Fatal("expected error for empty content")
	}
}

func TestChatMemory_WithOptions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)

		if body["temperature"] != 0.7 {
			t.Errorf("temperature = %v, want 0.7", body["temperature"])
		}
		if body["maxTokens"] != float64(100) {
			t.Errorf("maxTokens = %v, want 100", body["maxTokens"])
		}

		w.Write([]byte(`{"data":{}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	temp := 0.7
	maxTok := 100
	c.ChatMemory(
		[]ChatMessage{{Role: "user", Content: "hi"}},
		&ChatMemoryOptions{Temperature: &temp, MaxTokens: &maxTok},
	)
}

// --- ChatMemoryContext ---

func TestChatMemoryContext_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/memory/conversations" {
			t.Errorf("path = %s, want /memory/conversations", r.URL.Path)
		}
		w.Write([]byte(`{"data":{"response":"ctx reply"}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	data, err := c.ChatMemoryContext([]ChatMessage{{Role: "user", Content: "hi"}}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["response"] != "ctx reply" {
		t.Errorf("response = %v", data["response"])
	}
}

func TestChatMemoryContext_EmptyMessages(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.ChatMemoryContext([]ChatMessage{}, nil)
	if err == nil {
		t.Fatal("expected error for empty messages")
	}
}

// --- InteractMemory ---

func TestInteractMemory_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/memory/interact" {
			t.Errorf("path = %s, want /memory/interact", r.URL.Path)
		}

		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)

		if body["namespace"] != "ns1" {
			t.Errorf("namespace = %v", body["namespace"])
		}
		entities := body["entityNames"].([]interface{})
		if len(entities) != 2 || entities[0] != "alice" {
			t.Errorf("entityNames = %v", body["entityNames"])
		}

		w.Write([]byte(`{"data":{"recorded":true}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	data, err := c.InteractMemory("ns1", []string{"alice", "bob"}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["recorded"] != true {
		t.Errorf("recorded = %v", data["recorded"])
	}
}

func TestInteractMemory_EmptyNamespace(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.InteractMemory("", []string{"alice"}, nil)
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}

func TestInteractMemory_EmptyEntityNames(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.InteractMemory("ns1", []string{}, nil)
	if err == nil {
		t.Fatal("expected error for empty entity_names")
	}
}

func TestInteractMemory_WithOptions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)

		if body["description"] != "met at conf" {
			t.Errorf("description = %v", body["description"])
		}
		if body["interactionLevel"] != "high" {
			t.Errorf("interactionLevel = %v", body["interactionLevel"])
		}

		w.Write([]byte(`{"data":{}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	ts := 1700000000.0
	c.InteractMemory("ns", []string{"alice"}, &InteractMemoryOptions{
		Description:      "met at conf",
		InteractionLevel: "high",
		Timestamp:        &ts,
	})
}

// --- RecordInteractions ---

func TestRecordInteractions_UsesCorrectPath(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/memory/interactions" {
			t.Errorf("path = %s, want /memory/interactions", r.URL.Path)
		}
		w.Write([]byte(`{"data":{}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	_, err := c.RecordInteractions("ns", []string{"alice"}, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
