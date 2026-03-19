# Python SDK

The TinyHumans SDK provides a managed, cloud-hosted memory layer for AI applications. No infrastructure require just install and start storing memories.

## Installation

```bash
pip install tinyhumansai
```

Requires Python 3.9+. The only runtime dependency is [httpx](https://www.python-httpx.org/).

## Client Initialization

```python
import tinyhumansai as api

client = api.TinyHumanMemoryClient(
    token="your-api-key",       # Required. TinyHumans API key.
    model_id="neocortex-mk1",   # Required. Model identifier.
    base_url="https://...",     # Optional. Override API base URL.
)
```

The client supports the context-manager protocol for automatic cleanup:

```python
with api.TinyHumanMemoryClient(token="...", model_id="...") as client:
    ctx = client.recall_memory(namespace="preferences", prompt="User preferences", num_chunks=10)
```

## Core Concepts

**Memory items** are the basic unit of storage. Each item has:

| Field        | Required | Description                                                  |
| ------------ | -------- | ------------------------------------------------------------ |
| `key`        | yes      | Unique identifier within a namespace (used for upsert/dedup) |
| `content`    | yes      | The memory text                                              |
| `namespace`  | yes      | Scope for organizing items                                   |
| `metadata`   | no       | Arbitrary dict for tagging/filtering                         |
| `created_at` | no       | Unix timestamp in seconds                                    |
| `updated_at` | no       | Unix timestamp in seconds                                    |

**Namespaces** let you organize memories by category (e.g. `"preferences"`, `"conversation-history"`, `"user-facts"`).

**Context** is a pre-formatted string built from your stored memories, ready to inject into any LLM prompt as system context.

## API Reference

### `ingest_memory`

Upsert a single memory item. Deduped by `(namespace, key)`  if a match exists, it is updated; otherwise a new item is created.

```python
result = client.ingest_memory(
    item={
        "key": "fav-color",
        "content": "User's favorite color is blue",
        "namespace": "preferences",
    }
)
print(result.ingested, result.updated, result.errors)
```

You can also use the `MemoryItem` dataclass:

```python
from tinyhumansai import MemoryItem

result = client.ingest_memory(
    item=MemoryItem(key="fav-color", content="Blue", namespace="preferences")
)
```

### `ingest_memories`

Upsert multiple memory items in one call. Items are deduped by `(namespace, key)`.

```python
result = client.ingest_memories(
    items=[
        {"key": "fav-color", "content": "Blue", "namespace": "preferences"},
        {"key": "fav-food", "content": "Pizza", "namespace": "preferences"},
    ]
)
print(result.ingested, result.updated, result.errors)
```

### `recall_memory`

Fetch relevant memory chunks using a prompt and return them as an LLM-friendly context string.

```python
ctx = client.recall_memory(
    namespace="preferences",
    prompt="What is the user's favorite color?",
    num_chunks=10,
)
print(ctx.context)  # Formatted string
print(ctx.items)    # List of ReadMemoryItem objects
print(ctx.count)    # Number of items
```

You can also filter by specific keys instead of prompt-based retrieval:

```python
ctx = client.recall_memory(namespace="preferences", prompt="", key="fav-color", num_chunks=10)
```

### `recall_with_llm`

Query an LLM provider with your stored context injected. Supports OpenAI, Anthropic, and Google Gemini out of the box, plus any OpenAI-compatible endpoint.

```python
ctx = client.recall_memory(namespace="preferences", prompt="User preferences", num_chunks=10)

response = client.recall_with_llm(
    prompt="What is the user's favorite color?",
    provider="openai",
    model="gpt-4o-mini",
    api_key="your-openai-key",
    context=ctx.context,
)
print(response.text)
```

### `delete_memory`

Remove memory items by key or delete all in a namespace.

```python
# Delete a specific key
client.delete_memory(namespace="preferences", key="fav-color")

# Delete multiple keys
client.delete_memory(namespace="preferences", keys=["fav-color", "fav-food"])

# Delete all memories in a namespace
client.delete_memory(namespace="preferences", delete_all=True)
```
