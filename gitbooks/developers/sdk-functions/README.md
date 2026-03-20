# SDK Functions

This section documents the core Neocortex memory operations across SDKs and raw HTTP.

## Supported Languages

- TypeScript
- Python
- Go
- Rust
- Java
- C++
- cURL (raw HTTP)

## Core Operations

| Operation | TypeScript | Python | Go | Rust | Java | C++ |
| --- | --- | --- | --- | --- | --- | --- |
| Ingest / Insert | `insertMemory` | `ingest_memory` | `IngestMemory` | `insert_memory` | `insertMemory` | `insert_memory` |
| Recall Context | `recallMemory` | `recall_memory` | `RecallMemory` | `recall_memory` | `recallMemory` | `recall_memory` |
| Delete | `deleteMemory` | `delete_memory` | `DeleteMemory` | `delete_memory` | `deleteMemory` | `delete_memory` |

Different SDKs expose different method names, but they map to the same API concepts.

Next: start with [Inserting Memories](inserting-memories.md).
