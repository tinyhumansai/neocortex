# tinyhumansai (Python SDK)

Python SDK for TinyHumans Neocortex memory APIs (core memory, documents, mirrored routes, ingestion jobs).

## Requirements

- Python 3.9+

## Install

```bash
pip install tinyhumansai
```

For local development from this repo:

```bash
cd packages/sdk-python
uv sync --group dev
```

## Get an API key

Export credentials before running examples:

```bash
export TINYHUMANS_TOKEN="your_api_key"

# Optional overrides:
export TINYHUMANS_MODEL_ID="neocortex-mk1"
export TINYHUMANS_BASE_URL="https://api.tinyhumans.ai"
```

## Quick start

```python
import time
import tinyhumansai as api

client = api.TinyHumansMemoryClient(token="YOUR_API_KEY")

# Insert (documents API) - document_id is required
namespace = "preferences"
document_id = f"pref-{int(time.time())}"
client.insert_document(
    title="User preference",
    content="User prefers dark mode",
    namespace=namespace,
    document_id=document_id,
)

# Recall context for an LLM prompt
ctx = client.recall_memory(
    namespace=namespace,
    prompt="What does the user prefer?",
    num_chunks=10,
)
print(ctx.context)
```

Notes:
- The legacy `ingest_memory` route maps `key` to the backend `documentId`.

## Full route example

`example.py` exercises core + documents + mirrored routes + ingestion job polling + cleanup.

```bash
cd packages/sdk-python
python3 example.py
```

## API reference

### `TinyHumansMemoryClient(token, model_id="neocortex-mk1", base_url=None)`

| Param | Type | Required | Description |
|------|------|----------|-------------|
| `token` | `str` | ✓ | API key or JWT |
| `model_id` | `str` | | Sent as `X-Model-Id` |
| `base_url` | `str \| None` | | Override API URL. If not set, uses `TINYHUMANS_BASE_URL` env or SDK default |

### `client.ingest_memory(item={...})`

Legacy ingest route. **POST /v1/memory/insert**

The SDK maps:
- `key` → backend `documentId` (and `title`)

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `str` | ✓ | Unique key within the namespace |
| `content` | `str` | ✓ | Memory content |
| `namespace` | `str` | ✓ | Namespace |
| `metadata` | `dict` | | Optional metadata |
| `created_at` | `float \| int` | | Unix timestamp (seconds) |
| `updated_at` | `float \| int` | | Unix timestamp (seconds) |

Returns `IngestMemoryResponse` (`ingested`, `updated`, `errors`).

### `client.recall_memory(namespace, prompt, num_chunks=10, key=None, keys=None)`

Query memory and return an LLM-friendly context string. **POST /v1/memory/query**

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `namespace` | `str` | ✓ | Namespace |
| `prompt` | `str` | ✓ | Query prompt |
| `num_chunks` | `int` | | Max chunks to retrieve |
| `key` | `str \| None` | | Optional single document id filter |
| `keys` | `list[str] \| None` | | Optional document id filters |

Returns `GetContextResponse` (`context`, `items`, `count`).

### `client.delete_memory(namespace, delete_all=True)`

Delete memory (namespace-scoped). **POST /v1/memory/admin/delete**

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `namespace` | `str` | ✓ | Namespace |
| `delete_all` | `bool` | ✓ | Must be `True` to confirm deletion |

Returns `DeleteMemoryResponse` (`deleted`).

### `client.insert_document(...)`

Insert a single document. **POST /v1/memory/documents**

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `str` | ✓ | Document title |
| `content` | `str` | ✓ | Document content |
| `namespace` | `str` | ✓ | Namespace |
| `document_id` | `str` | ✓ | Unique document ID |
| `source_type` | `str \| None` | | e.g. `"doc"` |
| `metadata` | `dict \| None` | | Optional metadata |
| `priority` | `str \| None` | | Optional priority |
| `created_at` | `float \| None` | | Unix timestamp (seconds) |
| `updated_at` | `float \| None` | | Unix timestamp (seconds) |

Returns the backend `data` dict.

### `client.insert_documents_batch(items=[...])`

Insert multiple documents in one call. **POST /v1/memory/documents/batch**

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `list[dict]` | ✓ | Each item must include `title`, `content`, `namespace`, and `documentId` (or `document_id`) |

Returns the backend `data` dict.

### `client.list_documents(namespace=None, limit=None, offset=None)`

List documents. **GET /v1/memory/documents**

| Field | Type | Description |
|------|------|-------------|
| `namespace` | `str \| None` | Optional namespace |
| `limit` | `int \| None` | Optional page size |
| `offset` | `int \| None` | Optional page offset |

Returns the backend `data` dict.

### `client.get_document(document_id, namespace=None)`

Get document details. **GET /v1/memory/documents/:documentId**

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `document_id` | `str` | ✓ | Document ID |
| `namespace` | `str \| None` | | Optional namespace |

Returns the backend `data` dict.

### `client.delete_document(document_id, namespace)`

Delete a document. **DELETE /v1/memory/documents/:documentId**

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `document_id` | `str` | ✓ | Document ID |
| `namespace` | `str` | ✓ | Namespace |

Returns the backend `data` dict.

### `client.query_memory_context(...)`

Query memory context. **POST /v1/memory/queries**

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `str` | ✓ | Query string |
| `namespace` | `str \| None` | | Optional namespace |
| `include_references` | `bool \| None` | | Include references |
| `max_chunks` | `int \| None` | | Optional chunk limit |
| `document_ids` | `list[str] \| None` | | Optional document filters |
| `recall_only` | `bool \| None` | | Recall-only mode |
| `llm_query` | `str \| None` | | Optional LLM query override |

Returns the backend `data` dict.

### `client.chat_memory_context(messages=[...], temperature=None, max_tokens=None)`

Chat with memory context. **POST /v1/memory/conversations**

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `messages` | `list[dict]` | ✓ | Conversation messages `[{role, content}]` |
| `temperature` | `float \| None` | | Optional temperature |
| `max_tokens` | `int \| None` | | Optional token limit |

Returns the backend `data` dict.

### `client.record_interactions(...)`

Record interaction signals. **POST /v1/memory/interactions**

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `namespace` | `str` | ✓ | Namespace |
| `entity_names` | `list[str]` | ✓ | Entity names |
| `description` | `str \| None` | | Optional description |
| `interaction_level` | `str \| None` | | Optional interaction level |
| `interaction_levels` | `list[str] \| None` | | Optional multiple interaction levels |
| `timestamp` | `float \| None` | | Optional Unix timestamp (seconds) |

Returns the backend `data` dict.

### `client.get_ingestion_job(job_id)`

Get ingestion job status. **GET /v1/memory/ingestion/jobs/:jobId**

### `client.wait_for_ingestion_job(job_id, timeout_seconds=30, poll_interval_seconds=1)`

Poll an ingestion job until it reaches a terminal state.

## Implemented methods

Core methods:
- `ingest_memory`
- `ingest_memories`
- `recall_memory`
- `delete_memory`
- `recall_with_llm`

Mirrored routes:
- `chat_memory`
- `interact_memory`
- `recall_memory_master`
- `recall_memories`
- `query_memory_context`
- `chat_memory_context`
- `record_interactions`
- `recall_thoughts`
- `get_graph_snapshot`

Documents:
- `insert_document` (requires `document_id`)
- `insert_documents_batch` (each item requires `documentId` / `document_id`)
- `list_documents`
- `get_document`
- `delete_document`

Ingestion jobs:
- `get_ingestion_job`
- `wait_for_ingestion_job`

## Error handling

API errors raise `TinyHumansError` with `message`, `status`, and `body`.

```python
import tinyhumansai as api
from tinyhumansai import TinyHumansError

client = api.TinyHumansMemoryClient(token="YOUR_API_KEY")
try:
    client.list_documents(namespace="ns", limit=1, offset=0)
except TinyHumansError as err:
    print(err.status, err, err.body)
```

## Tests

```bash
cd packages/sdk-python
python3 scripts/test_routes.py
```