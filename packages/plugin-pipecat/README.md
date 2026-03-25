> ## Documentation Index
> Fetch the complete documentation index at: https://docs.mem0.ai/llms.txt
> Use this file to discover all available pages before exploring further.

# Pipecat Neocortex Integration

Integrate **Neocortex** with [Pipecat](https://pipecat.ai) to add long‑term conversational memory to your voice and chat agents.

This package provides a `NeocortexMemoryService` that plugs into the Pipecat pipeline in the same way as `Mem0MemoryService`, but stores and retrieves memories from Neocortex instead.

## Installation

Install from your workspace (or virtualenv) that runs Pipecat:

```bash
pip install neocortex-pipecat
```

You will also need to set your Neocortex API key as an environment variable:

```bash
export TINYHUMANS_API_KEY=your_neocortex_api_key
```

Optionally, configure a custom Neocortex base URL:

```bash
export TINYHUMANS_BASE_URL=https://api.your-backend.com
```

## Configuration

Neocortex integration is provided through the `NeocortexMemoryService` class.

```python
from neocortex_pipecat import NeocortexMemoryService, NeocortexParams

memory = NeocortexMemoryService(
    api_key=os.getenv("TINYHUMANS_API_KEY"),  # Your Neocortex token/JWT
    user_id="unique_user_id",                 # Unique identifier for the end user
    agent_id="my_agent",                      # Identifier for the agent using the memory
    run_id="session_123",                     # Optional: specific conversation session ID
    params=NeocortexParams(
        search_limit=10,                      # Max Neocortex memory chunks per query
        system_prompt="Here are your past memories:",
        add_as_system_message=True,           # Add memories as system (True) or user (False) message
    ),
)
```

- At least one of `user_id`, `agent_id`, or `run_id` must be provided.
- `NeocortexParams.search_limit` is passed to Neocortex as `maxChunks`.

## Endpoint Mapping (Mastra-aligned)

This plugin now includes the same endpoint families exposed by the Mastra plugin:

- `POST /v1/memory/insert`
- `POST /v1/memory/query`
- `POST /v1/memory/admin/delete`
- `POST /v1/memory/sync`
- `POST /v1/memory/recall`
- `POST /v1/memory/memories/recall`
- `POST /v1/memory/chat`
- `POST /v1/memory/interact`
- `POST /v1/memory/documents`
- `POST /v1/memory/documents/batch`
- `GET /v1/memory/documents`
- `GET /v1/memory/documents/:documentId`
- `DELETE /v1/memory/documents/:documentId`
- `POST /v1/memory/queries`
- `POST /v1/memory/conversations`
- `POST /v1/memory/interactions`
- `POST /v1/memory/memories/thoughts`
- `GET /v1/memory/ingestion/jobs/:jobId`

## Pipeline Integration

Place `NeocortexMemoryService` between your context aggregator and LLM in the Pipecat pipeline:

```python
from pipecat.pipeline.pipeline import Pipeline

pipeline = Pipeline([
    transport.input(),
    stt,                # Speech-to-text for audio input
    user_context,       # User context aggregator
    memory,             # Neocortex memory service enhances context here
    llm,                # LLM for response generation
    tts,                # Optional: Text-to-speech
    transport.output(),
    assistant_context   # Assistant context aggregator
])
``]

## Advanced API Surface

`NeocortexMemoryService` now also exposes Mastra-style wrappers you can call directly:

- `sync_memory`
- `recall_memory_master`
- `recall_memories`
- `chat_memory`
- `interact_memory`
- `insert_document`
- `insert_documents_batch`
- `list_documents`
- `get_document`
- `delete_document`
- `query_memory_context`
- `chat_memory_context`
- `record_interactions`
- `recall_thoughts`
- `get_ingestion_job`
 
Run it with:

```bash
export TINYHUMANS_API_KEY=your_neocortex_api_key
export OPENAI_API_KEY=your_openai_key
uvicorn examples.voice_demo:app --reload --host 0.0.0.0 --port 8000
```

Then connect to `/chat` from your Pipecat-compatible client UI and speak; the agent will remember and reuse past conversation details via Neocortex.

