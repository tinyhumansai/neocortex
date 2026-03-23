# tinyhumans Go SDK

Go client for TinyHumans Neocortex memory APIs.

## Requirements

- Go 1.21+

## Install

```bash
go get github.com/tinyhumansai/neocortex-sdk-go
```

## Get an API key

1. Sign in to your TinyHumans account.
2. Create a server API key in the TinyHumans dashboard.
3. Export it before running examples:

```bash
export TINYHUMANS_TOKEN="your_api_key"
# optional custom API URL
export TINYHUMANS_BASE_URL="https://api.tinyhumans.ai"
```

## Quick start

```go
package main

import (
  "fmt"
  "log"
  "os"

  "github.com/tinyhumansai/neocortex-sdk-go/tinyhumans"
)

func main() {
  client, err := tinyhumans.NewClient(os.Getenv("TINYHUMANS_TOKEN"))
  if err != nil {
    log.Fatal(err)
  }
  defer client.Close()

  _, err = client.IngestMemory(tinyhumans.MemoryItem{
    Key:       "user-preference-theme",
    Content:   "User prefers dark mode",
    Namespace: "preferences",
  })
  if err != nil {
    log.Fatal(err)
  }

  ctx, err := client.RecallMemory("preferences", "What does the user prefer?", nil)
  if err != nil {
    log.Fatal(err)
  }

  fmt.Println(ctx.Context)
}
```

## Full route example

`example/main.go` exercises all exported client methods. Run it with:

```bash
cd packages/sdk-golang
go run ./example/main.go
```

## API Reference

### Client constructors

| Function | Description |
|----------|-------------|
| `NewClient(token, baseURL...)` | Create client with default model ID |
| `NewClientWithModelID(token, modelID, baseURL...)` | Create client with custom model ID |
| `Close()` | Release idle HTTP connections |

Base URL resolution: argument → `TINYHUMANS_BASE_URL` env → `https://api.tinyhumans.ai`.

### Core Memory

| Method | Endpoint | Description |
|--------|----------|-------------|
| `IngestMemory(item)` | POST `/v1/memory/insert` | Ingest a single memory item |
| `IngestMemories(items)` | POST `/v1/memory/insert` | Batch ingest memory items |
| `RecallMemory(namespace, prompt, opts)` | POST `/v1/memory/recall` | Recall LLM-friendly context |
| `DeleteMemory(namespace, opts)` | POST `/v1/memory/admin/delete` | Delete memory by namespace |
| `RecallWithLLM(prompt, apiKey, opts)` | — | Query LLM with memory context |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `ChatMemory(messages, opts)` | POST `/memory/chat` | Chat with DeltaNet memory cache |
| `ChatMemoryContext(messages, opts)` | POST `/memory/conversations` | Chat with memory context |

### Interactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `InteractMemory(namespace, entityNames, opts)` | POST `/memory/interact` | Record entity interaction signals |
| `RecordInteractions(namespace, entityNames, opts)` | POST `/memory/interactions` | Record interactions (mirrored) |

### Advanced Recall

| Method | Endpoint | Description |
|--------|----------|-------------|
| `RecallMemories(opts)` | POST `/memory/memories/recall` | Recall from Ebbinghaus memory bank |
| `RecallThoughts(opts)` | POST `/memory/memories/thoughts` | Generate reflective thoughts |
| `QueryMemoryContext(query, opts)` | POST `/memory/queries` | Query memory context |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `InsertDocument(title, content, namespace, opts)` | POST `/memory/documents` | Insert a single document |
| `InsertDocumentsBatch(items)` | POST `/memory/documents/batch` | Batch insert documents |
| `ListDocuments(opts)` | GET `/memory/documents` | List ingested documents |
| `GetDocument(documentID, opts)` | GET `/memory/documents/{id}` | Get document details |
| `DeleteDocument(documentID, namespace)` | DELETE `/memory/documents/{id}` | Delete a document |

### Admin & Utility

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GetGraphSnapshot(opts)` | GET `/memory/admin/graph-snapshot` | Get admin graph snapshot |
| `SyncMemory(opts)` | POST `/memory/sync` | Sync memory files |
| `GetIngestionJob(jobID)` | GET `/memory/ingestion/jobs/{id}` | Get ingestion job status |
| `WaitForIngestionJob(jobID, opts)` | — | Poll job until terminal state |

### LLM providers

`RecallWithLLM` supports:
- OpenAI (`provider: "openai"`)
- Anthropic (`"anthropic"`)
- Google (`"google"`)
- Custom OpenAI-compatible URL (`URL` option)

## Testing

```bash
cd packages/sdk-golang
make test        # run all unit tests
make test-cover  # with coverage report
make check       # build + vet + test
```
