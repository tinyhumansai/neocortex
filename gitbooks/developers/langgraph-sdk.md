# LangGraph Integration

Drop-in memory tools for [LangGraph](https://langchain-ai.github.io/langgraph/) agent workflows. Provides `@tool`-decorated functions for use as LangGraph nodes or LLM tool-calling.

## Requirements

- Python 3.9+
- `langgraph >= 0.2`
- `langchain-core >= 0.3`

## Install

```bash
pip install alphahuman-langgraph
```

## Quick Start — Factory Pattern (Recommended)

Use `make_memory_tools` to create tools with credentials baked in. Credentials are **never** exposed to the LLM as tool parameters, preventing prompt-injection attacks.

```python
from langchain_openai import ChatOpenAI
from alphahuman_langgraph import make_memory_tools

tools = make_memory_tools(token="your-api-key")

# Bind to a model for LLM tool-calling
model = ChatOpenAI(model="gpt-4o").bind_tools(tools)
```

## Usage as a LangGraph Node

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

## Environment Variables

You can configure via environment instead of passing credentials directly:

```bash
export ALPHAHUMAN_API_KEY="your-api-key"
```

```python
from alphahuman_langgraph import get_tools

tools = get_tools()
```

## Available Tools

| Tool | Description |
| --- | --- |
| `alphahuman_ingest_memory` | Upsert one or more memory items |
| `alphahuman_read_memory` | Read items filtered by key / keys / namespace |
| `alphahuman_delete_memory` | Delete items by key / keys / delete\_all |

## Error Handling

Tools raise `AlphahumanError` on API failures and `ValueError` on invalid input. Both propagate normally through LangGraph.
