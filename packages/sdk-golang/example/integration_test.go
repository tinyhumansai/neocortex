//go:build integration

package main

import (
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/tinyhumansai/neocortex-sdk-go/tinyhumans"
)

func TestIntegration_InsertRecallDelete(t *testing.T) {
	token := os.Getenv("TINYHUMANS_TOKEN")
	if token == "" {
		t.Fatal("TINYHUMANS_TOKEN must be set for integration tests")
	}

	client, err := tinyhumans.NewClient(token)
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	defer client.Close()

	namespace := fmt.Sprintf("integration-test-%d", time.Now().UnixNano())

	// --- Insert ---
	now := float64(time.Now().Unix())
	insertResp, err := client.IngestMemory(tinyhumans.MemoryItem{
		Key:        "test-key-1",
		Content:    "The capital of France is Paris.",
		Namespace:  namespace,
		DocumentID: "integration-test-doc-1",
		Metadata:   map[string]interface{}{"source": "integration-test"},
		CreatedAt:  &now,
		UpdatedAt:  &now,
	})
	if err != nil {
		t.Fatalf("IngestMemory: %v", err)
	}
	t.Logf("Insert response: ingested=%d, updated=%d, errors=%d",
		insertResp.Ingested, insertResp.Updated, insertResp.Errors)
	if insertResp.Errors > 0 {
		t.Fatalf("expected 0 errors, got %d", insertResp.Errors)
	}

	// Give the backend a moment to index
	time.Sleep(2 * time.Second)

	// --- Recall ---
	recallResp, err := client.RecallMemory(namespace, "What is the capital of France?", nil)
	if err != nil {
		t.Fatalf("RecallMemory: %v", err)
	}
	t.Logf("Recall response: count=%d, context=%q", recallResp.Count, recallResp.Context)

	// --- Delete ---
	deleteResp, err := client.DeleteMemory(namespace, nil)
	if err != nil {
		t.Fatalf("DeleteMemory: %v", err)
	}
	t.Logf("Delete response: deleted=%d", deleteResp.Deleted)

	// Give the backend a moment to process deletion
	time.Sleep(1 * time.Second)

	// --- Verify deletion ---
	verifyResp, err := client.RecallMemory(namespace, "What is the capital of France?", nil)
	if err != nil {
		t.Fatalf("RecallMemory (verify): %v", err)
	}
	t.Logf("Verify after delete: count=%d", verifyResp.Count)
	if verifyResp.Count > 0 {
		t.Errorf("expected 0 items after deletion, got %d", verifyResp.Count)
	}
}
