# TypeScript SDK

TypeScript / JavaScript SDK for the TinyHumans Memory API.

## Requirements

- Node.js 18+ (uses native `fetch`)

## Install

```bash
npm install @alphahuman/memory-sdk
```

## Quick Start

```typescript
import { AlphahumanMemoryClient } from '@alphahuman/memory-sdk';

const client = new AlphahumanMemoryClient({ token: 'your-api-key' });

// Ingest (upsert) memory
const ingestResult = await client.ingestMemory({
  items: [
    {
      key: 'user-preference-theme',
      content: 'User prefers dark mode',
      namespace: 'preferences',
      metadata: { source: 'onboarding' },
    },
  ],
});
console.log(ingestResult.data); // { ingested: 1, updated: 0, errors: 0 }

// Read memory
const readResult = await client.readMemory({ namespace: 'preferences' });
console.log(readResult.data.items);

// Delete by key
await client.deleteMemory({ key: 'user-preference-theme', namespace: 'preferences' });

// Delete all user memory
await client.deleteMemory({ deleteAll: true });
```

## Client Configuration

```typescript
const client = new AlphahumanMemoryClient({
  token: 'your-api-key',   // Required. API key or JWT.
  baseUrl: 'https://...',  // Optional. Override API URL.
});
```

## API Reference

### `client.ingestMemory(request)`

Upserts memory items. Items are deduplicated by `(namespace, key)` — if a matching item exists, its `content` and `metadata` are updated.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `items` | `MemoryItem[]` | yes | One or more items to ingest |

Returns `{ ingested, updated, errors }` counts.

### `client.readMemory(request?)`

Read memory items. All filter fields are optional; omitting all returns every item for the authenticated user.

| Field | Type | Description |
| --- | --- | --- |
| `key` | `string` | Exact key match |
| `keys` | `string[]` | Match any of the given keys |
| `namespace` | `string` | Scope to a namespace |

Returns `{ items, count }`.

### `client.deleteMemory(request)`

Delete memory. At least one of `key`, `keys`, or `deleteAll` must be set.

| Field | Type | Description |
| --- | --- | --- |
| `key` | `string` | Delete a single key |
| `keys` | `string[]` | Delete multiple keys |
| `namespace` | `string` | Scope deletion to a namespace |
| `deleteAll` | `boolean` | Delete all user memory |

Returns `{ deleted }` count.

## Error Handling

All API errors throw `AlphahumanError` which extends `Error` and includes `status` (HTTP status code) and `body` (parsed response, if available).

```typescript
import { AlphahumanError } from '@alphahuman/memory-sdk';

try {
  await client.readMemory();
} catch (err) {
  if (err instanceof AlphahumanError) {
    console.error(err.status, err.message);
  }
}
```
