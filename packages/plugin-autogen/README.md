# plugin-autogen

Neocortex (Alphahuman) memory tools for Microsoft AutoGen.

## Features

Provides explicit Python functions that allow AutoGen agents to save, recall, and delete memories using the TinyHumans memory API.
- **`NeocortexMemoryTools`**: Class wrapping the memory client and exposing the tool methods.
- **`register_neocortex_tools`**: Helper function to register the tools to AutoGen agents.

## Installation

```bash
pip install neocortex-autogen
```

## Usage

Set your API key:
```bash
export ALPHAHUMAN_API_KEY="your_token_here"
```

### Passing Tools to Agents

Instantiate the tools with a `TinyHumanMemoryClient` and register them to your agents.

```python
import os
import autogen
from tinyhumansai import TinyHumanMemoryClient
from neocortex_autogen import NeocortexMemoryTools, register_neocortex_tools

client = TinyHumanMemoryClient(token=os.getenv("ALPHAHUMAN_API_KEY"))
memory_tools = NeocortexMemoryTools(client=client, default_namespace="autogen_memory")

assistant = autogen.AssistantAgent("assistant", llm_config={"config_list": [...]})
user_proxy = autogen.UserProxyAgent("user_proxy", human_input_mode="NEVER")

# The assistant proposes tools, the user_proxy executes them locally
register_neocortex_tools(tools=memory_tools, caller=assistant, executor=user_proxy)

user_proxy.initiate_chat(assistant, message="Remember my name is Alice.")
```
