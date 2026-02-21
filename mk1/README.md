# Neocortex MK1 (Feb 2026)

First Neocortex model release (February 2026). Invoke via the gateway using model id **`mk1`**. See the [repository README](../README.md) for base URL and endpoints.

## Overview

- **Id**: `mk1`
- **Release**: February 2026
- **Status**: Current

## Pricing

All prices per **1M tokens** (USD).

| Unit   | Price (USD)  | Notes            |
| ------ | ------------ | ---------------- |
| Input  | $2.00 per 1M | Prompt + context |
| Output | $6.00 per 1M | Generated reply  |

_Prices are placeholders; update when production pricing is set._

## Memory ingestion

Model id **`mk1`** supports ingesting memory data points via the gateway’s memory endpoint:

**POST** `https://api.tinyhuman.xyz/memory/ingest`

- **Body**: `{"model": "mk1", "data": [<data points>]}`. Each data point is a JSON object (e.g. `{"content": "...", "category": "conversation"}` or as defined by the gateway).
- **Auth**: Same as `/webhook` (`Authorization: Bearer <token>` or `X-Webhook-Secret`).

Data points are stored in the model’s memory context and can be used in subsequent chat requests.

## Capabilities

- **Channels**: Webhook (generic JSON), WhatsApp (Cloud API), Linq
- **Input**: Text and optional multimodal content (e.g. images) as configured by the gateway
- **Memory**: Conversation and context memory as provided by the runtime
- **Tools**: Agent can use the configured tool set (browser, HTTP, etc.) when enabled

## Configuration

The model runs behind the Neocortex/tinyhuman gateway at `https://api.tinyhuman.xyz`. Use **OpenAI-style model routing** by setting `"model": "mk1"` in the request body (e.g. `POST /webhook`). Default provider and backing LLM are set in gateway config; “MK1” refers to the gateway + prompt + tool stack for this release.

## Benchmarks

See [BENCHMARKS.md](BENCHMARKS.md) for benchmark definitions and results.
