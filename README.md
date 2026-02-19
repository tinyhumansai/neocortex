# Neocortex

Documentation and benchmarks for Neocortex models — the AI agent runtime and gateway that powers conversational and channel integrations (webhook, WhatsApp, Linq, etc.).

**API reference:** [API.md](API.md) — base URL, model routing, and endpoints.

## Model IDs

Models are identified by **id** (not by URL path). Use the `model` field in request bodies to route to a specific model. Only one model is available at this time.

| Id              | Description              | Docs                                                                                 |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------ |
| **mk1-2026-02** | Neocortex MK1 (Feb 2026) | [mk1-2026-02 README](mk1-2026-02/README.md), [BENCHMARKS](mk1-2026-02/BENCHMARKS.md) |

## Pricing

Pricing is **per 1M tokens** (USD), by model id.

| Model id    | Input (per 1M tokens) | Output (per 1M tokens) | Notes                   |
| ----------- | --------------------- | ---------------------- | ----------------------- |
| mk1-2026-02 | $2.00                 | $6.00                  | First Neocortex release |
