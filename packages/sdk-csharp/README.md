# TinyHumans.Sdk (C#)

C# SDK for TinyHumans/TinyHuman Neocortex memory APIs.

## Requirements

- .NET 8+ SDK

## Build

```bash
cd packages/sdk-csharp
make build
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

```csharp
using TinyHumans.Sdk;

using var client = new TinyHumansMemoryClient(token);

// Insert
var resp = await client.InsertMemoryAsync(new InsertMemoryParams
{
    Title = "title",
    Content = "content",
    Namespace = "ns",
});

// Query
var queryResp = await client.QueryMemoryAsync(new QueryMemoryParams
{
    Query = "search query",
    Namespace = "ns",
});
```

## Custom Model ID

```csharp
var client = new TinyHumansMemoryClient(token, "custom-model-id");
```

All requests include `X-Model-Id` header (default: `neocortex-mk1`).

## API Reference

### Core Memory

| Method | Endpoint | Description |
|--------|----------|-------------|
| `InsertMemoryAsync(params)` | POST `/memory/insert` | Ingest a document into memory |
| `QueryMemoryAsync(params)` | POST `/memory/query` | Query memory via RAG |
| `RecallMemoryAsync(params)` | POST `/memory/recall` | Recall context from master node |
| `RecallMemoriesAsync(params)` | POST `/memory/memories/recall` | Recall from Ebbinghaus bank |
| `DeleteMemoryAsync(params)` | POST `/memory/admin/delete` | Delete memory by namespace |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `ChatMemoryAsync(params)` | POST `/memory/chat` | Chat with DeltaNet memory cache |
| `ChatMemoryContextAsync(params)` | POST `/memory/conversations` | Chat with memory context |

### Interactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `InteractMemoryAsync(params)` | POST `/memory/interact` | Record entity interactions |
| `RecordInteractionsAsync(params)` | POST `/memory/interactions` | Record interaction signals |

### Advanced Recall

| Method | Endpoint | Description |
|--------|----------|-------------|
| `RecallThoughtsAsync(params)` | POST `/memory/memories/thoughts` | Generate reflective thoughts |
| `QueryMemoryContextAsync(params)` | POST `/memory/queries` | Query memory context |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `InsertDocumentAsync(params)` | POST `/memory/documents` | Insert a document |
| `InsertDocumentsBatchAsync(params)` | POST `/memory/documents/batch` | Batch insert documents |
| `ListDocumentsAsync(params)` | GET `/memory/documents` | List documents |
| `GetDocumentAsync(params)` | GET `/memory/documents/{id}` | Get document by ID |
| `DeleteDocumentAsync(id, ns)` | DELETE `/memory/documents/{id}` | Delete a document |

### Admin & Utility

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GetGraphSnapshotAsync(params)` | GET `/memory/admin/graph-snapshot` | Get graph snapshot |
| `GetIngestionJobAsync(jobId)` | GET `/memory/ingestion/jobs/{id}` | Get ingestion job status |
| `WaitForIngestionJobAsync(jobId, opts)` | -- | Poll until job completes |

## Example

`example/TinyHumans.Sdk.Example/Program.cs` exercises every method exposed by this SDK.

```bash
cd packages/sdk-csharp
dotnet run --project example/TinyHumans.Sdk.Example
```

## Tests

```bash
make test                # unit tests
make integration-test    # requires TINYHUMANS_TOKEN
```
