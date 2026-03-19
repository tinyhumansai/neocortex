# plugin-llamaindex

Neocortex (Alphahuman) memory integration for LlamaIndex.

## Features

- **`NeocortexChatStore`**: A persistent chat store for LlamaIndex `ChatMemoryBuffer` that saves conversation history using the TinyHumans memory API.
- **`NeocortexToolSpec`**: A LlamaIndex `BaseToolSpec` that provides explicit `save_memory`, `recall_memory`, and `delete_memory` tools for LlamaIndex agents.

## Installation

```bash
pip install neocortex-llamaindex
```

## Usage

Set your API key:
```bash
export ALPHAHUMAN_API_KEY="your_token_here"
```

### Chat Store Pattern

Automatically persist chat history across sessions.

```python
import os
from tinyhumansai import TinyHumanMemoryClient
from neocortex_llamaindex import NeocortexChatStore
from llama_index.core.memory import ChatMemoryBuffer
from llama_index.core.agent import ReActAgent
from llama_index.llms.openai import OpenAI

client = TinyHumanMemoryClient(token=os.getenv("ALPHAHUMAN_API_KEY"))
chat_store = NeocortexChatStore(client=client, namespace_prefix="llamaindex_chat")

memory = ChatMemoryBuffer.from_defaults(
    token_limit=3000, 
    chat_store=chat_store, 
    chat_store_key="user_session_1"
)

agent = ReActAgent.from_tools([], llm=OpenAI(), memory=memory)
agent.chat("Hello there!")
```

### Explicit Memory Tools

Give your agents the ability to explicitly save and recall facts.

```python
import os
from tinyhumansai import TinyHumanMemoryClient
from neocortex_llamaindex import NeocortexToolSpec
from llama_index.core.agent import ReActAgent
from llama_index.llms.openai import OpenAI

client = TinyHumanMemoryClient(token=os.getenv("ALPHAHUMAN_API_KEY"))
memory_tools = NeocortexToolSpec(client=client).to_tool_list()

agent = ReActAgent.from_tools(memory_tools, llm=OpenAI())
agent.chat("Remember that my name is Alice.")
```
