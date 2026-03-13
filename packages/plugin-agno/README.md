# Neocortex Agno Plugin

Agno plugin for **Neocortex-powered memories** in Agno agents. Gives your agents persistent memory (save, recall, delete) via the Neocortex/TinyHumans API, with credentials kept out of tool parameters.

## Requirements

- Python 3.9+
- [Agno](https://pypi.org/project/agno/) ≥ 2.0
- [httpx](https://www.python-httpx.org/) (brought in as a dependency) for talking to the Alphahuman backend.

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
    tools=[NeocortexTools(token="YOUR_ALPHAHUMAN_API_KEY")],
    instructions="Use the memory tools to remember and recall user preferences and context.",
    markdown=True,
)

# Agent can now save and recall memories
agent.print_response("Remember that I prefer dark mode and my name is Alex.", stream=True)
agent.print_response("What theme do I prefer?", stream=True)
```

## Available tools

The `NeocortexTools` toolkit exposes three tools to the agent:


| Tool            | Description                                                           |
| --------------- | --------------------------------------------------------------------- |
| `save_memory`   | Save or update a memory (key, content, namespace, optional metadata). |
| `recall_memory` | Recall relevant memories for a natural-language query in a namespace. |
| `delete_memory` | Delete one or more memories by key/keys or delete all in a namespace. |


Credentials (`token`, `model_id`, `base_url`) are set when constructing `NeocortexTools` and are **never** passed as tool arguments, so the LLM cannot see or override them.

## Configuration

- **token** (required): Alphahuman / Neocortex memory API token (e.g. `ALPHAHUMAN_API_KEY`).
- **base_url** (optional): Alphahuman API base URL. If omitted, uses the `ALPHAHUMAN_BASE_URL` env var or the default `https://staging-api.alphahuman.xyz`.

## Error handling

On API failures, the underlying client raises `TinyHumanError`. You can catch it for logging or user-facing messages:

```python
from neocortex_agno import NeocortexTools, AlphahumanError

try:
    agent.print_response("Remember that I like Python.", stream=True)
except AlphahumanError as e:
    print(f"Memory API error: {e} (status={e.status})")
```

## Example

An example script is included. Set `ALPHAHUMAN_API_KEY`, `ALPHAHUMAN_BASE_URL`, and `OPENAI_API_KEY`, then:

```bash
python example.py
```

