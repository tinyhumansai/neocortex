# Choosing an SDK

Neocortex offers SDKs and integrations across multiple languages and frameworks.

## SDKs

<table><thead><tr><th>SDK</th><th>Language</th><th width="192.359375">Install</th><th>Description</th></tr></thead><tbody><tr><td><a href="high-level-sdk.md"><strong>Python SDK</strong></a></td><td>Python</td><td><code>pip install tinyhumansai</code></td><td>Cloud API: managed memory layer, no infra needed</td></tr><tr><td><a href="typescript-sdk.md"><strong>TypeScript SDK</strong></a></td><td>TypeScript</td><td><code>npm install @alphahuman/memory-sdk</code></td><td>Cloud API for Node.js and browser environments</td></tr></tbody></table>

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
