# Neocortex artificial consciousness with a surprise-weighted context system

# Introduction

Modern LLMs can reason impressively within a single prompt, but building long-horizon systems remains hard. Despite steady progress in reasoning, LLMs are still constrained by finite context windows and weak persistence across interactions. Reasoning-oriented LLMs can allocate more computation to multi-step deliberation, yet they remain highly sensitive to what is placed into context, and naive RAG retrieval often treats memory as a flat collection of text chunks. Simply scaling context windows is expensive: attention and KV-cache costs grow rapidly with sequence length, and longer prompts can reduce accuracy by injecting irrelevant material, diluting key evidence, and increasing the chance that the model attends to the wrong details. Practical long-horizon systems therefore need memory mechanisms that select, structure, and refresh context rather than simply making the window bigger.

In parallel, a growing ecosystem of memory tooling has emerged that is already highly efficient at storing and retrieving information for LLM applications. Systems such as MemGPT, mem0, and Supermemory maintain external memory stores and retrieval policies that can prioritize memories by time/recency, entities and user profiles, interaction history, or task-specific reasoning needs. These approaches demonstrate that the core bottleneck is often not storage, but selecting the right facts at the right time under tight latency and token budgets.

The human brain faces an extreme noise problem: it continuously receives high-volume, ambiguous, and often redundant signals, yet it filters and compresses them into a small set of salient memories that influence future behavior. Many current LLM memory systems can store and retrieve efficiently, but they struggle to consistently infer and surface *importance*—what should be reinforced, what should be forgotten, and what should be promoted to durable state—especially when signals are subtle, long-range, or conflicting. Human memory offers a useful conceptual alternative: it is reinforced through use, decays over time, and is selectively updated when new experiences are surprising or contradictory, motivating forgetting-aware updates, episodic segmentation, graph-based retrieval, and persistent memory modules.

This paper introduces **Neocortex**, a product-level memory architecture that unifies these strands into a single operational pipeline. Neocortex continuously ingests new experience into structured memory and recalls context through a blend of semantic relevance, recency, interaction history, and surprise-weighted salience. At write time, the system parses documents into chunks, extracts entities and relations, persists them in graph/vector memory, and appends explicit state transitions to an event ledger. At recall time, the system routes queries either to broad semantic retrieval or to a deterministic state resolver when the question targets ordered state transitions. Memory is further modulated by reinforcement through access patterns and by Ebbinghaus-style forgetting dynamics.

Our main claim is that long-term AI memory should be treated as a **multi-store adaptive system** rather than a passive retrieval index. In particular, efficient token use requires not only better retrieval, but also mechanisms for forgetting noise, amplifying informative novelty, and separating semantic context from ordered state.

# Understanding the human brain

Before proposing implementation details, we briefly ground the design in biological memory principles. The goal is not to claim a complete neural equivalence, but to extract practical mechanisms for integration, selection, and retention that can improve long-horizon AI behavior.

## Purkinje cells

*The “we problem”* in artificial consciousness can be framed as a coordination problem: how separate signals become a coherent self-model that acts as a unified agent. In biological systems, this coherence is not produced by a single neuron, but by layered circuits that compress, filter, and synchronize information across time.

Purkinje cells provide a useful computational analogy for this coordination role. As the principal output neurons of the cerebellar cortex, they integrate massive parallel input, then emit sparse, inhibitory control signals that shape downstream behavior. Their architecture highlights three design principles relevant to AI memory: **(i)** high-dimensional input integration, **(ii)** selective gating of action, and **(iii)** temporal tuning through repeated feedback (see Figure <a href="#fig:purkinje-cell-diagram" data-reference-type="ref" data-reference="fig:purkinje-cell-diagram">1</a>).

<figure id="fig:purkinje-cell-diagram" data-latex-placement="t">
<img src="figures/purkinje-cell.png" style="width:80.0%" />
<figcaption>Purkinje cell diagram used as a biological reference for integration and gating.</figcaption>
</figure>

For Neocortex, this motivates a memory controller that does more than retrieve nearest neighbors. The system should aggregate semantic, episodic, and state-transition evidence, then gate what enters the active context. In other words, conscious-like behavior is approached not by storing everything, but by learning which memories should influence the current decision boundary.

## Ebbinghaus forgetting curve

The Ebbinghaus forgetting curve complements this view by formalizing a second constraint: *retention must decay unless reinforced*. Human memory is adaptive precisely because it forgets low-value details while preserving repeatedly useful structure. A practical AI memory system should follow the same rule.

This leads to an implementation strategy before tackling stronger claims about artificial consciousness: encode all candidate memories at write time, then modulate retention as a function of access frequency, recency, and utility. Neocortex operationalizes this with retention-aware scoring and periodic pruning, so stale or weakly supported memories lose influence while salient patterns remain available for recall.

Taken together, Purkinje-style gating and Ebbinghaus-style decay provide a biologically grounded bridge from the “we problem” to engineering practice. Before proposing full conscious architectures, we can already implement tractable mechanisms for integration, selection, and adaptive forgetting.

# Related Work

## Long-term memory for language models

Several recent systems address persistent memory in LLMs. MemoryBank augments conversational agents with a long-term memory store and a forgetting-aware update mechanism inspired by the Ebbinghaus forgetting curve. Its core contribution is the explicit treatment of memory retention as a dynamic process rather than static storage.

Titans introduces a neural long-term memory module that complements short-term attention, framing attention as short-term memory and persistent neural memory as a longer-lived store. The later MIRAS framework generalizes this view by casting sequence models as associative memory systems with explicit retention and attentional bias mechanisms.

These approaches motivate the idea that memory should not be identified with the context window alone. Instead, memory should be structured, persistent, and updated through principled retention mechanisms.

## Episodic segmentation and surprise

EM-LLM shows that long-context performance benefits from segmenting experience into events using Bayesian surprise and graph-theoretic boundary refinement. This is highly relevant to systems that must distinguish routine background information from important shifts in world state.

In cognitive science and neuroscience, prediction error has long been linked to memory updating, event segmentation, and adaptive learning. Unexpected events can either strengthen encoding or trigger the formation of a new memory boundary. This motivates the use of surprise as a write-time salience signal in memory systems.

## Graph-based memory and retrieval

GraphRAG and HippoRAG demonstrate that graph structure can improve retrieval beyond flat vector similarity. GraphRAG builds entity-centric knowledge graphs and supports more global, query-focused reasoning over corpora. HippoRAG combines graph structure with personalized PageRank to mimic aspects of long-term associative recall.

These systems support the Neocortex design choice to maintain a coherence graph over entities, relations, mentions, and chunks, rather than relying only on chunk embeddings.

## Forgetting and retention

The Ebbinghaus forgetting curve remains a foundational model for memory decay, though later work suggests that the precise functional form of forgetting can vary. For AI systems, the key principle is operational: memory strength should decrease with age unless reinforced, while repeated retrieval or interaction should slow future decay.

# Problem Formulation

We consider a language system that must answer user queries over an evolving corpus of documents and interactions. Let the memory store at time $`t`$ be

``` math
\mathcal{M}_t = \{ \mathcal{C}_t, \mathcal{G}_t, \mathcal{L}_t, \mathcal{I}_t \},
```

where:

- $`\mathcal{C}_t`$ is a chunk store with text and embeddings,

- $`\mathcal{G}_t`$ is a coherence graph over entities, relations, and mentions,

- $`\mathcal{L}_t`$ is an append-only state event ledger,

- $`\mathcal{I}_t`$ is an interaction history over users, workspaces, and entities.

The system must support two broad classes of queries:

1.  **Semantic recall queries**, which benefit from retrieving relevant chunks, entities, and relations.

2.  **Deterministic state queries**, which require reconstruction of ordered facts such as current holder, prior holder, location, movement, or transfer history.

The challenge is to retrieve a compact, high-value context under a token budget while preserving correctness and supporting continual updates.

# Neocortex Architecture

## End-to-end design

Neocortex continuously performs two processes:

1.  **Ingestion** of new experience into structured memory.

2.  **Recall** of context for downstream response generation.

The architecture separates write-time structuring from recall-time retrieval. This separation is important because many retrieval failures originate upstream: if memory is not encoded with entity links, state events, or salience metadata, it cannot later be selectively recalled.

## Memory layers

Neocortex contains four complementary memory layers.

#### Coherence memory

Coherence memory stores semantic and relational context over documents, chunks, entities, and relations. It supports open-ended retrieval where the answer may require broad contextual grounding rather than a single explicit state fact.

#### State ledger memory

The state ledger is an append-only event stream derived from chunk text and relation extraction. It records explicit transitions such as movement, possession, handoff, and spatial relations. This layer is used for deterministic state reconstruction.

#### Interaction memory

Interaction memory captures user or workspace engagement with entities and documents. Interaction strength is encoded through actions such as `view`, `read`, `react`, `engage`, and `create`. Retrieved items are reinforced through access count and last-accessed metadata.

#### Forgetting and surprise dynamics

A retention model reduces the salience of stale, unreinforced memory. A surprise model boosts non-redundant, behavior-changing content relative to routine or repeated facts.

# Ingestion Pipeline

## Parse and chunk

Incoming documents are first normalized and partitioned into bounded chunks. Chunking is necessary for embedding, retrieval, citation, and provenance tracking. Each chunk preserves local order and source metadata.

## Entity and relation extraction

From each chunk, Neocortex extracts entities and relations. These are linked into a coherence graph with mention-level metadata such as frequency, position, and source support. Embeddings are stored for chunks, entities, and possibly relations.

## Graph persistence

The system upserts graph structure and chunk metadata into graph/vector storage. This enables retrieval paths that use both semantic similarity and graph connectivity.

## State event ledger construction

In parallel with graph persistence, the system appends state events to a ledger. Each event contains:

- source document and chunk identifiers,

- sentence order and optional timestamps,

- normalized event type,

- involved entities,

- qualifiers and confidence,

- summary text for inspection.

This makes state-style queries auditable and order-sensitive.

## Surprise scoring

Optionally, each new chunk is compared against a baseline neighborhood in memory. If the mismatch is high, the system assigns a larger `prediction_error`; if the new information contradicts prior memory, the associated reward can be negative. This value is stored as `reward_weight` and later used to modulate salience during retrieval.

# Recall and Routing

## Query routing

Given a query $`q`$, Neocortex first decides whether the question is best handled by:

- a **semantic retrieval path**, or

- a **state resolver path**.

Queries that ask for current location, previous location, holder, transfer history, or spatial status are routed to the state resolver. Queries asking for themes, context, explanations, or broader summaries are routed to semantic retrieval.

## Semantic recall

Semantic recall retrieves chunks, entities, and relations using a blended score:

``` math
\text{Score}(m \mid q) =
\text{Rel}(m, q)
\cdot
\text{Retention}(m)
\cdot
\text{InteractionBias}(m)
\cdot
\text{SurpriseWeight}(m),
```

where $`\text{Rel}(m, q)`$ is semantic relevance, $`\text{Retention}(m)`$ captures recency and reinforcement, $`\text{InteractionBias}(m)`$ captures user or workspace importance, and $`\text{SurpriseWeight}(m)`$ prioritizes informative deltas.

## Deterministic state resolution

For state-style questions, the resolver reconstructs answers from ordered events in the ledger. This can bypass free-form generation when a deterministic answer exists, reducing hallucination risk and token usage.

# Forgetting and Reinforcement

Neocortex models retention using an Ebbinghaus-style decay process. Let $`a_m`$ denote the age in days of memory item $`m`$, and let $`n_m`$ denote its reinforcement count. Stability is defined as

``` math
S_m = S_0 \left( 1 + \gamma \ln(1 + n_m) \right),
```

where $`S_0`$ is the base stability and $`\gamma`$ is a growth factor. Retention is then

``` math
R_m = \exp(-a_m / S_m).
```

A configurable floor can clamp very low values to zero.

This formalism captures two desired behaviors:

1.  recently accessed memory decays more slowly;

2.  stale, unreinforced memory contributes less unless reactivated.

Each successful retrieval can update `last_accessed_at` and increment `access_count`, creating a closed loop:

``` math
\text{interact} \rightarrow \text{recall} \rightarrow \text{reinforce}.
```

# Surprise-Weighted Memory

Pure recency and frequency are insufficient because they overvalue repeated background facts. Neocortex therefore incorporates a surprise-weighted factor derived from prediction error.

Let $`m`$ be a newly ingested chunk and $`\mathcal{N}(m)`$ its nearest prior memory neighborhood. A prediction-error proxy can be defined as the mismatch between the new chunk and its expected baseline:

``` math
\delta_m = 1 - \text{sim}(m, \mathcal{N}(m)),
```

optionally augmented with graph-overlap disagreement or contradiction penalties. The stored salience factor can then be written as

``` math
W_m = f(\delta_m, c_m),
```

where $`c_m`$ captures contradiction or reward sign. High-surprise content receives a larger weight during future retrieval, while contradictory information can either suppress older beliefs or trigger state updates in the ledger.

Conceptually, this mechanism promotes memory that changes the system’ s world model rather than memory that merely repeats what is already known.

# Why a State Ledger Matters

Many practical questions are poorly served by flat retrieval. Consider queries such as:

- Who currently holds asset $`x`$?

- Where was object $`y`$ before it moved to room $`z`$?

- Which entity interacted most recently with node $`u`$?

These are not just retrieval tasks. They require ordered state reconstruction over transitions. By maintaining an append-only ledger, Neocortex supports deterministic resolution, provenance inspection, and conflict handling.

This design also separates two forms of truth:

- **coherence truth**, which emerges from broad supporting context;

- **state truth**, which is reconstructed from ordered transitions.

That distinction improves interpretability and reduces over-reliance on free-form synthesis.

# Token Efficiency and Product Implications

The core product claim of Neocortex is that better memory is also better token economy. Systems consume too many tokens not only because context windows are small, but because they lack mechanisms to suppress noise and preserve only what remains behaviorally useful.

Neocortex improves token efficiency in three ways:

1.  **Structured write-time compression** through chunking, entity extraction, and event normalization.

2.  **Selective recall** through retention-aware, interaction-aware, and surprise-aware retrieval.

3.  **Deterministic bypass** for state-style questions that do not require broad generative reasoning.

This reframes memory from a storage problem into a **salience allocation problem**.

# Limitations and Open Questions

Neocortex is a systems architecture rather than a single end-to-end trained model, and several issues remain open.

First, surprise estimation is only as good as the baseline against which novelty is measured. Poor nearest-neighbor memory can misestimate importance.

Second, event extraction for the state ledger may introduce schema errors or miss implicit transitions.

Third, retention parameters such as the base stability and growth factor are application-dependent and may require calibration.

Fourth, user interaction is an imperfect signal of importance. Frequently accessed information is not always the most correct or most valuable.

These challenges suggest future work on learned routing, contradiction management, uncertainty estimation, and offline memory consolidation.

# Conclusion

We presented Neocortex, a high-level memory pipeline for long-term AI systems that integrates coherence memory, state-ledger memory, interaction reinforcement, and forgetting plus surprise dynamics. The architecture is motivated by both recent memory-augmented language-model research and cognitive theories of retention and prediction error. The central idea is that memory should be written in structured form, recalled through routed mechanisms, strengthened through use, and allowed to forget when it no longer matters. We argue that such systems are better aligned with both practical retrieval needs and efficient token use, because they prioritize what is recent, reinforced, and informative rather than treating all stored text as equally valuable.

<div id="refs" class="references csl-bib-body hanging-indent">

<div id="ref-behrouz2025allconnected" class="csl-entry">

Behrouz, Ali, Meisam Razaviyayn, Peilin Zhong, and Vahab Mirrokni. 2025. “It’s All Connected: A Journey Through Test-Time Memorization, Attentional Bias, Retention, and Online Optimization.” *arXiv Preprint arXiv:2504.13173*.

</div>

<div id="ref-behrouz2025titans" class="csl-entry">

Behrouz, Ali, Peilin Zhong, and Vahab Mirrokni. 2025. “Titans: Learning to Memorize at Test Time.” *arXiv Preprint arXiv:2501.00663*.

</div>

<div id="ref-clewett2024predictions" class="csl-entry">

<span class="nocase">Clewett, Anne, and colleagues</span>. 2024. “Predictions Transform Memories: How Expected Versus Unexpected Events Shape Memory.” *Neuroscience and Biobehavioral Reviews*.

</div>

<div id="ref-edge2024graphrag" class="csl-entry">

Edge, Darren, Ha Trinh, Newman Cheng, et al. 2024. “From Local to Global: A Graph RAG Approach to Query-Focused Summarization.” *arXiv Preprint arXiv:2404.16130*.

</div>

<div id="ref-fountas2024emllm" class="csl-entry">

Fountas, Zafeirios, Martin A. Benfeghoul, Adnan Oomerjee, et al. 2024. “Human-Like Episodic Memory for Infinite Context LLMs.” *arXiv Preprint arXiv:2407.09450*.

</div>

<div id="ref-jimenez2024hipporag" class="csl-entry">

Jiménez Gutiérrez, Bernal, Yiheng Shu, Yu Gu, Michihiro Yasunaga, and Yu Su. 2024. “HippoRAG: Neurobiologically Inspired Long-Term Memory for Large Language Models.” *arXiv Preprint arXiv:2405.14831*.

</div>

<div id="ref-kim2024predictionerror" class="csl-entry">

<span class="nocase">Kim, and colleagues</span>. 2024. “Prediction Error Determines How Memories Are Organized in the Brain.” *eLife*.

</div>

<div id="ref-lewandowsky2015ebbinghaus" class="csl-entry">

<span class="nocase">Lewandowsky, Stephan, Sergio E. Hartwig, and colleagues</span>. 2015. “Replication and Analysis of Ebbinghaus’ Forgetting Curve.” *PLOS ONE*.

</div>

<div id="ref-wu2025survey" class="csl-entry">

<span class="nocase">Wu, Yaxiong, Xinyue Wang, Yue Zhang, et al.</span> 2025. “From Human Memory to AI Memory: A Survey on Memory Mechanisms in the Era of LLMs.” *arXiv Preprint arXiv:2504.15965*.

</div>

<div id="ref-zhong2023memorybank" class="csl-entry">

Zhong, Wanjun, Lianghong Guo, Qiqi Gao, He Ye, and Yanlin Wang. 2023. “MemoryBank: Enhancing Large Language Models with Long-Term Memory.” *arXiv Preprint arXiv:2305.10250*.

</div>

</div>
