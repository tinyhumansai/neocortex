# RAGAS

## What It Measures

Standard retrieval-augmented generation quality — answer correctness, faithfulness, answer relevancy, context precision, and context recall.

## Methodology

50 questions generated from the complete Sherlock Holmes corpus across 4 question types: inference, multi-hop, cross-story, and analytical. Evaluated using [RAGAS 0.4.x](https://docs.ragas.io/) with GPT-4o as the judge model. Each method ingests the same chunked corpus, then answers all questions. RAGAS scores are computed per-question and aggregated.

## Methods Compared

neocortex\_v1, fastgraphrag, gemini\_vdb, mem0, supermemory

## Results

<div align="center"><img src="../.gitbook/assets/chart_ragas.png" alt="RAGAS Benchmark Scores" width="700"></div>

| Metric             | Neocortex | Best Competitor | Competitor  |
| ------------------ | --------- | --------------- | ----------- |
| Answer Relevancy   | **0.97**  | 0.88            | supermemory |
| Context Precision  | **0.75**  | 0.76            | supermemory |
| Faithfulness       | 0.73      | **0.79**        | gemini\_vdb |
| Answer Correctness | 0.57      | **0.59**        | gemini\_vdb |
| Context Recall     | 0.62      | **0.70**        | gemini\_vdb |

## Analysis

Neocortex achieves the highest Answer Relevancy score by a significant margin (0.97 vs 0.88) and is competitive on Context Precision. The graph-based retrieval ensures that returned context is highly relevant to the query, even when the answer requires cross-story reasoning.
