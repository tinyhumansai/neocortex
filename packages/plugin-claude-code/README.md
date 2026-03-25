# Neocortex Claude Code Plugin

Claude Code plugin for **Neocortex-powered long‑term memory** exposed via the Model Context Protocol (MCP).

This package provides an MCP server and TypeScript helpers so Claude Code can call the full Neocortex tool surface for persistent memory operations.

## Features

- **MCP server for Claude Code** — exposes Mastra-aligned tools:
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
- **Simple bootstrap** — one helper (`runNeocortexMcpServerFromEnv`) you can point to from Claude Code’s MCP configuration.

## Install

```bash
npm install @neocortex/plugin-claude-code
```

## Quick Start — MCP Server for Claude Code

1. **Install the package** into the project where your Claude Code plugin or MCP server lives:

```bash
npm install @neocortex/plugin-claude-code
```

2. **Configure an MCP server** in your Claude Code plugin (or project‑level `.mcp.json`):

```json
{
  "mcpServers": {
    "neocortex-memory": {
      "command": "node",
      "args": ["./node_modules/@neocortex/plugin-claude-code/dist/index.js"],
      "env": {
        "ALPHAHUMAN_API_KEY": "your_token",
        "ALPHAHUMAN_BASE_URL": "https://api.your-backend.com"
      }
    }
  }
}
```

- `ALPHAHUMAN_API_KEY` (required): Neocortex/Alphahuman API key or JWT.
- `ALPHAHUMAN_BASE_URL` (optional): Override Neocortex base URL; defaults to the same staging URL used by other Neocortex plugins.

3. When Claude Code starts, it will:

- Launch the MCP server via `node dist/index.js`.
- Discover all registered `neocortex_*` tools listed above.
- Allow Claude (and your skills/agents/hooks) to call these tools as standard MCP tools.

## Claude Code Compatibility Check

Run this check to verify the package is Claude Code-compatible (MCP tools are registered, have schemas/handlers, and match the expected tool set):

```bash
npm run check:claude-code
```

What this check validates:
- The exact expected MCP tool names are present.
- No unexpected tools are registered.
- Every tool has `name`, `description`, `inputSchema`, and `handler`.

If this command passes, the plugin is ready to be used by Claude Code as an MCP server (assuming your runtime env vars are set).

## Programmatic Usage

You can also use the adapter directly from TypeScript without MCP:

```ts
import { ClaudeCodeNeocortexMemory } from "@neocortex/plugin-claude-code";

const memory = new ClaudeCodeNeocortexMemory({
  token: process.env.ALPHAHUMAN_API_KEY!,
  baseUrl: process.env.ALPHAHUMAN_BASE_URL, // optional
  defaultNamespace: "my-project",
});

// Save memory
await memory.saveMemory({
  key: "preferred_drink",
  content: "The user's preferred drink is coffee.",
});

// Recall memory
const recalled = await memory.recallMemory({
  query: "What is the user's preferred drink?",
});

console.log("Recalled context:", recalled.context);
```

Under the hood, this uses the same `NeocortexMemoryClient` as the other plugins, mapping your calls to Neocortex’s `/v1/memory/*` API.

## Document Insert Contract

- `insert_document` requires `document_id`.
- `insert_documents_batch` requires `document_id` on every item.


## Notes

- The MCP server uses `@modelcontextprotocol/sdk`’s `McpServer` + `StdioServerTransport` and registers tools using `zod` schemas, mirroring Neocortex’s other platform plugins.
- Credentials never flow through tool inputs; all sensitive configuration is provided via environment variables when the MCP server process is launched.

