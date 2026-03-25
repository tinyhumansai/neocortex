// Example usage of the TinyHumans Go SDK.
//
// Set environment variables: TINYHUMANS_TOKEN, OPENAI_API_KEY
package main

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/tinyhumansai/neocortex-sdk-go/tinyhumans"
)

func main() {
	client, err := tinyhumans.NewClient(
		os.Getenv("TINYHUMANS_TOKEN"),
	)
	if err != nil {
		log.Fatal(err)
	}
	defer client.Close()

	// Ingest (upsert) a single memory
	now := float64(time.Now().Unix())
	result, err := client.IngestMemory(tinyhumans.MemoryItem{
		Key:        "user-preference-theme",
		Content:    "User prefers dark mode",
		Namespace:  "preferences",
		DocumentID: "pref-theme-001",
		Metadata:   map[string]interface{}{"source": "onboarding"},
		CreatedAt:  &now,
		UpdatedAt:  &now,
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Ingested: %d, Updated: %d, Errors: %d\n", result.Ingested, result.Updated, result.Errors)

	// Ingest multiple memories
	batch, err := client.IngestMemories([]tinyhumans.MemoryItem{
		{
			Key:        "go-sdk-example-1",
			Content:    "Go SDK can ingest multiple memories.",
			Namespace:  "preferences",
			DocumentID: "go-example-001",
			Metadata:   map[string]interface{}{"source": "go-example"},
		},
		{
			Key:        "go-sdk-example-2",
			Content:    "This is a second memory from the Go example.",
			Namespace:  "preferences",
			DocumentID: "go-example-002",
		},
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Batch Ingested: %d, Updated: %d, Errors: %d\n", batch.Ingested, batch.Updated, batch.Errors)

	// Get LLM context
	ctx, err := client.RecallMemory("preferences", "What is the user's preference for theme?", nil)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(ctx.Context)

	// Query memory via RAG
	queryData, err := client.QueryMemory("What is the user's preference for theme?", &tinyhumans.QueryMemoryOptions{
		Namespace: "preferences",
	})
	if err != nil {
		log.Printf("QueryMemory: %v", err)
	} else {
		fmt.Printf("QueryMemory: %v\n", queryData)
	}

	// (Optional) Query LLM with context
	openaiKey := os.Getenv("OPENAI_API_KEY")
	if openaiKey != "" {
		resp, err := client.RecallWithLLM(
			"What is the user's preference for theme?",
			openaiKey,
			tinyhumans.RecallWithLLMOptions{
				Provider: "openai",
				Model:    "gpt-4o-mini",
				Context:  ctx.Context,
			},
		)
		if err != nil {
			log.Fatal(err)
		}
		fmt.Println(resp.Text)
	}

	// --- Document operations ---

	// Insert a single document
	docResult, err := client.InsertDocument("Meeting Notes", "Discussed Q2 roadmap priorities.", "docs", "meeting-001", &tinyhumans.InsertDocumentOptions{
		SourceType: "note",
		Metadata:   map[string]interface{}{"team": "engineering"},
	})
	if err != nil {
		log.Printf("InsertDocument: %v", err)
	} else {
		fmt.Printf("InsertDocument: %v\n", docResult)
	}

	// Batch insert documents
	batchResult, err := client.InsertDocumentsBatch([]tinyhumans.DocumentItem{
		{Title: "Doc A", Content: "Content A", Namespace: "docs", DocumentID: "doc-a-001"},
		{Title: "Doc B", Content: "Content B", Namespace: "docs", DocumentID: "doc-b-001"},
	})
	if err != nil {
		log.Printf("InsertDocumentsBatch: %v", err)
	} else {
		fmt.Printf("InsertDocumentsBatch: %v\n", batchResult)
	}

	// List documents
	limit := 10
	docs, err := client.ListDocuments(&tinyhumans.ListDocumentsOptions{Namespace: "docs", Limit: &limit})
	if err != nil {
		log.Printf("ListDocuments: %v", err)
	} else {
		fmt.Printf("ListDocuments: %v\n", docs)
	}

	// Get/delete a single document by ID (set DOCUMENT_ID to demo these calls)
	documentID := os.Getenv("DOCUMENT_ID")
	if documentID != "" {
		docDetails, err := client.GetDocument(documentID, &tinyhumans.GetDocumentOptions{Namespace: "docs"})
		if err != nil {
			log.Printf("GetDocument: %v", err)
		} else {
			fmt.Printf("GetDocument: %v\n", docDetails)
		}

		deleteDocResp, err := client.DeleteDocument(documentID, "docs")
		if err != nil {
			log.Printf("DeleteDocument: %v", err)
		} else {
			fmt.Printf("DeleteDocument: %v\n", deleteDocResp)
		}
	}

	// --- Chat ---

	chatResp, err := client.ChatMemory([]tinyhumans.ChatMessage{
		{Role: "user", Content: "What were the Q2 priorities?"},
	}, nil)
	if err != nil {
		log.Printf("ChatMemory: %v", err)
	} else {
		fmt.Printf("ChatMemory: %v\n", chatResp)
	}

	chatCtxResp, err := client.ChatMemoryContext([]tinyhumans.ChatMessage{
		{Role: "user", Content: "Use memory context and summarize key priorities."},
	}, nil)
	if err != nil {
		log.Printf("ChatMemoryContext: %v", err)
	} else {
		fmt.Printf("ChatMemoryContext: %v\n", chatCtxResp)
	}

	// --- Interactions ---

	interactResp, err := client.InteractMemory("docs", []string{"Q2 roadmap"}, &tinyhumans.InteractMemoryOptions{
		Description: "User reviewed roadmap notes",
	})
	if err != nil {
		log.Printf("InteractMemory: %v", err)
	} else {
		fmt.Printf("InteractMemory: %v\n", interactResp)
	}

	recordResp, err := client.RecordInteractions("docs", []string{"Q2 roadmap"}, &tinyhumans.InteractMemoryOptions{
		Description: "Follow-up interaction recorded",
	})
	if err != nil {
		log.Printf("RecordInteractions: %v", err)
	} else {
		fmt.Printf("RecordInteractions: %v\n", recordResp)
	}

	// --- Advanced recall ---

	// Recall from Ebbinghaus bank
	memories, err := client.RecallMemories(&tinyhumans.RecallMemoriesOptions{Namespace: "docs"})
	if err != nil {
		log.Printf("RecallMemories: %v", err)
	} else {
		fmt.Printf("RecallMemories: %v\n", memories)
	}

	// Generate reflective thoughts
	thoughts, err := client.RecallThoughts(&tinyhumans.RecallThoughtsOptions{Namespace: "docs"})
	if err != nil {
		log.Printf("RecallThoughts: %v", err)
	} else {
		fmt.Printf("RecallThoughts: %v\n", thoughts)
	}

	// Query memory context
	queryCtx, err := client.QueryMemoryContext("Q2 roadmap", &tinyhumans.QueryMemoryContextOptions{Namespace: "docs"})
	if err != nil {
		log.Printf("QueryMemoryContext: %v", err)
	} else {
		fmt.Printf("QueryMemoryContext: %v\n", queryCtx)
	}

	// --- Admin & utility ---

	graphSnapshot, err := client.GetGraphSnapshot(&tinyhumans.GraphSnapshotOptions{Namespace: "docs"})
	if err != nil {
		log.Printf("GetGraphSnapshot: %v", err)
	} else {
		fmt.Printf("GetGraphSnapshot: %v\n", graphSnapshot)
	}

	syncResp, err := client.SyncMemory(nil)
	if err != nil {
		log.Printf("SyncMemory: %v", err)
	} else {
		fmt.Printf("SyncMemory: %v\n", syncResp)
	}

	// Get/wait ingestion job helpers (set INGESTION_JOB_ID to demo these calls)
	jobID := os.Getenv("INGESTION_JOB_ID")
	if jobID != "" {
		jobResp, err := client.GetIngestionJob(jobID)
		if err != nil {
			log.Printf("GetIngestionJob: %v", err)
		} else {
			fmt.Printf("GetIngestionJob: %v\n", jobResp)
		}

		waitResp, err := client.WaitForIngestionJob(jobID, &tinyhumans.WaitForIngestionJobOptions{
			TimeoutSeconds:      10,
			PollIntervalSeconds: 1,
		})
		if err != nil {
			log.Printf("WaitForIngestionJob: %v", err)
		} else {
			fmt.Printf("WaitForIngestionJob: %v\n", waitResp)
		}
	}

	// --- Cleanup ---

	// Delete by namespace
	_, err = client.DeleteMemory("preferences", &tinyhumans.DeleteMemoryOptions{
		DeleteAll: true,
	})
	if err != nil {
		log.Fatal(err)
	}
}
