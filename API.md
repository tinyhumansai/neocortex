# Neocortex API

**Base URL:** `https://api.tinyhuman.ai`

## OpenAI-style model routing

Requests that invoke a model accept an optional **`model`** field (string) in the JSON body. Set it to a supported model id to route that request to the corresponding Neocortex model.

- **Webhook** (`POST /webhook`): send `{"message": "...", "model": "mk1-2026-02"}`. If `model` is omitted, the gateway uses its default model.
- Other trigger endpoints (WhatsApp, Linq, pair) use the gateway's default model unless overridden by configuration.

Example:

```bash
curl -X POST https://api.tinyhuman.ai/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "Hello", "model": "mk1-2026-02"}'
```

## Endpoints

All URLs below are relative to **`https://api.tinyhuman.ai`**.

### Triggering the model (agent invocation)

| Method   | Path        | Purpose                                                                                                                                                                                                                       |
| -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **POST** | `/webhook`  | Generic webhook. JSON body: `message` (required), optional `model`, `temperature`, `memory`. Use `model` for OpenAI-style routing. Auth: `Authorization: Bearer <token>` or `X-Webhook-Secret`. Optional `X-Idempotency-Key`. |
| **POST** | `/pair`     | Pairing: `X-Pairing-Code` (and optionally auth). Binds clients and returns pairing credentials.                                                                                                                               |
| **POST** | `/whatsapp` | WhatsApp Cloud API webhook; model processes messages and replies via WhatsApp.                                                                                                                                                |
| **GET**  | `/whatsapp` | WhatsApp webhook verification (`hub.mode`, `hub.verify_token`, `hub.challenge`).                                                                                                                                              |
| **POST** | `/linq`     | Linq channel webhook. Auth: `X-Webhook-Timestamp`, `X-Webhook-Signature`.                                                                                                                                                     |

### Memory ingestion (per model)

Each model has a dedicated endpoint to ingest memory data points. Send a JSON body with the target **model** id and an array of data points; the gateway associates them with that model's context.

| Method   | Path             | Purpose                                                                                                             |
| -------- | ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| **POST** | `/memory/ingest` | Ingest memory data points for a model. Body: `{"model": "<id>", "data": [{ ... }, ...]}`. Auth: same as `/webhook`. |

See each model's README for supported payload shape (e.g. [mk1-2026-02](mk1-2026-02/README.md#memory-ingestion)).

### Operational

| Method  | Path       | Purpose                                |
| ------- | ---------- | -------------------------------------- |
| **GET** | `/health`  | Liveness/readiness and runtime status. |
| **GET** | `/metrics` | Prometheus-format metrics.             |

### Notes

- **Rate limiting**: Per client (IP or forwarded headers). See gateway constants for window and key limits.
- **Request limits**: Max body size and request timeout are enforced (e.g. 64KB body, 30s timeout).
- **Authentication**: Required per trigger endpoint as above; see gateway implementation for details.
