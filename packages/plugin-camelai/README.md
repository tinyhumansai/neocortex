# plugin-camelai

Neocortex (TinyHuman) memory tools for CAMEL AI.

## Features

Provides `FunctionTool` wrappers that allow CAMEL AI agents to use the Neocortex memory API.

- `NeocortexToolkit`: wraps a `TinyHumanMemoryClient` and exposes `get_tools()`.
- Includes core memory tools (`save_memory`, `recall_memory`, `delete_memory`).
- Includes Mastra-aligned newer endpoints:
  - `sync_memory`
  - `insert_document`, `insert_documents_batch`, `list_documents`, `get_document`, `delete_document`
  - `query_memory_context`, `chat_memory_context`
  - `record_interactions`, `interact_memory`
  - `recall_thoughts`, `recall_memory_master`, `recall_memories`
  - `chat_memory`, `get_ingestion_job`, `get_graph_snapshot`

### Document Insert Contract

- `insert_document` requires `document_id`.
- `insert_documents_batch` requires `document_id` on every item in `items_json`.

## Installation

```bash
pip install neocortex-camelai
```

## Usage

Set your API key:
```bash
export TINYHUMANS_API_KEY="your_token_here"
```

### Passing Tools to Agents

Instantiate the toolkit with a `TinyHumanMemoryClient` and pass the tools to your agents as `FunctionTool` objects.

```python
import os
from camel.agents import ChatAgent
from camel.messages import BaseMessage
from tinyhumansai import TinyHumanMemoryClient
from neocortex_camelai import NeocortexToolkit

client = TinyHumanMemoryClient(token=os.getenv("TINYHUMANS_API_KEY"))
toolkit = NeocortexToolkit(client=client, default_namespace="camel_memory")
tools = toolkit.get_tools()
print(len(tools))  # 19 tools

system_msg = BaseMessage.make_assistant_message(
    role_name="Assistant",
    content="You are a helpful assistant with persistence. Use memory tools."
)

agent = ChatAgent(system_message=system_msg, tools=tools)

user_msg = BaseMessage.make_user_message(role_name="User", content="Remember my name is Alice.")
response = agent.step(user_msg)
print(response.msgs[0].content)
```

### Calling newer methods directly

You can also call toolkit methods directly outside CAMEL tool-calling flows:

```python
result = toolkit.query_memory_context(
    query="What does the user like?",
    namespace="camel_memory",
    max_chunks=5,
)
print(result)  # JSON string response or error text
```
