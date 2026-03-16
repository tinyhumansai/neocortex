# Neocortex Claude Code Plugin

Claude Code plugin for **Neocortex-powered long‑term memory** exposed via the Model Context Protocol (MCP).

This package provides a small MCP server and TypeScript helpers so Claude Code can call Neocortex tools to **save**, **recall**, and **delete** persistent memory.

## Features

- **MCP server for Claude Code** — exposes three tools:
  - `neocortex_save_memory`
  - `neocortex_recall_memory`
  - `neocortex_delete_memory`
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
- Discover the tools:
  - `neocortex_save_memory`
  - `neocortex_recall_memory`
  - `neocortex_delete_memory`
- Allow Claude (and your skills/agents/hooks) to call these tools as standard MCP tools.

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


## Notes

- The MCP server uses `@modelcontextprotocol/sdk`’s `McpServer` + `StdioServerTransport` and registers tools using `zod` schemas, mirroring Neocortex’s other platform plugins.
- Credentials never flow through tool inputs; all sensitive configuration is provided via environment variables when the MCP server process is launched.

