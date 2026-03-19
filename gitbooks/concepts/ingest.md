# Ingest

**Ingesting** is how you store memories. You can ingest a single item or a batch.

## Single Item

```python
client.ingest_memory(item={
    "key": "fact-1",
    "content": "User is vegetarian",
    "namespace": "preferences",
})
```

## Batch

```python
client.ingest_memories(items=[
    {"key": "fact-1", "content": "User is vegetarian", "namespace": "preferences"},
    {"key": "fact-2", "content": "Allergic to peanuts", "namespace": "preferences"},
])
```

## Upsert Behavior

Ingest is an **upsert** operation if a memory with the same `(namespace, key)` already exists, its content and metadata are updated. Otherwise a new memory is created.

This means you can safely call ingest repeatedly without worrying about duplicates. The `key` is your deduplication handle.

## Response

The response tells you what happened:

```python
result = client.ingest_memory(item={...})
print(result.ingested)  # Number of new items created
print(result.updated)   # Number of existing items updated
print(result.errors)    # Number of items that failed
```
