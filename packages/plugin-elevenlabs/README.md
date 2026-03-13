# Neocortex ElevenLabs Plugin

ElevenLabs plugin for **memory-aware voice experiences** backed by Neocortex (Alphahuman) memory.

This package provides TypeScript helpers that integrate with the [ElevenLabs Conversational AI](https://elevenlabs.io/docs/conversational-ai/overview) platform, enabling agents to **save** and **recall** persistent memory across conversations — similar to [Mem0's ElevenLabs integration](https://docs.mem0.ai/integrations/elevenlabs).

## Features

- **Client tools** — `addMemories` / `retrieveMemories` handlers that plug directly into the `@elevenlabs/client` SDK's `Conversation.startSession({ clientTools })` API.
- **Server tools** — Webhook handlers (`handleSaveTool` / `handleRecallTool`) for use behind Express/Fastify when using ElevenLabs server-side webhook tools.
- **Tool definitions** — Helpers to generate ElevenLabs-compatible JSON tool schemas for both client and server tools.

## Install

```bash
npm install @neocortex/plugin-elevenlabs
```

## Quick Start — Client Tools (Recommended)

This approach mirrors the [Mem0 + ElevenLabs pattern](https://docs.mem0.ai/integrations/elevenlabs): memory functions run client-side and are registered directly with the ElevenLabs conversation SDK.

```ts
import { Conversation } from "@elevenlabs/client";
import { ElevenLabsNeocortexMemory } from "@neocortex/plugin-elevenlabs";

const memory = new ElevenLabsNeocortexMemory({
  alphahuman: {
    token: process.env.ALPHAHUMAN_API_KEY!,
    baseUrl: process.env.ALPHAHUMAN_BASE_URL, // optional
  },
});

// Start a voice conversation with memory tools
const conversation = await Conversation.startSession({
  agentId: process.env.AGENT_ID!,
  clientTools: memory.getClientTools(),
  onConnect: () => console.log("Connected"),
  onDisconnect: () => console.log("Disconnected"),
  onMessage: (msg) => console.log("Agent:", msg),
});
```

### Configuring Your ElevenLabs Agent

In the ElevenLabs dashboard, add two **Client** tools to your agent:

**addMemories:**
```json
{
  "name": "addMemories",
  "description": "Stores important information from the conversation to remember for future interactions",
  "parameters": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "The important information to remember"
      }
    },
    "required": ["message"]
  }
}
```

**retrieveMemories:**
```json
{
  "name": "retrieveMemories",
  "description": "Retrieves relevant information from past conversations",
  "parameters": {
    "type": "object",
    "properties": {
      "message": {
        "type": "string",
        "description": "The query to search for in past memories"
      }
    },
    "required": ["message"]
  }
}
```

> **Tip:** Enable "Wait for response" on both tools so the agent can use the returned data.

Update your agent's system prompt:

```
You are a helpful voice assistant that remembers past conversations.

You have access to memory tools:
- Use retrieveMemories at the beginning of conversations to recall relevant context
- Use addMemories to store important information such as user preferences,
  personal details, decisions, and tasks

Before responding to complex questions, always check for relevant memories first.
When the user shares important information, store it for future reference.
```

You can also use `buildNeocortexClientToolsDefinitions()` to get these definitions programmatically.

## Quick Start — Server Tools (Webhook)

Use this approach when your ElevenLabs agent calls your backend via webhooks:

```ts
import express from "express";
import { ElevenLabsNeocortexMemory } from "@neocortex/plugin-elevenlabs";

const app = express();
app.use(express.json());

const memory = new ElevenLabsNeocortexMemory({
  alphahuman: {
    token: process.env.ALPHAHUMAN_API_KEY!,
    baseUrl: process.env.ALPHAHUMAN_BASE_URL,
  },
});

app.post("/elevenlabs/tools/neocortex-save", async (req, res) => {
  const result = await memory.handleSaveTool(req.body);
  res.json(result);
});

app.post("/elevenlabs/tools/neocortex-recall", async (req, res) => {
  const result = await memory.handleRecallTool(req.body);
  res.json(result);
});

app.listen(3000);
```

Use `buildNeocortexServerToolsDefinitions()` to get JSON schemas for registering server tools via the ElevenLabs API.

## Namespace Strategy

By default, the plugin derives a Neocortex namespace as:

1. `namespace` parameter if explicitly provided
2. `user-${user_id}` if `user_id` is present
3. `conv-${conversation_id}` if `conversation_id` is present
4. `phone-${phone_number}` if `phone_number` is present
5. `"default"` as fallback

Override this by passing a custom `namespaceStrategy`:

```ts
const memory = new ElevenLabsNeocortexMemory({
  alphahuman: { token: "..." },
  namespaceStrategy: ({ userId }) => userId ? `customer-${userId}` : "anonymous",
});
```

## E2E Tests

The `e2e.ts` script validates the full data store → recall lifecycle:

- **Phase 1** — Client tools: `addMemories` → `retrieveMemories` round-trip
- **Phase 2** — Server tools: `handleSaveTool` → `handleRecallTool` round-trip
- **Phase 3** — ElevenLabs agent simulation (optional, requires `ELEVENLABS_API_KEY`)

```bash
# Phases 1 & 2 only
ALPHAHUMAN_API_KEY=xxx npx tsx e2e.ts

# All phases including ElevenLabs simulation
ALPHAHUMAN_API_KEY=xxx ELEVENLABS_API_KEY=sk_xxx npx tsx e2e.ts
```

## Voice Demo (Interactive)

To test with **real voice** in the browser:

1. Create an ElevenLabs agent at https://elevenlabs.io/app/agents
2. Add two **Client** tools (`addMemories` and `retrieveMemories`) with schemas shown above — enable "Wait for response" on both
3. Run the demo server:

```bash
ALPHAHUMAN_API_KEY=xxx AGENT_ID=your-agent-id npx tsx example/voice-demo.ts
```

4. Open http://localhost:3737 in your browser
5. Click "🎙️ Start Conversation" and allow microphone access
6. Say: *"Remember that my favorite color is blue"*
7. End the conversation, start a new one, and ask: *"What's my favorite color?"*
8. The agent should recall "blue" from Neocortex memory! 🎉

## Example Conversation Flow

1. **User**: "Hi, do you remember my favorite color?"
2. **Agent** calls `retrieveMemories({ message: "user's favorite color" })`
3. **Plugin** queries Neocortex → returns "The user's favorite color is blue"
4. **Agent**: "Yes, your favorite color is blue!"
5. **User**: "It's actually green now."
6. **Agent** calls `addMemories({ message: "The user's favorite color is green" })`
7. **Plugin** stores in Neocortex → returns "Memory added successfully"
8. **Agent**: "Got it, I'll remember that your favorite color is green."
