# Neocortex Dify Plugin

Neocortex (TinyHuman) memory tool extension for Dify AI.

This plugin exposes a set of tools that let a Dify agent:
- store facts/preferences persistently
- retrieve relevant context before answering
- manage document-backed memory (insert/list/get/delete)
- use mirrored context endpoints (query/chat) and interaction/thought endpoints

## Requirements

- Python **3.12+**
- A valid **TinyHumans API key** (configured as a Dify plugin credential)

## Configuration (Dify credentials)

When enabling the plugin in Dify, configure:

- **`tinyhumans_api_key`** (required): token used for all `/v1/memory/...` calls
- **`default_namespace`** (optional): fallback namespace when a tool call does not provide `namespace`

Base URL:
- By default the tools call `https://api.tinyhumans.ai`
- Override with environment variable **`TINYHUMANS_BASE_URL`** in the runtime environment

## Tools

### Core memory tools

- **`save_memory`**: store/update one memory item (`key`, `content`, optional `namespace`, optional `metadata_json`)
- **`recall_memory`**: recall relevant memories (`prompt`, optional `namespace`, `num_chunks`)
- **`delete_memory`**: delete all memories in a namespace (optional `namespace`)

### Document and context tools (Mastra-aligned)

- **`insert_document`**: insert one document into a namespace  
  - **`document_id` is required**
- **`insert_documents_batch`**: insert multiple documents in one request  
  - each item in `items_json` must include **`document_id`**
- **`list_documents`**: list documents for a namespace (`namespace`, `limit`, `offset`)
- **`get_document`**: fetch a document by `document_id` (optional `namespace`)
- **`delete_document`**: delete a document by `document_id` (requires `namespace`)

Context + chat:
- **`query_memory_context`**: mirrored context query (`query`, optional `namespace`, optional `document_ids_json`, etc.)
- **`chat_memory_context`**: chat with contextual memory (`messages_json`, optional `temperature`, optional `max_tokens`)
- **`chat_memory`**: chat with memory cache (`messages_json`, optional `temperature`, optional `max_tokens`)

Interactions + reflection:
- **`record_interactions`**: record interaction signals (`entity_names_json`, optional `namespace`, etc.)
- **`interact_memory`**: interact endpoint (`entity_names_json`, `description`, optional `namespace`, etc.)
- **`recall_thoughts`**: generate reflective thoughts (optional `namespace`, `max_chunks`, etc.)
- **`recall_memory_master`**: recall master context (optional `namespace`, `max_chunks`)
- **`recall_memories`**: recall Ebbinghaus memories (optional `namespace`, `top_k`, `min_retention`, `as_of`)

Jobs:
- **`get_ingestion_job`**: check ingestion status by `job_id`

## Installation into Dify

This package is structured as a **Dify Tool Plugin**.

1. Install the [Dify Plugin CLI](https://github.com/langgenius/dify-plugin).
2. Package the plugin (run from `packages/plugin-dify/`):

```bash
dify plugin package neocortex_dify
```

3. Upload the resulting `.difypkg` file to your Dify instance via the **Plugins** page.
4. Configure plugin credentials:
   - `tinyhumans_api_key` (required)
   - `default_namespace` (optional)

## Recommended agent prompt guidance (Dify)

Add a short instruction to your Dify agent/system prompt:

- Use `recall_memory` or `query_memory_context` before answering questions about user preferences or prior context
- Use `save_memory` when the user shares a stable preference or important fact
- For documents, always provide a deterministic `document_id` (do not invent random IDs)

## Local development and testing

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
pytest -q
```
