# Recall

**Recalling** is how you retrieve memories. You provide a natural-language prompt and Neocortex returns the most relevant memories as an LLM-ready context string.

## Basic Usage

```python
ctx = client.recall_memory(
    namespace="preferences",
    prompt="What dietary restrictions does the user have?",
    num_chunks=10,
)
print(ctx.context)  # Formatted string ready for an LLM prompt
print(ctx.items)    # Individual memory items
print(ctx.count)    # Number of items returned
```

## How It Works

Recall is **prompt-driven:** the system uses your query to find the most relevant memories, not just the most recent. Neocortex considers semantic relevance, time-decay, and interaction signals to rank results.

## Filter by Key

If you know exactly which memories you need, you can filter by key instead of using prompt-based retrieval:

```python
ctx = client.recall_memory(namespace="preferences", prompt="", key="fav-color", num_chunks=10)
```

## Recall with LLM

For convenience, you can recall and query an LLM in one step. Neocortex fetches the relevant context and injects it into the LLM prompt automatically:

```python
response = client.recall_with_llm(
    prompt="What dietary restrictions does the user have?",
    namespace="preferences",
    provider="openai",
    model="gpt-4o-mini",
    api_key="your-openai-key",
)
print(response.text)
```

Supports OpenAI, Anthropic, Google Gemini, and any OpenAI-compatible endpoint.
