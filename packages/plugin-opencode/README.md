# Neocortex OpenCode Plugin

OpenCode plugin for **Neocortex-powered long‑term memory**.

This package exposes Neocortex memory as first-class OpenCode tools so agents can **save**, **recall**, and **delete** persistent memory directly from within OpenCode, similar to other memory plugins like `opencode-mem` and `opencode-supermemory`, but backed by Neocortex instead of local storage.

## Features

- **Custom tools for OpenCode** — three tools:
  - `neocortex_save_memory`
  - `neocortex_recall_memory`
  - `neocortex_delete_memory`
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

- `ALPHAHUMAN_API_KEY` (required): Neocortex/Alphahuman API key or JWT.
- `ALPHAHUMAN_BASE_URL` (optional): Override Neocortex base URL; defaults to the same staging URL used by other Neocortex plugins.

The plugin also respects `NEOCORTEX_API_KEY` / `NEOCORTEX_TOKEN` and `NEOCORTEX_BASE_URL` for flexibility.

## Exposed Tools

Once loaded, the plugin registers the following tools in OpenCode:

- `neocortex_save_memory`
- `neocortex_recall_memory`
- `neocortex_delete_memory`

These appear alongside other tools in OpenCode and can be used by agents automatically.

### Example: Agent Instructions

Update your system prompt (e.g. in project instructions) to encourage tool usage:

```text
You have access to long-term memory tools backed by Neocortex:

- Use neocortex_save_memory to store important facts, user preferences, and decisions.
- Use neocortex_recall_memory when you need to remember past facts or preferences.
- Use neocortex_delete_memory only when explicitly asked to clear a namespace.
```

## Programmatic Usage

You can also use the adapter directly from TypeScript/Node (outside of OpenCode) using the exported `OpenCodeNeocortexMemory` class:

```ts
import { OpenCodeNeocortexMemory } from "@neocortex/plugin-opencode";

const memory = new OpenCodeNeocortexMemory({
  token: process.env.ALPHAHUMAN_API_KEY!,
  baseUrl: process.env.ALPHAHUMAN_BASE_URL, // optional
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

