# Neocortex Raycast Plugin

Raycast MCP plugin for **Neocortex-powered long‑term memory**.

This package provides a small MCP server and TypeScript helpers so the [Raycast MCP Extension](https://raycast.com/help/mcp) can call Neocortex tools to **save**, **recall**, and **delete** persistent memory. It follows the same patterns as other memory MCP servers (like the Memory extension and `codex-extra-memory`) but stores data in Neocortex instead of local databases.

## Features

- **MCP server for Raycast** — exposes the full Mastra-compatible Neocortex tool surface:
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
- **Shared client** — reuses the same `NeocortexMemoryClient` and types as the other Neocortex plugins.
- **Simple bootstrap** — one helper (`runNeocortexMcpServerFromEnv`) you can point to from the Raycast MCP Extension configuration.

## Install

Install into the workspace where you manage your MCP servers:

```bash
npm install @neocortex/plugin-raycast
```

Build the server:

```bash
npm run build
```

## Quick Start — Raycast MCP Extension

1. **Install the Raycast MCP Extension** (from Raycast’s built-in marketplace).

2. **Add a new MCP server** in the Raycast MCP settings:

- **Command**: `node`
- **Arguments**:

```text
./node_modules/@neocortex/plugin-raycast/dist/index.js
```

- **Environment variables**:
  - `ALPHAHUMAN_API_KEY` (required): Neocortex/Alphahuman API key or JWT.
  - `ALPHAHUMAN_BASE_URL` (optional): Override Neocortex base URL; defaults to the same staging URL used by other Neocortex plugins.

After saving, Raycast will:

- Launch the MCP server via `node dist/index.js`.
- Discover the tools:
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
- Allow you to `@-mention` the Neocortex server and invoke its tools in AI Chat, Commands, and Presets.

## Programmatic Usage

You can also use the adapter directly from TypeScript/Node without Raycast:

```ts
import { RaycastNeocortexMemory } from "@neocortex/plugin-raycast";

const memory = new RaycastNeocortexMemory({
  token: process.env.ALPHAHUMAN_API_KEY!,
  baseUrl: process.env.ALPHAHUMAN_BASE_URL, // optional
  defaultNamespace: "my-raycast-workspace",
});

// Save memory
await memory.saveMemory({
  key: "preferred_shell",
  content: "The user's preferred shell is zsh.",
});

// Recall memory
const recalled = await memory.recallMemory({
  query: "What is the user's preferred shell?",
});

console.log("Recalled context:", recalled.context);
```

Internally, this uses the shared `NeocortexMemoryClient` to call Neocortex’s `/v1/memory/*` API.


## Notes

- The MCP server uses `@modelcontextprotocol/sdk`’s `McpServer` + `StdioServerTransport` and registers tools using `zod` schemas, mirroring the Claude Code and Codex Neocortex plugins.
- Credentials never flow through tool inputs; all sensitive configuration is provided via environment variables when the MCP server process is launched.

