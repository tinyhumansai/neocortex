# plugin-vercelai

Neocortex (Alphahuman) memory integrations for the Python Vercel AI SDK (`ai_sdk`).

## Features

Provides explicitly `@tool` decorated functions ready to be injected into the `tools` array of Vercel AI SDK calls.
- **`NeocortexMemoryTools`**: Wrapper class for the memory client.
  - `get_tools()`: Returns a dictionary of configured tools (Mastra-compatible tool surface).

Tools:
- `save_memory`, `recall_memory`, `delete_memory`
- `sync_memory`
- `insert_document`, `insert_documents_batch`
- `list_documents`, `get_document`, `delete_document`
- `query_memory_context`, `chat_memory_context`
- `record_interactions`, `recall_thoughts`
- `chat_memory`, `interact_memory`
- `recall_memory_master`, `recall_memories`
- `get_ingestion_job`

### Document Insert Contract

- `insert_document` requires `document_id`.
- `insert_documents_batch` requires `document_id` on every item in `items_json`.

## Installation

```bash
pip install neocortex-vercelai
```

## Usage

Set your API keys:
```bash
export ALPHAHUMAN_API_KEY="your_token_here"
export OPENAI_API_KEY="your_openai_token"
```

### Passing Tools to Vercel AI SDK

Instantiate the wrappers, grab the tools and pass them to the `generate_text` or `stream_text` methods. Make sure to set `max_steps > 1` so the SDK loops automatically to execute the tool blocks.

```python
import asyncio
import os
from ai_sdk import generate_text
from ai_sdk.providers.openai import openai
from ai_sdk.messages import UserMessage

from tinyhumansai import TinyHumanMemoryClient
from neocortex_vercelai import NeocortexMemoryTools

async def main():
    memory_client = TinyHumanMemoryClient(token=os.getenv("ALPHAHUMAN_API_KEY"))
    wrapper = NeocortexMemoryTools(client=memory_client, default_namespace="vercelai_session")
    
    tools = wrapper.get_tools()

    result = await generate_text(
        model=openai("gpt-4o"),
        messages=[UserMessage(content="Remember my favorite movie is The Matrix.")],
        tools=tools,
        max_steps=5 # Crucial for the SDK to auto-execute the tool and reply
    )
    
    print(result.text)

if __name__ == "__main__":
    asyncio.run(main())
```
