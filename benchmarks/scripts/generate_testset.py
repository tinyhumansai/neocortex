"""Generate high-complexity RAGAS-compatible test set from Sherlock Holmes corpus.

Produces questions that stress-test retrieval relevancy:
  - Multi-hop: require combining facts from different parts of the text
  - Cross-story: compare characters, methods, or themes across stories
  - Analytical: require reasoning about motives, deductions, or relationships
  - Factual-hard: require precise details that aren't in the most obvious passage

Run once to create testset/sherlock_holmes.json, then commit the output.

Usage:
    python scripts/generate_testset.py
    python scripts/generate_testset.py --num-questions 50
    python scripts/generate_testset.py --difficulty hard
"""

import argparse
import asyncio
import json
import os
import random
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Ensure repo root is on sys.path so ``helpers`` is importable.
_REPO_ROOT = str(Path(__file__).resolve().parent.parent.parent)
if _REPO_ROOT not in sys.path:
  sys.path.insert(0, _REPO_ROOT)

from helpers.chunking import chunk_corpus


def load_config() -> dict:
  config_path = os.path.join(_PROJECT_ROOT, "config.json")
  if os.path.exists(config_path):
    with open(config_path) as f:
      return json.load(f)
  return {}


def chunk_text(text: str, chunk_size: int = 1200, chunk_overlap: int = 200) -> list[str]:
  """Split text into overlapping chunks (delegates to helpers)."""
  return [c.text for c in chunk_corpus(text, chunk_size, chunk_overlap)]


# ---------------------------------------------------------------------------
# Story splitter — gives us story-level grouping for cross-story questions
# ---------------------------------------------------------------------------

# The adventures are separated by roman-numeral headings in the Gutenberg text.
_STORY_TITLES = [
  "A SCANDAL IN BOHEMIA",
  "THE RED-HEADED LEAGUE",
  "A CASE OF IDENTITY",
  "THE BOSCOMBE VALLEY MYSTERY",
  "THE FIVE ORANGE PIPS",
  "THE MAN WITH THE TWISTED LIP",
  "THE ADVENTURE OF THE BLUE CARBUNCLE",
  "THE ADVENTURE OF THE SPECKLED BAND",
  "THE ADVENTURE OF THE ENGINEER\u2019S THUMB",
  "THE ADVENTURE OF THE NOBLE BACHELOR",
  "THE ADVENTURE OF THE BERYL CORONET",
  "THE ADVENTURE OF THE COPPER BEECHES",
]


def split_into_stories(text: str) -> dict[str, str]:
  """Split the corpus into individual stories by their chapter headings.

  The Gutenberg text has headings like 'I. A SCANDAL IN BOHEMIA' in all-caps
  (distinct from the mixed-case table of contents).
  """
  stories: dict[str, str] = {}
  # Match roman-numeral headings like "I. A SCANDAL IN BOHEMIA"
  roman = r"(?:I{1,3}|IV|V(?:I{0,3})|IX|X(?:I{0,2}))"
  pattern = re.compile(
    rf"^({roman})\.\s+({'|'.join(re.escape(t) for t in _STORY_TITLES)})\s*$",
    re.MULTILINE,
  )

  matches = list(pattern.finditer(text))
  for i, m in enumerate(matches):
    title = m.group(2).strip()
    start = m.start()
    end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
    stories[title] = text[start:end].strip()

  return stories


# ---------------------------------------------------------------------------
# Prompt templates for different question types
# ---------------------------------------------------------------------------

SINGLE_PASSAGE_HARD = """You are creating a challenging reading comprehension benchmark for The Adventures of Sherlock Holmes.

Given the passage below, generate {n} difficult questions. These must NOT be simple factual lookups. Each question should:
- Require INFERENCE, DEDUCTION, or SYNTHESIS from the passage
- Ask about implicit information, character motivations, logical consequences, or cause-effect relationships
- Require understanding the FULL passage context, not just a single sentence
- Have a detailed ground-truth answer (2-4 sentences) that explains the reasoning

Types to mix:
1. "Why" questions about character motivations or plot logic
2. Questions that require connecting two pieces of information within the passage
3. Questions about what can be inferred but is NOT explicitly stated
4. Questions about the significance or consequences of events described

Passage:
---
{passage}
---

Respond with a JSON array (no markdown fences). Each element:
  "question": the question (specific, not vague)
  "ground_truth": detailed answer with reasoning (2-4 sentences)

Return ONLY the JSON array."""


MULTI_HOP = """You are creating multi-hop questions for a challenging RAG benchmark on The Adventures of Sherlock Holmes.

You are given TWO passages from different parts of the text. Generate {n} questions that REQUIRE information from BOTH passages to answer correctly. A system that only retrieves one passage should fail.

Passage A:
---
{passage_a}
---

Passage B:
---
{passage_b}
---

Each question must:
- Require combining specific facts from BOTH passages
- NOT be answerable from either passage alone
- Have a detailed ground-truth answer (2-4 sentences) citing information from both passages
- Be about connections, comparisons, timelines, or relationships that span both passages

Respond with a JSON array (no markdown fences). Each element:
  "question": the multi-hop question
  "ground_truth": answer that synthesizes information from both passages
  "type": "multi_hop"

Return ONLY the JSON array."""


CROSS_STORY = """You are creating cross-story analytical questions for a challenging RAG benchmark on The Adventures of Sherlock Holmes.

You are given excerpts from two different stories. Generate {n} questions that require comparing, contrasting, or connecting elements across the stories.

Story: {story_a_title}
---
{passage_a}
---

Story: {story_b_title}
---
{passage_b}
---

Each question must:
- Explicitly reference or compare elements from both stories
- Ask about patterns in Holmes's methods, recurring character types, thematic parallels, or contrasting approaches
- Require knowledge of specific details from BOTH stories to answer well
- Have a detailed ground-truth answer (3-5 sentences)

Respond with a JSON array (no markdown fences). Each element:
  "question": the cross-story question
  "ground_truth": comparative answer drawing on both stories
  "type": "cross_story"

Return ONLY the JSON array."""


ANALYTICAL = """You are creating deep analytical questions about The Adventures of Sherlock Holmes.

Given this passage, generate {n} questions that require sophisticated reasoning about the text.

Passage:
---
{passage}
---

Question types to generate:
1. What logical chain of reasoning connects event X to outcome Y in this passage?
2. What unstated assumptions underlie a character's actions or deductions?
3. How does a specific detail serve as evidence for a broader conclusion?
4. What would be different if a specific element were changed?

Each question must:
- Require deep reading comprehension, not surface-level recall
- Have a ground-truth answer that walks through the reasoning (3-5 sentences)
- Be specific enough that a vague or generic answer would clearly be wrong

Respond with a JSON array (no markdown fences). Each element:
  "question": the analytical question
  "ground_truth": detailed analytical answer
  "type": "analytical"

Return ONLY the JSON array."""


# ---------------------------------------------------------------------------
# Generation functions
# ---------------------------------------------------------------------------


async def generate_from_prompt(client: AsyncOpenAI, prompt: str, model: str) -> list[dict]:
  """Call the LLM and parse the JSON response."""
  response = await client.chat.completions.create(
    model=model,
    messages=[{"role": "user", "content": prompt}],
    temperature=0.8,
  )
  raw = (response.choices[0].message.content or "").strip()

  # Strip markdown fences
  if raw.startswith("```"):
    raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
  if raw.endswith("```"):
    raw = raw[: raw.rfind("```")]
  raw = raw.strip()

  try:
    items = json.loads(raw)
  except json.JSONDecodeError:
    return []

  if not isinstance(items, list):
    return []

  results = []
  for item in items:
    if isinstance(item, dict) and "question" in item and "ground_truth" in item:
      results.append(item)
  return results


async def generate_single_passage_hard(client: AsyncOpenAI, chunk: str, n: int, model: str) -> list[dict]:
  prompt = SINGLE_PASSAGE_HARD.format(passage=chunk, n=n)
  items = await generate_from_prompt(client, prompt, model)
  for item in items:
    item.setdefault("type", "inference")
    item["contexts"] = [chunk]
  return items


async def generate_multi_hop(client: AsyncOpenAI, chunk_a: str, chunk_b: str, n: int, model: str) -> list[dict]:
  prompt = MULTI_HOP.format(passage_a=chunk_a, passage_b=chunk_b, n=n)
  items = await generate_from_prompt(client, prompt, model)
  for item in items:
    item.setdefault("type", "multi_hop")
    item["contexts"] = [chunk_a, chunk_b]
  return items


async def generate_cross_story(
  client: AsyncOpenAI,
  title_a: str,
  chunk_a: str,
  title_b: str,
  chunk_b: str,
  n: int,
  model: str,
) -> list[dict]:
  prompt = CROSS_STORY.format(
    story_a_title=title_a,
    passage_a=chunk_a,
    story_b_title=title_b,
    passage_b=chunk_b,
    n=n,
  )
  items = await generate_from_prompt(client, prompt, model)
  for item in items:
    item.setdefault("type", "cross_story")
    item["contexts"] = [chunk_a, chunk_b]
  return items


async def generate_analytical(client: AsyncOpenAI, chunk: str, n: int, model: str) -> list[dict]:
  prompt = ANALYTICAL.format(passage=chunk, n=n)
  items = await generate_from_prompt(client, prompt, model)
  for item in items:
    item.setdefault("type", "analytical")
    item["contexts"] = [chunk]
  return items


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def main():
  load_dotenv()
  config = load_config()

  parser = argparse.ArgumentParser(description="Generate high-complexity RAGAS test set")
  parser.add_argument("--corpus-path", default=config.get("corpus_path", "./corpus/adventures_of_sherlock_holmes.txt"))
  parser.add_argument("--output", default=config.get("testset_path", "./testset/sherlock_holmes.json"))
  parser.add_argument("--num-questions", type=int, default=50)
  parser.add_argument("--model", default=config.get("ragas_judge_model", "gpt-4o"))
  parser.add_argument("--chunk-size", type=int, default=config.get("chunk_size", 1200))
  parser.add_argument("--chunk-overlap", type=int, default=config.get("chunk_overlap", 200))
  parser.add_argument("--seed", type=int, default=42)
  args = parser.parse_args()

  corpus_path = os.path.join(_PROJECT_ROOT, args.corpus_path) if not os.path.isabs(args.corpus_path) else args.corpus_path
  output_path = os.path.join(_PROJECT_ROOT, args.output) if not os.path.isabs(args.output) else args.output

  if not os.path.exists(corpus_path):
    print(f"Corpus not found at {corpus_path}. Run bash scripts/download_corpus.sh first.")
    sys.exit(1)

  print(f"Loading corpus from {corpus_path}...")
  with open(corpus_path) as f:
    text = f.read()
  print(f"Corpus: {len(text)} chars, {len(text.split())} words")

  chunks = chunk_text(text, args.chunk_size, args.chunk_overlap)
  stories = split_into_stories(text)
  print(f"Chunked into {len(chunks)} passages across {len(stories)} stories")

  random.seed(args.seed)
  target = args.num_questions
  client = AsyncOpenAI()
  semaphore = asyncio.Semaphore(5)
  model = args.model

  # Allocate question budget across types
  # 30% single-passage-hard, 30% multi-hop, 20% cross-story, 20% analytical
  budget_single = max(2, int(target * 0.30))
  budget_multi = max(2, int(target * 0.30))
  budget_cross = max(2, int(target * 0.20))
  budget_analytical = max(2, target - budget_single - budget_multi - budget_cross)

  all_records: list[dict] = []
  tasks = []

  # --- Single-passage hard questions ---
  single_chunks = random.sample(chunks, min(budget_single, len(chunks)))
  for chunk in single_chunks:

    async def _gen_single(c=chunk):
      async with semaphore:
        return await generate_single_passage_hard(client, c, 1, model)

    tasks.append(("inference", _gen_single()))

  # --- Multi-hop questions (pair distant chunks) ---
  multi_pairs = []
  for _ in range(budget_multi):
    a, b = random.sample(range(len(chunks)), 2)
    # Prefer chunks that are far apart (different parts of the book)
    if abs(a - b) < 20:
      b = (a + random.randint(50, len(chunks) - 1)) % len(chunks)
    multi_pairs.append((chunks[a], chunks[b]))

  for ca, cb in multi_pairs:

    async def _gen_multi(a=ca, b=cb):
      async with semaphore:
        return await generate_multi_hop(client, a, b, 1, model)

    tasks.append(("multi_hop", _gen_multi()))

  # --- Cross-story questions ---
  story_items = list(stories.items())
  cross_pairs = []
  for _ in range(budget_cross):
    (title_a, text_a), (title_b, text_b) = random.sample(story_items, 2)
    # Pick a substantial chunk from each story
    chunks_a = chunk_text(text_a, args.chunk_size, args.chunk_overlap)
    chunks_b = chunk_text(text_b, args.chunk_size, args.chunk_overlap)
    if chunks_a and chunks_b:
      cross_pairs.append((title_a, random.choice(chunks_a), title_b, random.choice(chunks_b)))

  for ta, ca, tb, cb in cross_pairs:

    async def _gen_cross(ta=ta, ca=ca, tb=tb, cb=cb):
      async with semaphore:
        return await generate_cross_story(client, ta, ca, tb, cb, 1, model)

    tasks.append(("cross_story", _gen_cross()))

  # --- Analytical questions ---
  analytical_chunks = random.sample(chunks, min(budget_analytical, len(chunks)))
  for chunk in analytical_chunks:

    async def _gen_analytical(c=chunk):
      async with semaphore:
        return await generate_analytical(client, c, 1, model)

    tasks.append(("analytical", _gen_analytical()))

  # Execute all tasks
  print(f"\nGenerating ~{target} questions across 4 types:")
  print(
    f"  inference: {budget_single}, multi_hop: {budget_multi}, "
    f"cross_story: {budget_cross}, analytical: {budget_analytical}"
  )
  print(f"  Model: {model}, Total API calls: {len(tasks)}\n")

  completed = 0
  type_counts: dict[str, int] = {}
  for i, (qtype, coro) in enumerate(tasks):
    try:
      results = await coro
      for r in results:
        r.setdefault("type", qtype)
      all_records.extend(results)
      type_counts[qtype] = type_counts.get(qtype, 0) + len(results)
      completed += 1
      if completed % 10 == 0 or completed == len(tasks):
        print(f"  [{completed}/{len(tasks)}] Total questions: {len(all_records)}")
    except Exception as e:
      print(f"  [{completed + 1}/{len(tasks)}] Error ({qtype}): {e}")
      completed += 1

  # Shuffle and trim
  random.shuffle(all_records)
  all_records = all_records[:target]

  # Summary
  final_counts: dict[str, int] = {}
  for r in all_records:
    t = r.get("type", "unknown")
    final_counts[t] = final_counts.get(t, 0) + 1

  os.makedirs(os.path.dirname(output_path), exist_ok=True)
  with open(output_path, "w") as f:
    json.dump(all_records, f, indent=2)

  print(f"\nSaved {len(all_records)} questions to {output_path}")
  print(f"Distribution: {final_counts}")
  print("\nSample questions:")
  for r in all_records[:3]:
    print(f"  [{r.get('type')}] {r['question']}")
    print(f"    -> {r['ground_truth'][:120]}...")
    print()


if __name__ == "__main__":
  asyncio.run(main())
