# Neocortex Codex Plugin

Codex MCP plugin for **Neocortex-powered long‑term memory**.

This package provides a small MCP server and TypeScript helpers so the [Codex](https://github.com/sting8k/opencode-codex-plugin) environment can call Neocortex tools to **save**, **recall**, **delete**, and use extended memory endpoints (documents, sync, query/chat context, interactions, ingestion jobs). Similar in spirit to `codex-extra-memory` but backed by Neocortex instead of a local SQLite/LanceDB store.

## Features

- **MCP server for Codex** — exposes Neocortex memory tools via MCP.
- **Shared client** — reuses the same `NeocortexMemoryClient` and types as the other Neocortex plugins.
- **Simple bootstrap** — one helper (`runNeocortexMcpServerFromEnv`) you can reference from your Codex MCP configuration.

## Install

```bash
npm install @neocortex/plugin-codex
```

## Quick Start — MCP Server for Codex

1. **Install the package** into the workspace that Codex uses for MCP servers:

```bash
npm install @neocortex/plugin-codex
```

2. **Configure an MCP server** in your Codex config (typically `config.toml` under `$CODEX_HOME` or your workspace), modelled after the `codex-extra-memory` examples:

```toml
[mcp_servers.neocortex_memory]
command = "node"
args = ["./node_modules/@neocortex/plugin-codex/dist/index.js"]
required = true
enabled = true
startup_timeout_sec = 20
tool_timeout_sec = 90
enabled_tools = [
  "neocortex_save_memory",
  "neocortex_recall_memory",
  "neocortex_delete_memory",
  "neocortex_sync_memory",
  "neocortex_insert_document",
  "neocortex_insert_documents_batch",
  "neocortex_list_documents",
  "neocortex_get_document",
  "neocortex_delete_document",
  "neocortex_query_memory_context",
  "neocortex_chat_memory_context",
  "neocortex_record_interactions",
  "neocortex_recall_thoughts",
  "neocortex_chat_memory",
  "neocortex_interact_memory",
  "neocortex_recall_memory_master",
  "neocortex_recall_memories",
  "neocortex_get_ingestion_job",
]
```

Then set environment variables for the MCP process:

- `TINYHUMANS_API_KEY` (required): Neocortex/TinyHuman API key or JWT.
- `TINYHUMANS_BASE_URL` (optional): Override Neocortex base URL; defaults to the same staging URL used by other Neocortex plugins.

3. When Codex starts, it will launch the MCP server via `node dist/index.js` and discover all registered Neocortex tools. Enable only the tools you need in `enabled_tools`.

## Available tools

The MCP server registers the following tools (all optional in `enabled_tools`):

| Tool | Description |
|------|-------------|
| `neocortex_save_memory` | Save a piece of important information into long-term memory. |
| `neocortex_recall_memory` | Recall relevant long-term memory for the given query. |
| `neocortex_delete_memory` | Delete all memory in a namespace (admin delete). |
| `neocortex_sync_memory` | Sync OpenClaw memory files (POST /v1/memory/sync). |
| `neocortex_insert_document` | Insert a single memory document (POST /v1/memory/documents). `document_id` is required. |
| `neocortex_insert_documents_batch` | Insert multiple memory documents (POST /v1/memory/documents/batch). Each item must include `document_id`. |
| `neocortex_list_documents` | List ingested documents (GET /v1/memory/documents). |
| `neocortex_get_document` | Get a memory document (GET /v1/memory/documents/:documentId). |
| `neocortex_delete_document` | Delete a memory document (DELETE /v1/memory/documents/:documentId). |
| `neocortex_query_memory_context` | Query memory context (POST /v1/memory/queries). |
| `neocortex_chat_memory_context` | Chat with memory context (POST /v1/memory/conversations). |
| `neocortex_record_interactions` | Record interactions (POST /v1/memory/interactions). |
| `neocortex_recall_thoughts` | Generate reflective thoughts (POST /v1/memory/memories/thoughts). |
| `neocortex_chat_memory` | Chat with memory cache (POST /v1/memory/chat). |
| `neocortex_interact_memory` | Record interactions (core) (POST /v1/memory/interact). |
| `neocortex_recall_memory_master` | Recall context from master node (POST /v1/memory/recall). |
| `neocortex_recall_memories` | Recall memories from Ebbinghaus bank (POST /v1/memory/memories/recall). |
| `neocortex_get_ingestion_job` | Get ingestion job status (GET /v1/memory/ingestion/jobs/:jobId). |

## Programmatic Usage

You can also use the `CodexNeocortexMemory` class directly from TypeScript/Node without Codex:

```ts
import { CodexNeocortexMemory } from "@neocortex/plugin-codex";

const memory = new CodexNeocortexMemory({
  token: process.env.TINYHUMANS_API_KEY!,
  baseUrl: process.env.TINYHUMANS_BASE_URL, // optional
  defaultNamespace: "my-workspace",
});

// Save memory
await memory.saveMemory({
  key: "preferred_editor",
  content: "The user's preferred editor is VS Code.",
});

// Recall memory
const recalled = await memory.recallMemory({
  query: "What is the user's preferred editor?",
});

console.log("Recalled context:", recalled.context);

// Documents, sync, query/chat context, interactions, and more
await memory.insertDocument({ title: "doc", content: "...", namespace: "ns", document_id: "doc-001" });
await memory.listDocuments({ namespace: "ns" });
await memory.queryMemoryContext({ query: "?", namespace: "ns" });
await memory.syncMemory({ workspace_id: "...", agent_id: "...", source: "openclaw", files: [] });
```

Internally, this uses the shared `NeocortexMemoryClient` to call Neocortex’s `/v1/memory/*` API.


## Notes

- The MCP server uses `@modelcontextprotocol/sdk`’s `McpServer` + `StdioServerTransport` and registers tools using `zod` schemas, mirroring the Claude Code and other Neocortex plugins.
- Credentials never flow through tool inputs; all sensitive configuration is provided via environment variables when the MCP server process is launched.

