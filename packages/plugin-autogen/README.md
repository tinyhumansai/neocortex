# plugin-autogen

Neocortex (TinyHuman) memory tools for Microsoft AutoGen.

## Features

Provides explicit Python functions that allow AutoGen agents to use a Mastra-aligned Neocortex tool surface.
- **`NeocortexMemoryTools`**: Class wrapping the memory client and exposing the tool methods.
- **`register_neocortex_tools`**: Helper function to register the tools to AutoGen agents.

Tool methods:
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
pip install neocortex-autogen
```

## Usage

Set your API key:
```bash
export TINYHUMANS_API_KEY="your_token_here"
```

### Expose tools to your AutoGen agent

`NeocortexMemoryTools(...)` only creates Python methods.  
To make them callable by the agent, you must register them with `register_neocortex_tools(...)`.

AutoGen uses a caller/executor split:
- **caller**: usually `AssistantAgent` (LLM proposes tool calls)
- **executor**: usually `UserProxyAgent` (runs tool functions locally)

If you skip registration, the agent cannot see or call any Neocortex tools.

Instantiate the tools with a `TinyHumanMemoryClient` and register them to your agents.

```python
import os
import autogen
from tinyhumansai import TinyHumanMemoryClient
from neocortex_autogen import NeocortexMemoryTools, register_neocortex_tools

client = TinyHumanMemoryClient(token=os.getenv("TINYHUMANS_API_KEY"))
memory_tools = NeocortexMemoryTools(client=client, default_namespace="autogen_memory")

assistant = autogen.AssistantAgent("assistant", llm_config={"config_list": [...]})
user_proxy = autogen.UserProxyAgent("user_proxy", human_input_mode="NEVER")

# The assistant proposes tools, the user_proxy executes them locally.
register_neocortex_tools(tools=memory_tools, caller=assistant, executor=user_proxy)

user_proxy.initiate_chat(assistant, message="Remember my name is Alice.")
```

### OpenCode-style prompting for tool use

After registration, add clear instructions so your agent actually uses the tools:

```python
assistant = autogen.AssistantAgent(
    "assistant",
    llm_config={"config_list": [...]},
    system_message=(
        "You have Neocortex memory tools. "
        "Use save_memory for new facts, recall_memory/query_memory_context before answering "
        "memory questions, and delete_memory only when explicitly requested."
    ),
)
```

### E2E example

Run the package smoke example:

```bash
cd packages/plugin-autogen
python3 examples/autogen_agent.py
```

It exercises registration and tool-calling across save/recall, documents, context/chat, interactions, sync, ingestion status, and cleanup.

## Available registered tools

`register_neocortex_tools(...)` registers:

- `save_memory`, `recall_memory`, `delete_memory`
- `sync_memory`
- `insert_document`, `insert_documents_batch`
- `list_documents`, `get_document`, `delete_document`
- `query_memory_context`, `chat_memory_context`
- `record_interactions`, `recall_thoughts`
- `chat_memory`, `interact_memory`
- `recall_memory_master`, `recall_memories`
- `get_ingestion_job`
