"""RAGAS evaluation wrapper.

Takes one method's per-question results and runs RAGAS metrics.
Compatible with RAGAS 0.4.x API (uses async aevaluate).
"""

from typing import Any


async def evaluate_method(
  results: list[dict[str, Any]], config: dict
) -> tuple[dict[str, float], list[dict[str, float]]]:
  """Run RAGAS evaluation on one method's results.

  Args:
      results: List of per-question dicts with keys:
          question, answer, contexts (list[str]), ground_truth (str)
      config: Shared config dict (uses ragas_metrics, ragas_judge_model).

  Returns:
      Tuple of (aggregate_scores, per_question_scores).
      aggregate_scores: Dict of metric_name -> mean score (float).
      per_question_scores: List of dicts (one per valid question) with metric_name -> score.
  """
  try:
    from ragas import EvaluationDataset, SingleTurnSample
    from ragas.evaluation import aevaluate
    from ragas.metrics import (
      answer_relevancy,
      context_precision,
      context_recall,
      faithfulness,
    )
  except ImportError:
    print("RAGAS evaluation requires: pip install ragas")
    return {}, []

  # Filter results that have at minimum an answer and ground_truth.
  valid_indices = [i for i, r in enumerate(results) if r.get("answer") and r.get("ground_truth")]

  if not valid_indices:
    print("No results with both answer and ground_truth found. Skipping RAGAS evaluation.")
    return {}, []

  valid = [results[i] for i in valid_indices]

  # Map metric names to RAGAS metric objects
  metric_map = {
    "faithfulness": faithfulness,
    "answer_relevancy": answer_relevancy,
    "context_precision": context_precision,
    "context_recall": context_recall,
  }

  enabled_names = config.get("ragas_metrics", list(metric_map.keys()))
  metrics = [metric_map[name] for name in enabled_names if name in metric_map]

  if not metrics:
    print("No valid RAGAS metrics configured.")
    return {}, []

  def _ensure_contexts(r):
    ctx = r.get("contexts", [])
    if isinstance(ctx, list) and ctx:
      return ctx
    if isinstance(ctx, str) and ctx:
      return [ctx]
    return ["No context retrieved."]

  # Build EvaluationDataset using RAGAS 0.4.x API
  samples = []
  for r in valid:
    samples.append(
      SingleTurnSample(
        user_input=r["question"],
        response=r["answer"],
        retrieved_contexts=_ensure_contexts(r),
        reference=r["ground_truth"],
      )
    )

  dataset = EvaluationDataset(samples=samples)

  kwargs: dict[str, Any] = {}
  judge_model = config.get("ragas_judge_model")
  if judge_model:
    try:
      from langchain_openai import ChatOpenAI
      from ragas.llms import LangchainLLMWrapper

      kwargs["llm"] = LangchainLLMWrapper(ChatOpenAI(model=judge_model))
    except ImportError:
      pass

  result = await aevaluate(dataset=dataset, metrics=metrics, **kwargs)

  # Aggregate scores from result._repr_dict
  aggregate: dict[str, float] = {}
  for name in enabled_names:
    if name in result._repr_dict:
      val = result._repr_dict[name]
      if val is not None:
        aggregate[name] = float(val)

  # Per-question scores from result.scores (list of dicts)
  per_question: list[dict[str, float]] = []
  for score_dict in result.scores:
    row: dict[str, float] = {}
    for name in enabled_names:
      if name in score_dict and score_dict[name] is not None:
        row[name] = float(score_dict[name])
    per_question.append(row)

  return aggregate, per_question
