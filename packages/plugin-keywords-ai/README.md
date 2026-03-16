# plugin-keywords-ai

Neocortex (Alphahuman) memory integrations for the Keywords AI platform, providing standard OpenAI-compatible JSON tool schemas.

## Features

Provides schemas and execution maps for AI models to save, recall, and delete memories over the TinyHumans memory API.
- **`NeocortexMemoryTools`**
  - `get_tool_definitions()`: List of dictionaries matching the OpenAI `tools` parameter shape.
  - `get_tool_functions()`: Dictionary mapping the tool's name to the executable Python method.

## Installation

```bash
pip install neocortex-keywordsai
```

## Usage

Set your API keys:
```bash
export ALPHAHUMAN_API_KEY="your_token_here"
export KEYWORDSAI_API_KEY="your_keywords_token"
```

### Passing Tools to Keywords AI

Instantiate the wrappers, grab the schemas and pass them to your completions call. When the model returns a `tool_calls` response, map the name to the function dictionary.

```python
import os
import json
from keywordsai.main import KeywordsAI
from tinyhumansai import TinyHumanMemoryClient
from neocortex_keywordsai import NeocortexMemoryTools

# Initialize
kw_client = KeywordsAI(api_key=os.getenv("KEYWORDSAI_API_KEY"))
memory_client = TinyHumanMemoryClient(token=os.getenv("ALPHAHUMAN_API_KEY"))
memory_wrapper = NeocortexMemoryTools(client=memory_client, default_namespace="my_session")

# Get definitions and caller dictionary
tools = memory_wrapper.get_tool_definitions()
functions = memory_wrapper.get_tool_functions()

# Call LLM
response = kw_client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Remember my secret code is 1234."}],
    tools=tools, # Pass schemas here
)

choice = response.choices[0]
if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
    for tool_call in choice.message.tool_calls:
        name = tool_call.function.name
        args = json.loads(tool_call.function.arguments)
        
        # Dispatch to the function locally
        if name in functions:
            result = functions[name](**args)
            print(f"Tool executed successfully: {result}")
```
