# alphahuman-langgraph

LangGraph integration for the [Alphahuman Memory API](https://alphahuman.xyz).
Provides `@tool`-decorated functions for use as LangGraph nodes or LLM tool-calling.

## Requirements

- Python ≥ 3.9
- `alphahuman-memory >= 0.1.0`
- `langgraph >= 0.2`
- `langchain-core >= 0.3`

## Install

```bash
pip install alphahuman-langgraph
```

## Usage — factory pattern (recommended)

Use `make_memory_tools` to create tools with credentials baked in. Credentials
are **never** exposed to the LLM as tool parameters, preventing prompt-injection attacks.

```python
from langchain_openai import ChatOpenAI
from alphahuman_langgraph import make_memory_tools

tools = make_memory_tools(token="your-api-key")

# Bind to a model for LLM tool-calling
model = ChatOpenAI(model="gpt-4o").bind_tools(tools)
```

## Usage — LangGraph node

```python
from langgraph.graph import StateGraph, MessagesState
from alphahuman_langgraph import make_memory_tools

ingest_tool, read_tool, delete_tool = make_memory_tools(token="your-api-key")

def memory_node(state: MessagesState):
    result = ingest_tool.invoke({
        "items": [{"key": "fact-1", "content": "User likes Python"}]
    })
    return {"messages": [f"Memory ingested: {result}"]}

graph = StateGraph(MessagesState)
graph.add_node("memory", memory_node)
```

## Usage — environment variables

If you prefer to configure via environment, set `ALPHAHUMAN_API_KEY` (required)
and optionally `ALPHAHUMAN_BASE_URL`, then call `get_tools()`:

```bash
export ALPHAHUMAN_API_KEY="your-api-key"
```

```python
from alphahuman_langgraph import get_tools

tools = get_tools()
```

## Available tools

| Tool | Description |
|------|-------------|
| `alphahuman_ingest_memory` | Upsert one or more memory items |
| `alphahuman_read_memory` | Read items filtered by key / keys / namespace |
| `alphahuman_delete_memory` | Delete items by key / keys / delete_all |

## Error handling

Tools raise `AlphahumanError` (from `alphahuman_memory`) on API failures and
`ValueError` on invalid input. Both propagate normally through LangGraph.
