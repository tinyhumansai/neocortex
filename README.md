<div align="center">

<h1>Neocortex AI Memory - Your Second Brain</h1>

<p><b>Human-like AI Memory&nbsp; ◦ &nbsp;1B+ Token Processing&nbsp; ◦ &nbsp;Forgets Noise&nbsp; ◦ &nbsp;Interaction-Aware</b></p>

[![Discord](https://img.shields.io/badge/Discord-Join%20Chat-5865F2?logo=discord&logoColor=white)](https://discord.com/invite/k23Kn8nK)
[![Reddit](https://img.shields.io/badge/Reddit-r%2Ftinyhumansai-FF4500?logo=reddit&logoColor=white)](https://www.reddit.com/r/tinyhumansai/)
[![X](https://img.shields.io/badge/Follow-%40tinyhumansai-000000?logo=x&logoColor=white)](https://x.com/tinyhumansai)
[![Docs](https://img.shields.io/badge/Docs-GitBook-0A80FF?logo=gitbook&logoColor=white)](https://tinyhumans.gitbook.io/neocortex/)

<h4>
  <a href="#-benchmarks">Benchmarks</a>&nbsp; • &nbsp;
  <a href="#-getting-started">Getting Started</a>&nbsp; • &nbsp;
  <a href="BENCHMARKS.md">Full Results</a>&nbsp;
</h4>

</div>

<i>NOTE: That this model is currently in closed alpha. To get access <a href="mailto:founders@tinyhumans.ai">reach out to us</a></i>

<!-- # 🧠 Introduction to Neocortex -->

The human brain is a master at compression. It doesn't try to remember every passing detail; instead, it aggressively prunes noise to maintain a sharp, focused, and easily accessible recall of what truly matters. In contrast, traditional AI memory systems try to remember everything. They retrieve whatever is _similar_—but similar doesn't mean important. The result? Your AI drowns in stale, irrelevant context that degrades every response.

Inspired by how the human brain works, **Neocortex** takes a similar approach to AI memory: it **intelligently forgets noise**. Just like you don't remember every sentence you've ever read or everything happens every day in your life, Neocortex lets low-value memories naturally decay while reinforcing the knowledge that matters — the things you interact with, recall, and build upon.

The result? an AI memory system that can chop through over 1 billion tokens, stays lean and focused, and gets smarter with every interaction.

<!-- Neocortex ranks extremly high scores on [RAGAS](./benchmarks/01_ragas_sherlock.ipynb), [Babilong](./benchmarks/05_babilong.ipynb), [Vending Bench](./benchmarks/07_vendingbench.ipynb), [LoCoMo](./benchmarks/04_locomo.ipynb) and [HotPotQA](./benchmarks//02_hotpotqa.ipynb) -->

Neocortex ranks extremly high scores on [RAGAS](https://www.ragas.io/), [Babilong](https://github.com/booydar/babilong/), [Vending Bench](https://andonlabs.com/evals/vending-bench-2), [LoCoMo](https://github.com/snap-research/locomo) and [HotPotQA](https://hotpotqa.github.io/)

# 🎯 Core Features

## Intelligent Noise Filters

Memories that aren't accessed naturally decay over time. Frequently recalled knowledge becomes more durable. No manual cleanup needed — the system stays lean on its own.

<div align="center">
  <img src=".github/images/gif/AppleEmailGraph.gif" alt="Memory Decay Simulation" width="700"/>
</div>

## Interaction-Aware

Not all memories are equal. Views, reactions, replies, and content creation all signal what matters. Knowledge people engage with rises to the top; ignored information fades away.

<div align="center">
  <img src=".github/images/gif/BobMemoryDecayVideo.gif" alt="Interaction Graph" width="700"/>
</div>

## Low Latency, Low Cost, High Quality

There's no compromise on speed and quality when processing data with Neocortex. Everything is processed at low costs and low latency, while maintain high benchmarks.

# 📈 Benchmarks

### RAGAS — Retrieval Quality (Sherlock Holmes Corpus)

Standard RAG quality metrics evaluated using [RAGAS](https://docs.ragas.io/). Neocortex leads in **Answer Relevancy (0.97)** and **Context Precision (0.75)**, outperforming FastGraphRAG, Gemini VDB, Mem0, and SuperMemory.

<div align="center">
<img src=".github/images/chart_ragas.png" alt="RAGAS Benchmark" width="700"/>
</div>

### TemporalBench — Temporal Reasoning

Accuracy across ordering, state-at-time, recency, interval, and sequence questions. Neocortex achieves **100% on recency questions** — correctly surfacing the most recent events thanks to its time-decay memory model.

<div align="center">
<img src=".github/images/chart_temporalbench.png" alt="TemporalBench" width="700"/>
</div>

<!-- ### BABILong — Needle in a Haystack

Can the system find specific facts buried in large contexts? Neocortex is the **only method to successfully retrieve needles at 4k context length**, while directfeed (raw context window) scores 0% across all lengths.

<div align="center">
<img src=".github/images/heatmap_babilong.png" alt="BABILong Heatmap" width="600"/>
</div> -->

### Vending-Bench — Agentic Decision-Making

An agent manages a simulated vending machine business over 30 days. Neocortex achieves the **highest cumulative P&L (~$295 by day 30)** — better memory leads to better decisions over time.

<div align="center">
<img src=".github/images/chart_vendingbench.png" alt="Vending-Bench P&L" width="700"/>
</div>

---

# ⚡ Getting Started

### 1. Install

```bash
pip install tinyhumansai
```

### 2. Configure and Run

```python
import tinyhumansai as api

client = api.TinyHumanMemoryClient("YOUR_APIKEY_HERE")

# Store a single memory
client.ingest_memory({
    "key": "user-preference-theme",
    "content": "User prefers dark mode",
    "namespace": "preferences",
    "metadata": {"source": "onboarding"},
})

# Ask a LLM something from the memory
response = client.recall_with_llm(
    prompt="What is the user's preference for theme?",
    api_key="OPENAI_API_KEY"
)
print(response.text) # The user prefers dark mode
```
