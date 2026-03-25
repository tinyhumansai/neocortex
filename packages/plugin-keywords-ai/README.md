# plugin-keywords-ai

Neocortex (TinyHuman) memory integrations for the Keywords AI platform, providing standard OpenAI-compatible JSON tool schemas.

## Features

Provides schemas and execution maps for AI models over a Mastra-aligned Neocortex tool surface.
- **`NeocortexMemoryTools`**
  - `get_tool_definitions()`: List of dictionaries matching the OpenAI `tools` parameter shape.
  - `get_tool_functions()`: Dictionary mapping the tool's name to the executable Python method.

Tool set includes:
- `save_memory`, `recall_memory`, `delete_memory`
- `sync_memory`
- `insert_document`, `insert_documents_batch`, `list_documents`, `get_document`, `delete_document`
- `query_memory_context`, `chat_memory_context`
- `record_interactions`, `recall_thoughts`
- `chat_memory`, `interact_memory`
- `recall_memory_master`, `recall_memories`
- `get_ingestion_job`, `get_graph_snapshot`

### Document Insert Contract

- `insert_document` requires `document_id`.
- `insert_documents_batch` requires `document_id` on every item in `items_json`.

## Installation

```bash
pip install neocortex-keywordsai
```

## Usage

Set your API keys:
```bash
export TINYHUMANS_API_KEY="your_token_here"
export KEYWORDSAI_API_KEY="your_keywords_token"
```

### Passing Tools to Keywords AI

Instantiate the wrappers, grab the schemas and pass them to your completions call. When the model returns a `tool_calls` response, map the name to the function dictionary.

```python
import os
import json
from keywordsai.main import KeywordsAI
from tinyhumansai import TinyHumanMemoryClient
from neocortex_keywordsai import NeocortexMemoryTools

# Initialize
kw_client = KeywordsAI(api_key=os.getenv("KEYWORDSAI_API_KEY"))
memory_client = TinyHumanMemoryClient(token=os.getenv("TINYHUMANS_API_KEY"))
memory_wrapper = NeocortexMemoryTools(client=memory_client, default_namespace="my_session")

# Get definitions and callable map
tools = memory_wrapper.get_tool_definitions()
functions = memory_wrapper.get_tool_functions()
print(len(tools))  # 20

# Call LLM
response = kw_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Remember my secret code is 1234."}],
    tools=tools, # Pass schemas here
)

choice = response.choices[0]
if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
    for tool_call in choice.message.tool_calls:
        name = tool_call.function.name
        args = json.loads(tool_call.function.arguments)
        
        # Dispatch to the function locally
        if name in functions:
            result = functions[name](**args)
            print(f"Tool executed successfully: {result}")
```

### E2E example

Run the package smoke example:

```bash
cd packages/plugin-keywords-ai
python3 examples/keywordsai_agent.py
```
