# Neocortex Mastra Plugin

TypeScript plugin for using **Neocortex (TinyHuman) memory** inside Mastra workflows/agents.

This package is a small adapter that:

- Calls the TinyHuman memory API directly (same contract as `sdk-typescript`)
- Exposes **tools** for saving, recalling, deleting, plus newer endpoints like documents, mirrored query/chat, interactions, sync, recall/thoughts, ingestion jobs, and graph snapshots

## Install

From the repo root (or within `packages/plugin-mastra`):

```bash
npm install
```

Or, if published:

```bash
npm install @neocortex/plugin-mastra
```

## Usage

```ts
import { MastraNeocortexMemory, createNeocortexMastraTools } from "@neocortex/plugin-mastra";

const memory = new MastraNeocortexMemory({
  token: process.env.TINYHUMANS_API_KEY!,
  baseUrl: process.env.TINYHUMANS_BASE_URL, // optional
  defaultNamespace: "my-app", // optional
});

// Register these tools in Mastra (or any tool-capable agent framework)
const tools = memory.getTools();
```

Mastra-native tools (recommended):

```ts
import { Agent } from "@mastra/core/agent";
import { createNeocortexMastraTools } from "@neocortex/plugin-mastra";

const { neocortexSaveMemory, neocortexRecallMemory, neocortexDeleteMemory } = createNeocortexMastraTools({
  token: process.env.TINYHUMANS_API_KEY!,
  baseUrl: process.env.TINYHUMANS_BASE_URL,
  defaultNamespace: "my-app",
});

const agent = new Agent({
  id: "my-agent",
  name: "My Agent",
  model: "openai/gpt-5.1",
  instructions: "Use neocortex tools to save and recall user preferences.",
  tools: {
    [neocortexSaveMemory.id]: neocortexSaveMemory,
    [neocortexRecallMemory.id]: neocortexRecallMemory,
  },
});
```

## Available tools

`createNeocortexMastraTools()` returns both the original tools (`neocortexSaveMemory`, `neocortexRecallMemory`, `neocortexDeleteMemory`) and additional tools that map to the newer `sdk-typescript` endpoints, including:
- `neocortexInsertDocument`, `neocortexInsertDocumentsBatch`, `neocortexListDocuments`, `neocortexGetDocument`, `neocortexDeleteDocument`
- `neocortexQueryMemoryContext`, `neocortexChatMemoryContext`, `neocortexRecordInteractions`, `neocortexRecallThoughts`
- `neocortexSyncMemory`, `neocortexChatMemory`, `neocortexInteractMemory`, `neocortexRecallMemoryMaster`, `neocortexRecallMemories`
- `neocortexGetIngestionJob`, `neocortexGetGraphSnapshot`

### Document Insert Contract

- `neocortexInsertDocument` requires `document_id`.
- `neocortexInsertDocumentsBatch` requires `document_id` on every item.

## Environment variables

- `TINYHUMANS_API_KEY` (required): Bearer token for the TinyHuman backend
- `TINYHUMANS_BASE_URL` (optional): Defaults to `https://api.tinyhumans.ai`

