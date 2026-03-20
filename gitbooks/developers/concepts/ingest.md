# Ingest

Ingesting is how you write memory into Neocortex. Ingest is an upsert operation.

## What Upsert Means

- If `(namespace, key)` does not exist, Neocortex creates a new memory item.
- If `(namespace, key)` already exists, Neocortex updates the existing item.

This prevents duplicates and lets you safely re-send corrected or richer versions of the same memory.

## Typical Fields

- `key`: stable identifier in a namespace
- `content`: memory text
- `namespace`: scope bucket
- `metadata` (optional): tags/attributes
- `created_at` / `updated_at` (optional): Unix timestamps

## Practical Pattern

Use deterministic keys where possible, like `user:{id}:preference:theme`, so updates naturally target the same memory item over time.

For implementation examples in all supported languages, see [Inserting Memories](../sdk-functions/inserting-memories.md).
