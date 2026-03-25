# Neocortex OpenCode Plugin

OpenCode plugin for **Neocortex-powered long‑term memory**.

This package exposes Neocortex memory as first-class OpenCode tools so agents can save, query, and manage persistent memory directly from OpenCode.

## Features

- **Custom tools for OpenCode** — Mastra-aligned Neocortex tools:
  - `neocortex_save_memory`, `neocortex_recall_memory`, `neocortex_delete_memory`
  - `neocortex_sync_memory`
  - `neocortex_insert_document`, `neocortex_insert_documents_batch`
  - `neocortex_list_documents`, `neocortex_get_document`, `neocortex_delete_document`
  - `neocortex_query_memory_context`, `neocortex_chat_memory_context`
  - `neocortex_record_interactions`, `neocortex_recall_thoughts`
  - `neocortex_chat_memory`, `neocortex_interact_memory`
  - `neocortex_recall_memory_master`, `neocortex_recall_memories`
  - `neocortex_get_ingestion_job`
- **Shared client** — reuses the same `NeocortexMemoryClient` and types as the other Neocortex plugins.
- **Simple installation** — add the npm package to your OpenCode config and set Neocortex environment variables.

## Install

Add the plugin to your OpenCode config (`opencode.json` or `~/.config/opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@neocortex/plugin-opencode"]
}
```

Then install dependencies (OpenCode will usually do this automatically on startup using Bun, but you can run it yourself in the config directory if needed):

```bash
bun install
```

## Environment Variables

Set these in your shell or in the environment that launches OpenCode:

- `TINYHUMANS_API_KEY` (required): Neocortex/TinyHuman API key or JWT.
- `TINYHUMANS_BASE_URL` (optional): Override Neocortex base URL; defaults to the same staging URL used by other Neocortex plugins.

The plugin also respects `NEOCORTEX_API_KEY` / `NEOCORTEX_TOKEN` and `NEOCORTEX_BASE_URL` for flexibility.

## Exposed Tools

Once loaded, the plugin registers:

- `neocortex_save_memory`
- `neocortex_recall_memory`
- `neocortex_delete_memory`
- `neocortex_sync_memory`
- `neocortex_insert_document`
- `neocortex_insert_documents_batch`
- `neocortex_list_documents`
- `neocortex_get_document`
- `neocortex_delete_document`
- `neocortex_query_memory_context`
- `neocortex_chat_memory_context`
- `neocortex_record_interactions`
- `neocortex_recall_thoughts`
- `neocortex_chat_memory`
- `neocortex_interact_memory`
- `neocortex_recall_memory_master`
- `neocortex_recall_memories`
- `neocortex_get_ingestion_job`

These appear alongside other tools in OpenCode and can be used by agents automatically.

## Document Insert Contract

- `neocortex_insert_document` requires `document_id`.
- `neocortex_insert_documents_batch` requires `document_id` on every item.

### Example: Agent Instructions

Update your system prompt (e.g. in project instructions) to encourage tool usage:

```text
You have access to long-term memory tools backed by Neocortex:

- Use neocortex_save_memory to store important facts, user preferences, and decisions.
- Use neocortex_recall_memory or neocortex_query_memory_context to retrieve context.
- Use document tools (insert/list/get/delete) when memory should be managed as documents.
- Use interaction/thought tools to log interactions and produce reflective context.
- Use neocortex_delete_memory only when explicitly asked to clear a namespace.
```

## Programmatic Usage

You can also use the adapter directly from TypeScript/Node (outside of OpenCode) using the exported `OpenCodeNeocortexMemory` class:

```ts
import { OpenCodeNeocortexMemory } from "@neocortex/plugin-opencode";

const memory = new OpenCodeNeocortexMemory({
  token: process.env.TINYHUMANS_API_KEY!,
  baseUrl: process.env.TINYHUMANS_BASE_URL, // optional
  defaultNamespace: "my-opencode-workspace",
});

// Save memory
await memory.saveMemory({
  key: "preferred_framework",
  content: "The user's preferred frontend framework is Next.js.",
});

// Recall memory
const recalled = await memory.recallMemory({
  query: "What is the user's preferred frontend framework?",
});

console.log("Recalled context:", recalled.context);
```

Internally, this uses the shared `NeocortexMemoryClient` to call Neocortex’s `/v1/memory/*` API.


## Notes

- The plugin uses the official `@opencode-ai/plugin` helper to register tools, so they integrate cleanly with OpenCode’s tool system.
- Credentials never flow through tool arguments; all authentication is handled via environment variables when OpenCode loads the plugin.

