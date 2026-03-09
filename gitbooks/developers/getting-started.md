# Choosing an SDK

Neocortex offers SDKs and integrations across multiple languages and frameworks.

## SDKs

| SDK                                     | Language   | Install                              | Description                                       |
| --------------------------------------- | ---------- | ------------------------------------ | ------------------------------------------------- |
| [**Python SDK**](high-level-sdk.md)     | Python     | `pip install tinyhumansai`           | Cloud API — managed memory layer, no infra needed |
| [**TypeScript SDK**](typescript-sdk.md) | TypeScript | `npm install @alphahuman/memory-sdk` | Cloud API for Node.js and browser environments    |

## Integrations

| Integration                               | Install                            | Description                                        |
| ----------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| [**LangGraph**](langgraph-sdk.md)         | `pip install alphahuman-langgraph` | Drop-in memory tools for LangGraph agent workflows |
| [**OpenClaw Plugin**](openclaw-plugin.md) | _Coming soon_                      | Plugin for the OpenClaw agent framework            |

## Which should I pick?

**Choose an SDK (Python / TypeScript) if you want:**

* A managed service with no infrastructure to maintain
* Simple key-value memory storage with namespaces
* Built-in LLM recall (OpenAI, Anthropic, Gemini)
* The fastest path to production

**Choose an integration (LangGraph / OpenClaw) if you want:**

* To add Neocortex memory to an existing agent framework
* Minimal code changes to your current setup

## Prerequisites

* A [TinyHumans API key](../api-key.md) (for all SDKs and integrations)
