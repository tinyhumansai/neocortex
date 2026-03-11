# alphahuman-memory-sdk (Rust)

Rust SDK for the [Alphahuman Memory API](https://alphahuman.xyz), aligned with the backend API: insert, query, admin/delete, recall, and memories/recall.

## Requirements

- Rust 1.70+
- Tokio (async runtime)

## Install

Add to your `Cargo.toml`:

```toml
[dependencies]
alphahuman-memory-sdk = "0.1"
```

## Quick start

```rust
use alphahuman_memory_sdk::{AlphahumanConfig, AlphahumanMemoryClient, InsertMemoryParams, QueryMemoryParams, DeleteMemoryParams};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = AlphahumanMemoryClient::new(
        AlphahumanConfig::new("your-api-key")
            .with_base_url("https://your-backend.ngrok-free.dev"), // optional
    )?;

    // Insert a document
    let res = client.insert_memory(InsertMemoryParams {
        title: "User preference".into(),
        content: "User prefers dark mode".into(),
        namespace: "preferences".into(),
        ..Default::default()
    }).await?;
    println!("{:?}", res.data);

    // Query memory
    let query = client.query_memory(QueryMemoryParams {
        query: "What does the user prefer?".into(),
        namespace: Some("preferences".into()),
        max_chunks: Some(10),
        ..Default::default()
    }).await?;
    println!("{:?}", query.data.response);

    // Delete memory
    client.delete_memory(DeleteMemoryParams {
        namespace: Some("preferences".into()),
    }).await?;

    Ok(())
}
```

## API overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `insert_memory` | POST /v1/memory/insert | Insert a document (title, content, namespace) |
| `query_memory` | POST /v1/memory/query | Query memory via RAG |
| `delete_memory` | POST /v1/memory/admin/delete | Delete memory (optional namespace) |
| `recall_memory` | POST /v1/memory/recall | Recall context from Master node |
| `recall_memories` | POST /v1/memory/memories/recall | Recall memories from Ebbinghaus bank |

Configuration uses `AlphahumanConfig::new(token)`. Optionally set base URL with `.with_base_url(url)` or the `ALPHAHUMAN_BASE_URL` environment variable. Default base URL is `https://staging-api.alphahuman.xyz`.

## Error handling

Errors are returned as `AlphahumanError`: `Validation`, `Http`, `Api { message, status, body }`, or `Decode`. Use `thiserror`/`#[error]` for display and matching.

## Tests

Unit and integration tests (mocked HTTP):

```bash
cargo test
```

**End-to-end test** (hits a real backend; skipped by default):

```bash
ALPHAHUMAN_API_KEY=your_key cargo test e2e_live_insert_query_delete -- --ignored
```

Set `ALPHAHUMAN_BASE_URL` if your backend URL differs from the default. Ensure the backend is reachable (e.g. ngrok running) or the test will fail with an HTTP connection error.
