# plugin-camelai

Neocortex (Alphahuman) memory tools for CAMEL AI.

## Features

Provides `FunctionTool` wrappers that allow CAMEL AI agents to save, recall, and delete memories using the TinyHumans memory API.
- **`NeocortexToolkit`**: Class wrapping the memory client and exposing the `get_tools()` method to provide the tools to the agent.

## Installation

```bash
pip install neocortex-camelai
```

## Usage

Set your API key:
```bash
export ALPHAHUMAN_API_KEY="your_token_here"
```

### Passing Tools to Agents

Instantiate the toolkit with a `TinyHumanMemoryClient` and pass the tools to your agents as `FunctionTool` objects.

```python
import os
from camel.agents import ChatAgent
from camel.messages import BaseMessage
from tinyhumansai import TinyHumanMemoryClient
from neocortex_camelai import NeocortexToolkit

client = TinyHumanMemoryClient(token=os.getenv("ALPHAHUMAN_API_KEY"))
toolkit = NeocortexToolkit(client=client, default_namespace="camel_memory")
tools = toolkit.get_tools()

system_msg = BaseMessage.make_assistant_message(
    role_name="Assistant",
    content="You are a helpful assistant with persistence. Use memory tools."
)

agent = ChatAgent(system_message=system_msg, tools=tools)

user_msg = BaseMessage.make_user_message(role_name="User", content="Remember my name is Alice.")
response = agent.step(user_msg)
print(response.msgs[0].content)
```
