# plugin-crewai

Neocortex (TinyHuman) memory tools for CrewAI.

## Features

Provides explicit `BaseTool` implementations that expose a Mastra-aligned Neocortex tool surface in CrewAI.

Core tools:
- `NeocortexSaveMemoryTool`
- `NeocortexRecallMemoryTool`
- `NeocortexDeleteMemoryTool`

Newer endpoint tools:
- `NeocortexSyncMemoryTool`
- `NeocortexInsertDocumentTool`
- `NeocortexInsertDocumentsBatchTool`
- `NeocortexListDocumentsTool`
- `NeocortexGetDocumentTool`
- `NeocortexDeleteDocumentTool`
- `NeocortexQueryMemoryContextTool`
- `NeocortexChatMemoryContextTool`
- `NeocortexRecordInteractionsTool`
- `NeocortexRecallThoughtsTool`
- `NeocortexChatMemoryTool`
- `NeocortexInteractMemoryTool`
- `NeocortexRecallMemoryMasterTool`
- `NeocortexRecallMemoriesTool`
- `NeocortexGetIngestionJobTool`
- `NeocortexGetGraphSnapshotTool`

### Document Insert Contract

- `insert_document` requires `document_id`.
- `insert_documents_batch` requires `document_id` on every item in `items_json`.

Helper:
- `create_neocortex_tools(client, default_namespace)` returns all tools pre-built.

## Installation

```bash
pip install neocortex-crewai
```

## Usage

Set your API key:
```bash
export TINYHUMANS_API_KEY="your_token_here"
```

### Passing Tools to Agents

Instantiate tools with a `TinyHumanMemoryClient` and pass them to your agents.

```python
import os
from crewai import Agent
from tinyhumansai import TinyHumanMemoryClient
from neocortex_crewai import create_neocortex_tools

client = TinyHumanMemoryClient(token=os.getenv("TINYHUMANS_API_KEY"))
tools = create_neocortex_tools(client=client, default_namespace="my_crew")

researcher = Agent(
    role='Memory Researcher',
    goal='Store facts and recall them accurately.',
    backstory='You are an AI assistant that can persist thoughts.',
    tools=tools,
)
```

### E2E example

Run the package smoke example:

```bash
cd packages/plugin-crewai
python3 examples/crewai_agent.py
```

The example exercises broad tool coverage (save/recall, documents, context/chat, interactions, recall variants, sync/job/admin snapshot, cleanup) and prints each call result.
