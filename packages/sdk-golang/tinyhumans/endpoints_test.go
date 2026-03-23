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

// --- RecallMemories ---

func TestRecallMemories_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/memory/memories/recall" {
			t.Errorf("path = %s, want /memory/memories/recall", r.URL.Path)
		}
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		if body["namespace"] != "ns1" {
			t.Errorf("namespace = %v", body["namespace"])
		}
		w.Write([]byte(`{"data":{"memories":[]}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	data, err := c.RecallMemories(&RecallMemoriesOptions{Namespace: "ns1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["memories"] == nil {
		t.Error("expected memories in response")
	}
}

func TestRecallMemories_NilOpts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		if len(body) != 0 {
			t.Errorf("expected empty body, got %v", body)
		}
		w.Write([]byte(`{"data":{}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	_, err := c.RecallMemories(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// --- RecallThoughts ---

func TestRecallThoughts_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/memory/memories/thoughts" {
			t.Errorf("path = %s, want /memory/memories/thoughts", r.URL.Path)
		}
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		if body["namespace"] != "ns1" {
			t.Errorf("namespace = %v", body["namespace"])
		}
		if body["thoughtPrompt"] != "reflect on today" {
			t.Errorf("thoughtPrompt = %v", body["thoughtPrompt"])
		}
		w.Write([]byte(`{"data":{"thoughts":["thought1"]}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	maxC := 5
	data, err := c.RecallThoughts(&RecallThoughtsOptions{
		Namespace:     "ns1",
		MaxChunks:     &maxC,
		ThoughtPrompt: "reflect on today",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["thoughts"] == nil {
		t.Error("expected thoughts in response")
	}
}

func TestRecallThoughts_NilOpts(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":{}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	_, err := c.RecallThoughts(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

// --- QueryMemoryContext ---

func TestQueryMemoryContext_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/memory/queries" {
			t.Errorf("path = %s, want /memory/queries", r.URL.Path)
		}
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		if body["query"] != "what happened?" {
			t.Errorf("query = %v", body["query"])
		}
		if body["namespace"] != "ns1" {
			t.Errorf("namespace = %v", body["namespace"])
		}
		w.Write([]byte(`{"data":{"context":"relevant info"}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	data, err := c.QueryMemoryContext("what happened?", &QueryMemoryContextOptions{Namespace: "ns1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["context"] != "relevant info" {
		t.Errorf("context = %v", data["context"])
	}
}

func TestQueryMemoryContext_EmptyQuery(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.QueryMemoryContext("", nil)
	if err == nil {
		t.Fatal("expected error for empty query")
	}
}

func TestQueryMemoryContext_WithAllOptions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)

		if body["includeReferences"] != true {
			t.Errorf("includeReferences = %v", body["includeReferences"])
		}
		if body["maxChunks"] != float64(5) {
			t.Errorf("maxChunks = %v", body["maxChunks"])
		}
		docIDs := body["documentIds"].([]interface{})
		if len(docIDs) != 1 || docIDs[0] != "doc1" {
			t.Errorf("documentIds = %v", body["documentIds"])
		}

		w.Write([]byte(`{"data":{}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	incRef := true
	maxC := 5
	c.QueryMemoryContext("q", &QueryMemoryContextOptions{
		Namespace:         "ns",
		IncludeReferences: &incRef,
		MaxChunks:         &maxC,
		DocumentIDs:       []string{"doc1"},
	})
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

// --- InsertDocument ---

func TestInsertDocument_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/memory/documents" {
			t.Errorf("path = %s, want /memory/documents", r.URL.Path)
		}
		if r.Method != "POST" {
			t.Errorf("method = %s, want POST", r.Method)
		}

		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		if body["title"] != "doc1" {
			t.Errorf("title = %v", body["title"])
		}
		if body["content"] != "content1" {
			t.Errorf("content = %v", body["content"])
		}
		if body["namespace"] != "ns1" {
			t.Errorf("namespace = %v", body["namespace"])
		}

		w.Write([]byte(`{"data":{"id":"doc-123"}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	data, err := c.InsertDocument("doc1", "content1", "ns1", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["id"] != "doc-123" {
		t.Errorf("id = %v", data["id"])
	}
}

func TestInsertDocument_EmptyTitle(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.InsertDocument("", "content", "ns", nil)
	if err == nil {
		t.Fatal("expected error for empty title")
	}
}

func TestInsertDocument_WithOptions(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		if body["sourceType"] != "pdf" {
			t.Errorf("sourceType = %v", body["sourceType"])
		}
		if body["documentId"] != "custom-id" {
			t.Errorf("documentId = %v", body["documentId"])
		}
		w.Write([]byte(`{"data":{}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	c.InsertDocument("t", "c", "ns", &InsertDocumentOptions{
		SourceType: "pdf",
		DocumentID: "custom-id",
	})
}

// --- InsertDocumentsBatch ---

func TestInsertDocumentsBatch_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/memory/documents/batch" {
			t.Errorf("path = %s, want /memory/documents/batch", r.URL.Path)
		}
		w.Write([]byte(`{"data":{"inserted":2}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	data, err := c.InsertDocumentsBatch([]DocumentItem{
		{Title: "d1", Content: "c1", Namespace: "ns"},
		{Title: "d2", Content: "c2", Namespace: "ns"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["inserted"] != float64(2) {
		t.Errorf("inserted = %v", data["inserted"])
	}
}

func TestInsertDocumentsBatch_EmptyItems(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.InsertDocumentsBatch([]DocumentItem{})
	if err == nil {
		t.Fatal("expected error for empty items")
	}
}

func TestInsertDocumentsBatch_MissingTitle(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.InsertDocumentsBatch([]DocumentItem{{Content: "c", Namespace: "ns"}})
	if err == nil {
		t.Fatal("expected error for missing title")
	}
}

// --- ListDocuments ---

func TestListDocuments_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("method = %s, want GET", r.Method)
		}
		if r.URL.Path != "/memory/documents" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if r.URL.Query().Get("namespace") != "ns1" {
			t.Errorf("namespace = %q", r.URL.Query().Get("namespace"))
		}
		if r.URL.Query().Get("limit") != "10" {
			t.Errorf("limit = %q", r.URL.Query().Get("limit"))
		}
		w.Write([]byte(`{"data":{"documents":[]}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	limit := 10
	data, err := c.ListDocuments(&ListDocumentsOptions{Namespace: "ns1", Limit: &limit})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["documents"] == nil {
		t.Error("expected documents in response")
	}
}

// --- GetDocument ---

func TestGetDocument_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("method = %s, want GET", r.Method)
		}
		if r.URL.Path != "/memory/documents/doc-123" {
			t.Errorf("path = %s", r.URL.Path)
		}
		w.Write([]byte(`{"data":{"id":"doc-123","title":"test"}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	data, err := c.GetDocument("doc-123", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["title"] != "test" {
		t.Errorf("title = %v", data["title"])
	}
}

func TestGetDocument_EmptyID(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.GetDocument("", nil)
	if err == nil {
		t.Fatal("expected error for empty document_id")
	}
}

// --- DeleteDocument ---

func TestDeleteDocument_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "DELETE" {
			t.Errorf("method = %s, want DELETE", r.Method)
		}
		if r.URL.Path != "/memory/documents/doc-123" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if r.URL.Query().Get("namespace") != "ns1" {
			t.Errorf("namespace = %q", r.URL.Query().Get("namespace"))
		}
		w.Write([]byte(`{"data":{"deleted":true}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	data, err := c.DeleteDocument("doc-123", "ns1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["deleted"] != true {
		t.Errorf("deleted = %v", data["deleted"])
	}
}

func TestDeleteDocument_EmptyID(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.DeleteDocument("", "ns")
	if err == nil {
		t.Fatal("expected error for empty document_id")
	}
}

func TestDeleteDocument_EmptyNamespace(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.DeleteDocument("doc-1", "")
	if err == nil {
		t.Fatal("expected error for empty namespace")
	}
}
