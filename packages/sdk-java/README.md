# tinyhumans-sdk-java

Java SDK for TinyHumans/TinyHuman Neocortex memory APIs.

## Requirements

- Java 11+
- Gradle

## Build

```bash
cd packages/sdk-java
gradle build
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

```java
import xyz.tinyhumans.sdk.*;

try (TinyHumansMemoryClient client = new TinyHumansMemoryClient(token)) {
    // Insert
    client.insertMemory(new InsertMemoryParams("title", "content", "namespace"));

    // Query
    QueryMemoryResponse resp = client.queryMemory(
            new QueryMemoryParams("search query").setNamespace("namespace"));
}
```

## Custom Model ID

```java
TinyHumansMemoryClient client = new TinyHumansMemoryClient(token, "custom-model-id", baseUrl);
```

All requests include `X-Model-Id` header (default: `neocortex-mk1`).

## API Reference

### Core Memory

| Method | Endpoint | Description |
|--------|----------|-------------|
| `insertMemory(params)` | POST `/memory/insert` | Ingest a document into memory |
| `queryMemory(params)` | POST `/memory/query` | Query memory via RAG |
| `recallMemory(params)` | POST `/memory/recall` | Recall context from master node |
| `recallMemories(params)` | POST `/memory/memories/recall` | Recall from Ebbinghaus bank |
| `deleteMemory(params)` | POST `/memory/admin/delete` | Delete memory by namespace |

### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `chatMemory(params)` | POST `/memory/chat` | Chat with DeltaNet memory cache |
| `chatMemoryContext(params)` | POST `/memory/conversations` | Chat with memory context |

### Interactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `interactMemory(params)` | POST `/memory/interact` | Record entity interactions |
| `recordInteractions(params)` | POST `/memory/interactions` | Record interaction signals |

### Advanced Recall

| Method | Endpoint | Description |
|--------|----------|-------------|
| `recallThoughts(params)` | POST `/memory/memories/thoughts` | Generate reflective thoughts |
| `queryMemoryContext(params)` | POST `/memory/queries` | Query memory context |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `insertDocument(params)` | POST `/memory/documents` | Insert a document |
| `insertDocumentsBatch(params)` | POST `/memory/documents/batch` | Batch insert documents |
| `listDocuments(params)` | GET `/memory/documents` | List documents |
| `getDocument(params)` | GET `/memory/documents/{id}` | Get document by ID |
| `deleteDocument(id, ns)` | DELETE `/memory/documents/{id}` | Delete a document |

### Admin & Utility

| Method | Endpoint | Description |
|--------|----------|-------------|
| `getGraphSnapshot(params)` | GET `/memory/admin/graph-snapshot` | Get graph snapshot |
| `getIngestionJob(jobId)` | GET `/memory/ingestion/jobs/{id}` | Get ingestion job status |
| `waitForIngestionJob(jobId, opts)` | — | Poll until job completes |

## Example

`example/ExampleUsage.java` exercises every method exposed by this SDK.

Build and run:

```bash
cd packages/sdk-java
gradle build
cd example
javac -cp ../build/libs/tinyhumans-sdk-java-0.1.0.jar ExampleUsage.java
java -cp .:../build/libs/tinyhumans-sdk-java-0.1.0.jar ExampleUsage
```
