# plugin-crewai

Neocortex (Alphahuman) memory tools for CrewAI.

## Features

Provides explicit `BaseTool` implementations that allow CrewAI agents to save, recall, and delete memories using the TinyHumans memory API.
- **`NeocortexSaveMemoryTool`**
- **`NeocortexRecallMemoryTool`**
- **`NeocortexDeleteMemoryTool`**

## Installation

```bash
pip install neocortex-crewai
```

## Usage

Set your API key:
```bash
export ALPHAHUMAN_API_KEY="your_token_here"
```

### Passing Tools to Agents

Instantiate the tools with a `TinyHumanMemoryClient` and pass them to your agents.

```python
import os
from crewai import Agent
from tinyhumansai import TinyHumanMemoryClient
from neocortex_crewai import NeocortexSaveMemoryTool, NeocortexRecallMemoryTool

client = TinyHumanMemoryClient(token=os.getenv("ALPHAHUMAN_API_KEY"))

save_tool = NeocortexSaveMemoryTool(client=client, default_namespace="my_crew")
recall_tool = NeocortexRecallMemoryTool(client=client, default_namespace="my_crew")

researcher = Agent(
    role='Memory Researcher',
    goal='Store facts and recall them accurately.',
    backstory='You are an AI assistant that can persist thoughts.',
    tools=[save_tool, recall_tool],
)
```
