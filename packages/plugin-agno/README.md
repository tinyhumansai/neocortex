# Neocortex Agno Plugin

Agno plugin for **Neocortex-powered memories** in Agno agents. Gives your agents persistent memory (save, recall, delete) via the Neocortex/TinyHumans API, with credentials kept out of tool parameters.

## Requirements

- Python 3.9+
- [Agno](https://pypi.org/project/agno/) ≥ 2.0
- [httpx](https://www.python-httpx.org/) (brought in as a dependency) for talking to the TinyHuman backend.

## Install

```bash
pip install neocortex-agno
```

Or from the repo:

```bash
pip install -e ./neocortex/packages/plugin-agno
```

## Quick start

```python
from agno.agent import Agent
from agno.models.openai import OpenAIResponses
from neocortex_agno import NeocortexTools

agent = Agent(
    model=OpenAIResponses(id="gpt-4o-mini"),
    tools=[NeocortexTools(token="YOUR_TINYHUMANS_API_KEY")],
    instructions="Use the memory tools to remember and recall user preferences and context.",
    markdown=True,
)

# Agent can now save and recall memories
agent.print_response("Remember that I prefer dark mode and my name is Alex.", stream=True)
agent.print_response("What theme do I prefer?", stream=True)
```

## Available tools

The `NeocortexTools` toolkit exposes tools aligned with the TinyHumans/Neocortex SDK endpoints:


| Tool            | Description                                                           |
| --------------- | --------------------------------------------------------------------- |
| `save_memory`   | Save or update a memory (key, content, namespace, optional metadata). |
| `recall_memory` | Recall relevant memories for a natural-language query in a namespace. |
| `delete_memory` | Delete one or more memories by key/keys or delete all in a namespace. |
| `sync_memory` | Sync OpenClaw memory files (workspace/agent + file objects). |
| `insert_document` | Insert a single memory document (title/content/namespace). `document_id` is required. |
| `insert_documents_batch` | Insert multiple documents in one call. Each item must include `document_id`. |
| `list_documents` | List documents in a namespace. |
| `get_document` | Get a specific document by `document_id`. |
| `delete_document` | Delete a specific document by `document_id`. |
| `query_memory_context` | Query mirrored memory context (`/v1/memory/queries`). |
| `chat_memory_context` | Chat with memory context (`/v1/memory/conversations`). |
| `record_interactions` | Record interaction signals (`/v1/memory/interactions`). |
| `recall_thoughts` | Generate reflective thoughts (`/v1/memory/memories/thoughts`). |
| `chat_memory` | Chat with memory cache (`/v1/memory/chat`). |
| `interact_memory` | Record entity interactions (`/v1/memory/interact`). |
| `recall_memory_master` | Recall context from the master node (`/v1/memory/recall`). |
| `recall_memories` | Recall memories from the Ebbinghaus bank (`/v1/memory/memories/recall`). |
| `get_ingestion_job` | Check ingestion job status (`/v1/memory/ingestion/jobs/:jobId`). |


Credentials (`token`, `model_id`, `base_url`) are set when constructing `NeocortexTools` and are **never** passed as tool arguments, so the LLM cannot see or override them.

## Configuration

- **token** (required): TinyHuman / Neocortex memory API token (e.g. `TINYHUMANS_API_KEY`).
- **base_url** (optional): TinyHuman API base URL. If omitted, uses the `TINYHUMANS_BASE_URL` env var or the default `https://api.tinyhumans.ai`.

## Error handling

On API failures, the underlying client raises `TinyHumanError`. You can catch it for logging or user-facing messages:

```python
from neocortex_agno import NeocortexTools, TinyHumanError

try:
    agent.print_response("Remember that I like Python.", stream=True)
except TinyHumanError as e:
    print(f"Memory API error: {e} (status={e.status})")
```

## Example

An example script is included. Set `TINYHUMANS_API_KEY`, `TINYHUMANS_BASE_URL`, and `OPENAI_API_KEY`, then:

```bash
python example.py
```

