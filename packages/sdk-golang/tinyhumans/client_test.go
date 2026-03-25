package tinyhumans

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// --- NewClient ---

func TestNewClient_EmptyToken(t *testing.T) {
	_, err := NewClient("")
	if err == nil || !strings.Contains(err.Error(), "token") {
		t.Fatalf("expected token error, got %v", err)
	}
}

func TestNewClient_WhitespaceToken(t *testing.T) {
	_, err := NewClient("   ")
	if err == nil {
		t.Fatal("expected error for whitespace-only token")
	}
}

func TestNewClient_Valid(t *testing.T) {
	c, err := NewClient("tok")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.baseURL != DefaultBaseURL {
		t.Errorf("baseURL = %q, want %q", c.baseURL, DefaultBaseURL)
	}
}

func TestNewClient_BaseURLParam(t *testing.T) {
	c, err := NewClient("tok", "https://custom.api.com/")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.baseURL != "https://custom.api.com" {
		t.Errorf("baseURL = %q, want trailing slash trimmed", c.baseURL)
	}
}

func TestNewClient_BaseURLEnvVar(t *testing.T) {
	os.Setenv(BaseURLEnv, "https://env.api.com")
	defer os.Unsetenv(BaseURLEnv)

	c, err := NewClient("tok")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.baseURL != "https://env.api.com" {
		t.Errorf("baseURL = %q, want env var value", c.baseURL)
	}
}

func TestNewClient_ParamOverridesEnv(t *testing.T) {
	os.Setenv(BaseURLEnv, "https://env.api.com")
	defer os.Unsetenv(BaseURLEnv)

	c, err := NewClient("tok", "https://param.api.com")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.baseURL != "https://param.api.com" {
		t.Errorf("baseURL = %q, want param value", c.baseURL)
	}
}

func TestNewClient_DefaultModelID(t *testing.T) {
	c, err := NewClient("tok")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.modelID != DefaultModelID {
		t.Errorf("modelID = %q, want %q", c.modelID, DefaultModelID)
	}
}

func TestNewClientWithModelID(t *testing.T) {
	c, err := NewClientWithModelID("tok", "custom-model")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.modelID != "custom-model" {
		t.Errorf("modelID = %q, want custom-model", c.modelID)
	}
}

func TestNewClientWithModelID_EmptyDefaultsToNeocortex(t *testing.T) {
	c, err := NewClientWithModelID("tok", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if c.modelID != DefaultModelID {
		t.Errorf("modelID = %q, want %q", c.modelID, DefaultModelID)
	}
}

func TestSend_XModelIdHeader(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("X-Model-Id"); got != DefaultModelID {
			t.Errorf("X-Model-Id = %q, want %q", got, DefaultModelID)
		}
		w.Write([]byte(`{"data":{}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	c.send("POST", "/test", map[string]interface{}{})
}

// --- Helper to create a client pointing at a test server ---

func testClient(t *testing.T, server *httptest.Server) *Client {
	t.Helper()
	c, err := NewClient("test-token", server.URL)
	if err != nil {
		t.Fatalf("failed to create test client: %v", err)
	}
	return c
}

func jsonResponse(data interface{}) string {
	b, _ := json.Marshal(map[string]interface{}{"data": data})
	return string(b)
}

// --- sendGet / sendDelete ---

func TestSendGet_QueryParams(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Errorf("method = %s, want GET", r.Method)
		}
		if r.URL.Query().Get("namespace") != "ns1" {
			t.Errorf("namespace = %q, want ns1", r.URL.Query().Get("namespace"))
		}
		if r.URL.Query().Get("limit") != "10" {
			t.Errorf("limit = %q, want 10", r.URL.Query().Get("limit"))
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Error("missing Authorization header")
		}
		if r.Header.Get("X-Model-Id") != DefaultModelID {
			t.Errorf("X-Model-Id = %q", r.Header.Get("X-Model-Id"))
		}
		w.Write([]byte(`{"data":{"items":[]}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	data, err := c.sendGet("/test", map[string]string{"namespace": "ns1", "limit": "10"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["items"] == nil {
		t.Error("expected items in response")
	}
}

func TestSendGet_NilParams(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.RawQuery != "" {
			t.Errorf("expected no query params, got %q", r.URL.RawQuery)
		}
		w.Write([]byte(`{"data":{}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	_, err := c.sendGet("/test", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestSendDelete_QueryParams(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "DELETE" {
			t.Errorf("method = %s, want DELETE", r.Method)
		}
		if r.URL.Query().Get("namespace") != "ns1" {
			t.Errorf("namespace = %q, want ns1", r.URL.Query().Get("namespace"))
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Error("missing Authorization header")
		}
		if r.Header.Get("X-Model-Id") != DefaultModelID {
			t.Errorf("X-Model-Id = %q", r.Header.Get("X-Model-Id"))
		}
		w.Write([]byte(`{"data":{"deleted":true}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	data, err := c.sendDelete("/test", map[string]string{"namespace": "ns1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["deleted"] != true {
		t.Error("expected deleted=true in response")
	}
}

// --- IngestMemory / IngestMemories ---

func TestIngestMemory_Completed(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/memory/insert" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Error("missing or wrong Authorization header")
		}

		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		if body["title"] != "key1" {
			t.Errorf("title = %v, want key1", body["title"])
		}
		if body["sourceType"] != "doc" {
			t.Errorf("sourceType = %v, want doc", body["sourceType"])
		}

		w.WriteHeader(200)
		w.Write([]byte(jsonResponse(map[string]string{"status": "completed"})))
	}))
	defer server.Close()

	c := testClient(t, server)
	resp, err := c.IngestMemory(MemoryItem{Key: "key1", Content: "hello", Namespace: "ns", DocumentID: "doc-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Ingested != 1 {
		t.Errorf("Ingested = %d, want 1", resp.Ingested)
	}
}

func TestIngestMemory_Updated(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(jsonResponse(map[string]string{"status": "updated"})))
	}))
	defer server.Close()

	c := testClient(t, server)
	resp, err := c.IngestMemory(MemoryItem{Key: "key1", Content: "hello", Namespace: "ns", DocumentID: "doc-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Updated != 1 {
		t.Errorf("Updated = %d, want 1", resp.Updated)
	}
}

func TestIngestMemory_ServerError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(500)
		w.Write([]byte(`{"error":"server down"}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	resp, err := c.IngestMemory(MemoryItem{Key: "key1", Content: "hello", Namespace: "ns", DocumentID: "doc-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Errors != 1 {
		t.Errorf("Errors = %d, want 1", resp.Errors)
	}
}

func TestIngestMemories_EmptyList(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.IngestMemories([]MemoryItem{})
	if err == nil {
		t.Fatal("expected error for empty items")
	}
}

func TestIngestMemory_MissingDocumentID(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.IngestMemory(MemoryItem{Key: "k", Content: "c", Namespace: "ns"})
	if err == nil {
		t.Fatal("expected error for missing documentId")
	}
	if !strings.Contains(err.Error(), "documentId") {
		t.Errorf("error should mention documentId, got: %v", err)
	}
}

func TestIngestMemory_InvalidTimestamp(t *testing.T) {
	c, _ := NewClient("tok")
	neg := -1.0
	_, err := c.IngestMemory(MemoryItem{Key: "k", Content: "c", Namespace: "ns", DocumentID: "doc-1", CreatedAt: &neg})
	if err == nil {
		t.Fatal("expected validation error for negative timestamp")
	}
}

func TestIngestMemory_RequestBody(t *testing.T) {
	ts := 1700000000.0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var m map[string]interface{}
		json.Unmarshal(body, &m)

		if m["title"] != "mykey" {
			t.Errorf("title = %v", m["title"])
		}
		if m["content"] != "mycontent" {
			t.Errorf("content = %v", m["content"])
		}
		if m["namespace"] != "myns" {
			t.Errorf("namespace = %v", m["namespace"])
		}
		if m["sourceType"] != "doc" {
			t.Errorf("sourceType = %v", m["sourceType"])
		}
		if m["createdAt"] != ts {
			t.Errorf("createdAt = %v", m["createdAt"])
		}
		if m["updatedAt"] != ts {
			t.Errorf("updatedAt = %v", m["updatedAt"])
		}
		meta, ok := m["metadata"].(map[string]interface{})
		if !ok || meta["src"] != "test" {
			t.Errorf("metadata = %v", m["metadata"])
		}

		w.Write([]byte(jsonResponse(map[string]string{"status": "completed"})))
	}))
	defer server.Close()

	c := testClient(t, server)
	c.IngestMemory(MemoryItem{
		Key:        "mykey",
		Content:    "mycontent",
		Namespace:  "myns",
		DocumentID: "doc-1",
		Metadata:   map[string]interface{}{"src": "test"},
		CreatedAt:  &ts,
		UpdatedAt:  &ts,
	})
}

func TestIngestMemory_NilMetadataBecomesEmptyMap(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var m map[string]interface{}
		json.Unmarshal(body, &m)
		meta, ok := m["metadata"].(map[string]interface{})
		if !ok {
			t.Error("metadata should be an empty object, not nil")
		}
		if len(meta) != 0 {
			t.Errorf("metadata should be empty, got %v", meta)
		}
		w.Write([]byte(jsonResponse(map[string]string{"status": "completed"})))
	}))
	defer server.Close()

	c := testClient(t, server)
	c.IngestMemory(MemoryItem{Key: "k", Content: "c", Namespace: "ns", DocumentID: "doc-1"})
}

// --- RecallMemory ---

func TestRecallMemory_WithChunks(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"data": map[string]interface{}{
				"context": map[string]interface{}{
					"chunks": []interface{}{
						map[string]interface{}{
							"id":      "chunk-1",
							"content": "content-1",
						},
						map[string]interface{}{
							"document_id": "chunk-2",
							"text":        "content-2",
						},
					},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := testClient(t, server)
	resp, err := c.RecallMemory("ns", "query", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(resp.Items))
	}
	if resp.Items[0].Key != "chunk-1" {
		t.Errorf("item[0].Key = %q, want chunk-1", resp.Items[0].Key)
	}
	if resp.Items[0].Content != "content-1" {
		t.Errorf("item[0].Content = %q", resp.Items[0].Content)
	}
	if resp.Items[1].Key != "chunk-2" {
		t.Errorf("item[1].Key = %q, want chunk-2 (from document_id)", resp.Items[1].Key)
	}
	if resp.Items[1].Content != "content-2" {
		t.Errorf("item[1].Content = %q, want content-2 (from text)", resp.Items[1].Content)
	}
}

func TestRecallMemory_WithLLMContextMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"data": map[string]interface{}{
				"llmContextMessage": "pre-built context string",
				"context": map[string]interface{}{
					"chunks": []interface{}{
						map[string]interface{}{"id": "c1", "content": "x"},
					},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := testClient(t, server)
	resp, err := c.RecallMemory("ns", "query", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Context != "pre-built context string" {
		t.Errorf("Context = %q, want llmContextMessage value", resp.Context)
	}
}

func TestRecallMemory_ContextBuiltFromItems(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"data": map[string]interface{}{
				"context": map[string]interface{}{
					"chunks": []interface{}{
						map[string]interface{}{"id": "k1", "content": "c1"},
						map[string]interface{}{"id": "k2", "content": "c2"},
					},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := testClient(t, server)
	resp, err := c.RecallMemory("myns", "query", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := "[myns:k1]\nc1\n\n[myns:k2]\nc2"
	if resp.Context != expected {
		t.Errorf("Context = %q, want %q", resp.Context, expected)
	}
}

func TestRecallMemory_NumChunksTruncation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		chunks := make([]interface{}, 5)
		for i := range chunks {
			chunks[i] = map[string]interface{}{"id": "k", "content": "c"}
		}
		resp := map[string]interface{}{
			"data": map[string]interface{}{
				"context": map[string]interface{}{"chunks": chunks},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	c := testClient(t, server)
	resp, err := c.RecallMemory("ns", "q", &RecallMemoryOptions{NumChunks: 2})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(resp.Items) != 2 {
		t.Errorf("expected 2 items after truncation, got %d", len(resp.Items))
	}
}

func TestRecallMemory_DefaultNumChunks(t *testing.T) {
	var receivedMaxChunks float64
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		receivedMaxChunks = body["maxChunks"].(float64)
		w.Write([]byte(`{"data":{}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	c.RecallMemory("ns", "q", nil)
	if receivedMaxChunks != 10 {
		t.Errorf("default maxChunks = %v, want 10", receivedMaxChunks)
	}
}

// --- DeleteMemory ---

func TestDeleteMemory_WithNodesDeleted(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/memory/admin/delete" {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		w.Write([]byte(jsonResponse(map[string]interface{}{"nodesDeleted": 5})))
	}))
	defer server.Close()

	c := testClient(t, server)
	resp, err := c.DeleteMemory("ns", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Deleted != 5 {
		t.Errorf("Deleted = %d, want 5", resp.Deleted)
	}
}

func TestDeleteMemory_EmptyData(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"data":{}}`))
	}))
	defer server.Close()

	c := testClient(t, server)
	resp, err := c.DeleteMemory("ns", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Deleted != 0 {
		t.Errorf("Deleted = %d, want 0", resp.Deleted)
	}
}

// --- RecallWithLLM ---

func TestRecallWithLLM_WithContext(t *testing.T) {
	llmServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		msgs := body["messages"].([]interface{})
		if len(msgs) != 2 {
			t.Errorf("expected 2 messages (system+user), got %d", len(msgs))
		}
		resp := map[string]interface{}{
			"choices": []interface{}{
				map[string]interface{}{
					"message": map[string]interface{}{
						"content": "llm answer",
					},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer llmServer.Close()

	c, _ := NewClient("tok")
	resp, err := c.RecallWithLLM("prompt", "api-key", RecallWithLLMOptions{
		Context: "my context",
		URL:     llmServer.URL,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Text != "llm answer" {
		t.Errorf("Text = %q, want 'llm answer'", resp.Text)
	}
}

func TestRecallWithLLM_NoContextNoNamespace(t *testing.T) {
	c, _ := NewClient("tok")
	_, err := c.RecallWithLLM("prompt", "api-key", RecallWithLLMOptions{})
	if err == nil {
		t.Fatal("expected error when no context and no namespace")
	}
	if !strings.Contains(err.Error(), "namespace") {
		t.Errorf("error should mention namespace, got: %v", err)
	}
}

func TestRecallWithLLM_FetchesContextFromRecall(t *testing.T) {
	apiServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"data": map[string]interface{}{
				"llmContextMessage": "fetched context",
				"context":           map[string]interface{}{"chunks": []interface{}{}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer apiServer.Close()

	llmServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		msgs := body["messages"].([]interface{})
		sysMsg := msgs[0].(map[string]interface{})
		if sysMsg["content"] != "fetched context" {
			t.Errorf("system message = %v, want 'fetched context'", sysMsg["content"])
		}
		resp := map[string]interface{}{
			"choices": []interface{}{
				map[string]interface{}{
					"message": map[string]interface{}{"content": "response"},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer llmServer.Close()

	c := testClient(t, apiServer)
	resp, err := c.RecallWithLLM("prompt", "api-key", RecallWithLLMOptions{
		Namespace: "ns",
		URL:       llmServer.URL,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Text != "response" {
		t.Errorf("Text = %q", resp.Text)
	}
}

func TestRecallWithLLM_DefaultProviderAndModel(t *testing.T) {
	var receivedModel string
	llmServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]interface{}
		json.NewDecoder(r.Body).Decode(&body)
		receivedModel = body["model"].(string)
		resp := map[string]interface{}{
			"choices": []interface{}{
				map[string]interface{}{
					"message": map[string]interface{}{"content": "ok"},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer llmServer.Close()

	c, _ := NewClient("tok")
	c.RecallWithLLM("prompt", "key", RecallWithLLMOptions{
		Context: "ctx",
		URL:     llmServer.URL,
	})
	if receivedModel != "gpt-4o-mini" {
		t.Errorf("default model = %q, want gpt-4o-mini", receivedModel)
	}
}

// --- parseResponse ---

func TestParseResponse_NonJSON(t *testing.T) {
	resp := &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader("not json")),
	}
	c, _ := NewClient("tok")
	_, err := c.parseResponse(resp)
	if err == nil {
		t.Fatal("expected error for non-JSON response")
	}
	tErr, ok := err.(*TinyHumansError)
	if !ok {
		t.Fatalf("expected TinyHumansError, got %T", err)
	}
	if !strings.Contains(tErr.Message, "non-JSON") {
		t.Errorf("message should contain 'non-JSON', got %q", tErr.Message)
	}
}

func TestParseResponse_Non2xx(t *testing.T) {
	body := `{"error":"forbidden"}`
	resp := &http.Response{
		StatusCode: 403,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	c, _ := NewClient("tok")
	_, err := c.parseResponse(resp)
	if err == nil {
		t.Fatal("expected error for 403 response")
	}
	tErr, ok := err.(*TinyHumansError)
	if !ok {
		t.Fatalf("expected TinyHumansError, got %T", err)
	}
	if tErr.Status != 403 {
		t.Errorf("status = %d, want 403", tErr.Status)
	}
	if tErr.Message != "forbidden" {
		t.Errorf("message = %q, want 'forbidden'", tErr.Message)
	}
}

func TestParseResponse_ValidResponse(t *testing.T) {
	body := `{"data":{"key":"value"}}`
	resp := &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	c, _ := NewClient("tok")
	data, err := c.parseResponse(resp)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if data["key"] != "value" {
		t.Errorf("data[key] = %v, want 'value'", data["key"])
	}
}

func TestParseResponse_NoDataField(t *testing.T) {
	body := `{"other":"thing"}`
	resp := &http.Response{
		StatusCode: 200,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	c, _ := NewClient("tok")
	data, err := c.parseResponse(resp)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(data) != 0 {
		t.Errorf("expected empty map, got %v", data)
	}
}

// --- strVal ---

func TestStrVal(t *testing.T) {
	m := map[string]interface{}{
		"str": "hello",
		"num": 42,
		"nil": nil,
	}
	if got := strVal(m, "str"); got != "hello" {
		t.Errorf("strVal(str) = %q", got)
	}
	if got := strVal(m, "num"); got != "" {
		t.Errorf("strVal(num) = %q, want empty", got)
	}
	if got := strVal(m, "missing"); got != "" {
		t.Errorf("strVal(missing) = %q, want empty", got)
	}
	if got := strVal(m, "nil"); got != "" {
		t.Errorf("strVal(nil) = %q, want empty", got)
	}
}
