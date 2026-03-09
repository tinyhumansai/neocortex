# Introducing Neocortex 🧠

The human brain doesn't try to remember every passing detail — it aggressively prunes noise to maintain sharp, focused recall of what truly matters. Traditional AI memory systems do the opposite: they retrieve whatever is _similar_, but similar doesn't mean important. The result? Your AI drowns in stale, irrelevant context that degrades every response.

**Neocortex** is a brain-inspired AI memory system that **intelligently forgets noise**. Just like you don't remember every sentence you've ever read, Neocortex lets low-value memories naturally decay while reinforcing the knowledge that matters — the things you interact with, recall, and build upon.

The result: an AI memory system that can process over **1 billion tokens**, stays lean and focused, and gets smarter with every interaction.

## Core Features

### Intelligent Noise Filtering

Memories that aren't accessed naturally decay over time. Frequently recalled knowledge becomes more durable. No manual cleanup needed — the system stays lean on its own.

<div align="center"><img src=".gitbook/assets/AppleEmailGraph.gif" alt="Memory Decay Simulation" width="700"></div>

### Interaction-Aware

Not all memories are equal. Views, reactions, replies, and content creation all signal what matters. Knowledge people engage with rises to the top; ignored information fades away.

<div align="center"><img src=".gitbook/assets/BobMemoryDecayVideo.gif" alt="Interaction Graph" width="700"></div>

### Low Latency, Low Cost, High Quality

No compromise on speed and quality when processing data with Neocortex. Everything is processed at low cost and low latency while maintaining high benchmark scores.

## Quick Start

```bash
pip install tinyhumansai
```

```python
import tinyhumansai as api

client = api.TinyHumanMemoryClient("YOUR_APIKEY_HERE")

# Store a memory
client.ingest_memory({
    "key": "user-preference-theme",
    "content": "User prefers dark mode",
    "namespace": "preferences",
    "metadata": {"source": "onboarding"},
})

# Ask a question using stored memory
response = client.recall_with_llm(
    prompt="What is the user's preference for theme?",
    api_key="OPENAI_API_KEY"
)
print(response.text)  # The user prefers dark mode
```

{% hint style="info" %}
Neocortex is currently in **closed alpha**. To get access, [reach out to us](mailto:founders@tinyhumans.ai).
{% endhint %}
