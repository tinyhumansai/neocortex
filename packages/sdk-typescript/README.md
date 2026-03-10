# @alphahuman/memory-sdk

TypeScript / JavaScript SDK for the [Alphahuman Memory API](https://alphahuman.xyz), aligned with the backend API: insert, query, admin/delete, recall, and memories/recall.

## Requirements

- Node.js ≥ 18 (uses native `fetch`)

## Install

```bash
npm install @alphahuman/memory-sdk
```

## Quick start

```typescript
import { AlphahumanMemoryClient } from '@alphahuman/memory-sdk';

const client = new AlphahumanMemoryClient({ token: 'your-api-key' });

// Insert (ingest) a document into memory
const insertResult = await client.insertMemory({
  title: 'User preference',
  content: 'User prefers dark mode',
  namespace: 'preferences',
});
console.log(insertResult.data); // { status, stats, usage? }

// Query memory via RAG
const queryResult = await client.queryMemory({
  query: 'What does the user prefer?',
  namespace: 'preferences',
  maxChunks: 10,
});
console.log(queryResult.data.context, queryResult.data.response);

// Recall context from Master node
const recallResult = await client.recallMemory({ namespace: 'preferences', maxChunks: 10 });

// Recall memories from Ebbinghaus bank
const memoriesResult = await client.recallMemories({ namespace: 'preferences', topK: 5 });

// Delete memory (admin)
await client.deleteMemory({ namespace: 'preferences' });
```

## API reference

### `new AlphahumanMemoryClient(config)`

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `config.token` | `string` | ✓ | API key or JWT |
| `config.baseUrl` | `string` | | Override API URL. If not set, uses `ALPHAHUMAN_BASE_URL` env or default `https://staging-api.alphahuman.xyz` |

### `client.insertMemory(params)`

Insert a document into memory. **POST /v1/memory/insert**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | ✓ | Document title |
| `content` | `string` | ✓ | Document content |
| `namespace` | `string` | ✓ | Namespace |
| `sourceType` | `'doc' \| 'chat' \| 'email'` | | Default `'doc'` |
| `metadata` | `object` | | Optional metadata |
| `priority` | `'high' \| 'medium' \| 'low'` | | Optional priority |
| `createdAt` | `number` | | Unix timestamp (seconds) |
| `updatedAt` | `number` | | Unix timestamp (seconds) |
| `documentId` | `string` | | Optional document ID |

Returns `InsertMemoryResponse` with `data: { status, stats, usage? }`.

### `client.queryMemory(params)`

Query memory via RAG. **POST /v1/memory/query**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | `string` | ✓ | Query string |
| `includeReferences` | `boolean` | | Include references in response |
| `namespace` | `string` | | Scope to namespace |
| `maxChunks` | `number` | | 1–200 |
| `documentIds` | `string[]` | | Filter by document IDs |
| `llmQuery` | `string` | | Optional LLM query |

Returns `QueryMemoryResponse` with `data: { context?, usage?, cached, llmContextMessage?, response? }`.

### `client.deleteMemory(params?)`

Delete memory (admin). **POST /v1/memory/admin/delete**

| Field | Type | Description |
|-------|------|-------------|
| `namespace` | `string` | Optional namespace to scope deletion |

Returns `DeleteMemoryResponse` with `data: { status, userId, namespace?, nodesDeleted, message }`.

### `client.recallMemory(params?)`

Recall context from Master node. **POST /v1/memory/recall**

| Field | Type | Description |
|-------|------|-------------|
| `namespace` | `string` | Optional namespace |
| `maxChunks` | `number` | Positive integer |

Returns `RecallMemoryResponse` with `data: { context?, usage?, cached, response?, latencySeconds?, counts? }`.

### `client.recallMemories(params?)`

Recall memories from Ebbinghaus bank. **POST /v1/memory/memories/recall**

| Field | Type | Description |
|-------|------|-------------|
| `namespace` | `string` | Optional namespace |
| `topK` | `number` | Positive number |
| `minRetention` | `number` | Non-negative number |
| `asOf` | `number` | Timestamp |

Returns `RecallMemoriesResponse` with `data: { memories }`.

## Error handling

All API errors throw `AlphahumanError` (extends `Error`) with `status` (HTTP status code) and `body` (parsed response when available).

```typescript
import { AlphahumanError } from '@alphahuman/memory-sdk';

try {
  await client.queryMemory({ query: 'hello' });
} catch (err) {
  if (err instanceof AlphahumanError) {
    console.error(err.status, err.message);
  }
}
```

## Tests

```bash
npm test
```
