"""Chart and reporting script for benchmark results.

Reads per-method JSON files from results/ directory and produces formatted output.

Usage:
    python scripts/chart.py                    # Markdown table (default)
    python scripts/chart.py --chart table      # Markdown table
    python scripts/chart.py --chart csv        # CSV export
    python scripts/chart.py --chart bar        # Bar chart (requires matplotlib)
    python scripts/chart.py --sort relevancy   # Sort by answer_relevancy
    python scripts/chart.py --results-dir results/  # Custom results directory
"""

import argparse
import csv
import io
import json
import os
import sys
from typing import Any

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_results(results_dir: str) -> dict:
  """Load all per-method JSON files from results/ and merge into a unified dict.

  Returns:
      {"run_config": {...}, "methods": {"neocortex": {...}, "vdb": {...}, ...}}
  """
  if not os.path.isdir(results_dir):
    return {"run_config": {}, "methods": {}}

  merged_config: dict = {}
  methods: dict[str, Any] = {}

  for filename in sorted(os.listdir(results_dir)):
    if not filename.endswith(".json"):
      continue
    filepath = os.path.join(results_dir, filename)
    try:
      with open(filepath) as f:
        data = json.load(f)
    except (json.JSONDecodeError, OSError):
      continue

    method_name = data.get("method")
    if not method_name:
      continue

    if data.get("run_config"):
      merged_config = data["run_config"]

    method_data = {k: v for k, v in data.items() if k not in ("run_config", "method")}
    methods[method_name] = method_data

  return {"run_config": merged_config, "methods": methods}


def _sort_key(method_data: dict, sort_by: str) -> float:
  """Extract sort key from method data."""
  mapping = {
    "relevancy": ("ragas_scores", "answer_relevancy"),
    "faithfulness": ("ragas_scores", "faithfulness"),
    "precision": ("ragas_scores", "context_precision"),
    "recall": ("ragas_scores", "context_recall"),
    "latency": ("querying", "avg_latency_seconds"),
    "cost": ("querying", "total_cost_usd"),
    "index_time": ("indexing", "time_seconds"),
  }

  if sort_by in mapping:
    section, key = mapping[sort_by]
    val = method_data.get(section, {}).get(key, 0) or 0
    # For latency and cost, lower is better — negate so sorted() puts them first
    if sort_by in ("latency", "cost", "index_time"):
      return -val
    return val
  return 0


def _fmt(val: Any, fmt: str = ".2f") -> str:
  """Format a value, returning '-' for None/missing."""
  if val is None:
    return "-"
  if isinstance(val, float):
    return f"{val:{fmt}}"
  return str(val)


def _fmt_cost(val: Any) -> str:
  """Format a numeric cost as a dollar string."""
  if val is None:
    return "-"
  return f"${val:.4f}"


def _fmt_tokens(val: Any) -> str:
  """Format a raw token count into a compact human-readable string."""
  if val is None:
    return "-"
  if val >= 1_000_000:
    return f"{val / 1_000_000:.1f}M"
  if val >= 1_000:
    return f"{val / 1_000:.0f}K"
  return str(val)


def print_markdown_table(data: dict, sort_by: str | None = None):
  """Print a markdown comparison table."""
  methods = data.get("methods", {})
  if not methods:
    print("No method results found.")
    return

  # Sort methods
  items = list(methods.items())
  if sort_by:
    items.sort(key=lambda x: _sort_key(x[1], sort_by), reverse=True)

  headers = [
    "Method",
    "Faith. (↑)",
    "Relev. (↑)",
    "Ctx Prec. (↑)",
    "Ctx Recall (↑)",
    "Avg Latency (↓)",
    "Index Time (↓)",
    "Query $ (↓)",
    "Index $ (↓)",
    "Tokens (Q)",
  ]

  rows = []
  for name, m in items:
    ragas = m.get("ragas_scores", {})
    indexing = m.get("indexing", {})
    querying = m.get("querying", {})

    total_q_tokens = (querying.get("total_tokens_input") or 0) + (querying.get("total_tokens_output") or 0)

    rows.append(
      [
        name,
        _fmt(ragas.get("faithfulness")),
        _fmt(ragas.get("answer_relevancy")),
        _fmt(ragas.get("context_precision")),
        _fmt(ragas.get("context_recall")),
        f"{querying.get('avg_latency_seconds', 0):.1f}s",
        f"{indexing.get('time_seconds', 0):.0f}s",
        _fmt_cost(querying.get("total_cost_usd")),
        _fmt_cost(indexing.get("cost_usd")),
        _fmt_tokens(total_q_tokens if total_q_tokens else None),
      ]
    )

  # Print
  col_widths = [max(len(headers[i]), max(len(r[i]) for r in rows)) for i in range(len(headers))]
  header_line = "| " + " | ".join(h.ljust(w) for h, w in zip(headers, col_widths, strict=True)) + " |"
  sep_line = "|" + "|".join("-" * (w + 2) for w in col_widths) + "|"
  print(header_line)
  print(sep_line)
  for row in rows:
    print("| " + " | ".join(c.ljust(w) for c, w in zip(row, col_widths, strict=True)) + " |")

  # Print run config summary & metric guidance
  run_config = data.get("run_config", {})
  if run_config:
    print(
      f"\nCorpus: {run_config.get('corpus', '?')}, "
      f"Questions: {run_config.get('num_questions', '?')}, "
      f"Top-K: {run_config.get('top_k', '?')}, "
      f"Chunk Size: {run_config.get('chunk_size', '?')}, "
      f"Timestamp: {run_config.get('timestamp', '?')}"
    )
  print(
    "\nNotes: ↑ higher is better (faithfulness, relevancy, context metrics); "
    "↓ lower is better (latency, index time, cost)."
  )


def export_csv(data: dict, filepath: str | None = None, sort_by: str | None = None):
  """Export results as CSV."""
  methods = data.get("methods", {})
  if not methods:
    print("No method results found.")
    return

  items = list(methods.items())
  if sort_by:
    items.sort(key=lambda x: _sort_key(x[1], sort_by), reverse=True)

  fieldnames = [
    "method",
    "faithfulness",
    "answer_relevancy",
    "context_precision",
    "context_recall",
    "avg_latency_seconds",
    "index_time_seconds",
    "query_cost_usd",
    "index_cost_usd",
    "query_tokens_input",
    "query_tokens_output",
    "index_tokens_input",
    "index_tokens_output",
  ]

  output = io.StringIO() if filepath is None else open(filepath, "w", newline="")
  try:
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for name, m in items:
      ragas = m.get("ragas_scores", {})
      indexing = m.get("indexing", {})
      querying = m.get("querying", {})

      writer.writerow(
        {
          "method": name,
          "faithfulness": ragas.get("faithfulness"),
          "answer_relevancy": ragas.get("answer_relevancy"),
          "context_precision": ragas.get("context_precision"),
          "context_recall": ragas.get("context_recall"),
          "avg_latency_seconds": querying.get("avg_latency_seconds"),
          "index_time_seconds": indexing.get("time_seconds"),
          "query_cost_usd": querying.get("total_cost_usd"),
          "index_cost_usd": indexing.get("cost_usd"),
          "query_tokens_input": querying.get("total_tokens_input"),
          "query_tokens_output": querying.get("total_tokens_output"),
          "index_tokens_input": indexing.get("tokens_input"),
          "index_tokens_output": indexing.get("tokens_output"),
        }
      )

    if filepath is None:
      print(output.getvalue())
    else:
      print(f"CSV exported to {filepath}")
  finally:
    if filepath is not None:
      output.close()


def print_bar_chart(data: dict, sort_by: str | None = None):
  """Print bar chart using matplotlib (or ASCII fallback)."""
  methods = data.get("methods", {})
  if not methods:
    print("No method results found.")
    return

  try:
    import matplotlib

    # Prefer a GUI backend so plt.show() opens a window (Agg does not)
    if matplotlib.get_backend().lower() == "agg":
      for backend in ("TkAgg", "Qt5Agg", "QtAgg", "MacOSX", "GTK4Agg", "GTK3Agg", "WXAgg"):
        try:
          matplotlib.use(backend)
          break
        except Exception:
          continue
    import matplotlib.pyplot as plt
  except ImportError:
    # ASCII fallback
    print("matplotlib not installed. Showing ASCII chart:\n")
    _print_ascii_bars(data, sort_by)
    return

  items = list(methods.items())
  if sort_by:
    items.sort(key=lambda x: _sort_key(x[1], sort_by), reverse=True)

  names = [name for name, _ in items]
  metric_groups = {
    "RAGAS Scores (↑ better)": {
      k: [m.get("ragas_scores", {}).get(k, 0) or 0 for _, m in items]
      for k in ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]
    },
    "Avg Latency (s, ↓ better)": {
      "latency": [m.get("querying", {}).get("avg_latency_seconds", 0) or 0 for _, m in items]
    },
    "Query Cost (USD, ↓ better)": {
      "query_cost": [m.get("querying", {}).get("total_cost_usd", 0) or 0 for _, m in items],
    },
    "Index Cost (USD, ↓ better)": {
      "index_cost": [m.get("indexing", {}).get("cost_usd", 0) or 0 for _, m in items],
    },
  }

  n_groups = len(metric_groups)
  n_rows, n_cols = 2, 2
  fig, axes = plt.subplots(n_rows, n_cols, figsize=(6 * n_cols, 6 * n_rows))
  axes_flat = axes.ravel() if n_groups > 1 else [axes]
  fig.suptitle("Benchmark Comparison", fontsize=14)

  for ax, (group_name, metrics) in zip(axes_flat, metric_groups.items(), strict=True):
    x = list(range(len(names)))
    width = 0.8 / len(metrics)
    for i, (metric_name, values) in enumerate(metrics.items()):
      offset = (i - len(metrics) / 2 + 0.5) * width
      ax.bar([xi + offset for xi in x], values, width, label=metric_name)
    ax.set_title(group_name)
    ax.set_xticks(list(x))
    ax.set_xticklabels(names, rotation=45, ha="right")
    ax.legend(fontsize=8)

  plt.tight_layout()
  output_path = os.path.join(_PROJECT_ROOT, "results", "chart.png")
  os.makedirs(os.path.dirname(output_path), exist_ok=True)
  plt.savefig(output_path, dpi=150)
  print(f"Chart saved to {output_path}")
  try:
    plt.show(block=True)
  except Exception:
    pass
  print("If no chart window appeared, open the image directly:", output_path)


def print_per_question_chart(data: dict):
  """Print a grid of per-question charts (4 columns) with models on x-axis and all 4 RAGAS metrics grouped per model."""
  methods = data.get("methods", {})
  if not methods:
    print("No method results found.")
    return

  # Build mapping: question_text -> {method_name: ragas_dict}
  question_order: list[str] = []
  question_scores: dict[str, dict[str, dict]] = {}

  for method_name, m in methods.items():
    for pq in m.get("per_question", []):
      q = pq.get("question", "")
      if not q:
        continue
      if q not in question_scores:
        question_order.append(q)
        question_scores[q] = {}
      question_scores[q][method_name] = pq.get("ragas", {})

  if not question_order:
    print("No per-question data found in results.")
    return

  try:
    import matplotlib

    if matplotlib.get_backend().lower() == "agg":
      for backend in ("TkAgg", "Qt5Agg", "QtAgg", "MacOSX", "GTK4Agg", "GTK3Agg", "WXAgg"):
        try:
          matplotlib.use(backend)
          break
        except Exception:
          continue
    import matplotlib.pyplot as plt
    import numpy as np
  except ImportError:
    print("matplotlib not installed. Per-question chart requires matplotlib.")
    return

  metrics = ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]
  metric_labels = ["Faithfulness", "Relevancy", "Ctx Precision", "Ctx Recall"]
  metric_colors = ["#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3"]

  n_questions = len(question_order)
  n_cols = 4
  n_rows = -(-n_questions // n_cols)  # ceil division
  method_names = list(methods.keys())
  n_methods = len(method_names)
  n_metrics = len(metrics)

  fig, axes = plt.subplots(n_rows, n_cols, figsize=(5 * n_cols, 4 * n_rows))
  fig.suptitle("Per-Question RAGAS Scores by Method", fontsize=14, y=1.0)

  if n_rows == 1 and n_cols == 1:
    axes_flat = [axes]
  else:
    axes_flat = list(np.array(axes).ravel())

  for idx, question in enumerate(question_order):
    ax = axes_flat[idx]
    scores_by_method = question_scores[question]

    x = np.arange(n_methods)
    total_group_width = 0.8
    bar_width = total_group_width / n_metrics

    for m_idx, (metric, color) in enumerate(zip(metrics, metric_colors)):
      offset = (m_idx - n_metrics / 2 + 0.5) * bar_width
      values = [scores_by_method.get(name, {}).get(metric, 0) or 0 for name in method_names]
      ax.bar(x + offset, values, bar_width, label=metric_labels[m_idx], color=color)

    ax.set_ylim(0, 1.05)
    ax.set_xticks(x)
    ax.set_xticklabels(method_names, rotation=45, ha="right", fontsize=8)
    short_q = question if len(question) <= 60 else question[:57] + "..."
    ax.set_title(f"Q{idx + 1}: {short_q}", fontsize=7, pad=4)
    ax.tick_params(axis="y", labelsize=7)

  # Shared legend from first subplot
  handles, labels = axes_flat[0].get_legend_handles_labels()
  fig.legend(handles, labels, loc="upper center", ncol=n_metrics, fontsize=9, bbox_to_anchor=(0.5, 0.98))

  # Hide unused subplots
  for idx in range(n_questions, len(axes_flat)):
    axes_flat[idx].set_visible(False)

  plt.tight_layout(rect=[0, 0, 1, 0.95])
  output_path = os.path.join(_PROJECT_ROOT, "results", "per_question_chart.png")
  os.makedirs(os.path.dirname(output_path), exist_ok=True)
  plt.savefig(output_path, dpi=150, bbox_inches="tight")
  print(f"Chart saved to {output_path}")
  try:
    plt.show(block=True)
  except Exception:
    pass
  print("If no chart window appeared, open the image directly:", output_path)


def _print_ascii_bars(data: dict, sort_by: str | None = None):
  """Print simple ASCII bar chart for RAGAS scores."""
  methods = data.get("methods", {})
  items = list(methods.items())
  if sort_by:
    items.sort(key=lambda x: _sort_key(x[1], sort_by), reverse=True)

  max_name_len = max(len(name) for name, _ in items) if items else 10
  bar_width = 40

  for metric in ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]:
    print(f"\n  {metric}:")
    for name, m in items:
      score = m.get("ragas_scores", {}).get(metric, 0) or 0
      filled = int(score * bar_width)
      bar = "#" * filled + "." * (bar_width - filled)
      print(f"    {name:<{max_name_len}}  [{bar}] {score:.2f}")


def main():
  """CLI entry point for rendering benchmark results in various formats."""
  parser = argparse.ArgumentParser(description="Benchmark results chart/table generator")
  parser.add_argument("--results-dir", default=None, help="Path to results directory (default: results/)")
  parser.add_argument("--chart", choices=["table", "csv", "bar", "questions"], default="table", help="Output format")
  parser.add_argument(
    "--sort", default=None, help="Sort by: relevancy, faithfulness, precision, recall, latency, cost, index_time"
  )
  parser.add_argument("--csv-output", default=None, help="CSV output file path (for --chart csv)")
  args = parser.parse_args()

  # Resolve results directory
  results_dir = args.results_dir or os.path.join(_PROJECT_ROOT, "results")

  if not os.path.isdir(results_dir):
    print(f"Results directory not found: {results_dir}")
    print("Run the benchmark first: python run.py")
    sys.exit(1)

  data = load_results(results_dir)

  if not data.get("methods"):
    print(f"No method result files found in: {results_dir}")
    print("Run the benchmark first: python run.py")
    sys.exit(1)

  if args.chart == "table":
    print_markdown_table(data, sort_by=args.sort)
  elif args.chart == "csv":
    export_csv(data, filepath=args.csv_output, sort_by=args.sort)
  elif args.chart == "bar":
    print_bar_chart(data, sort_by=args.sort)
  elif args.chart == "questions":
    print_per_question_chart(data)


if __name__ == "__main__":
  main()
