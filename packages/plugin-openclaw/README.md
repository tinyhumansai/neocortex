# OpenClaw Alphahuman Model + Memory Sync Plugin

Connect any Alphahuman backend — hosted or local — to OpenClaw as a model provider. Any user with a backend URL and a valid token can install and use this plugin without touching any code.

The plugin:

- Registers `alphahuman/neocortex-mk1` as a model in OpenClaw
- Syncs workspace memory (MEMORY.md, memory/\*.md) to your backend after every agent run

---

## Quick start (4 steps)

### 1. Install OpenClaw

```bash
npm install -g openclaw
```

Requires OpenClaw `>= 2026.2.0`.

### 2. Install and enable the plugin

```bash
openclaw plugins install -l ./openclaw-plugin-alphahuman-model
openclaw plugins enable openclaw-model-provider
```

### 3. Log in

This is the easiest way to set up — it asks for your backend URL and token, then writes the config automatically:

```bash
openclaw models auth login --provider alphahuman
```

You will be prompted for:

1. **Backend URL** — the root URL of your Alphahuman backend:

   - Hosted/production: `https://staging-api.alphahuman.xyz`
   - Local: `http://localhost:5000`

2. **JWT or API key** — your auth token.

The command updates `~/.openclaw/openclaw.json` with the correct `baseUrl` and `memorySyncUrl`.

Then save the token to `~/.openclaw/.env` so OpenClaw can load it on every run:

```bash
echo 'ALPHAHUMAN_API_KEY=<your-token>' >> ~/.openclaw/.env
```

### 4. Start and run

```bash
mkdir -p ~/.openclaw/workspace
echo "# My memory" > ~/.openclaw/workspace/MEMORY.md

openclaw gateway &
openclaw agent --agent main --message "Hello"
```

You should see `alphahuman/neocortex-mk1` in `openclaw models list` and get a reply.

---

## Get a token

The backend accepts a **JWT** (expires in 30 days) or a **permanent API key** as a Bearer token.

### Option A: Generate a JWT (backend admin)

From the backend repo root, run the token generator. It looks up or creates a user by Telegram ID and prints a 30-day JWT:

```bash
cd /path/to/backend-alphahuman
yarn run:dev src/scripts/generateUserToken.ts YOUR_TELEGRAM_ID
```

Without a Telegram ID it creates a test user:

```bash
yarn run:dev src/scripts/generateUserToken.ts
```

Copy the token and add it to `~/.openclaw/.env`:

```bash
echo 'ALPHAHUMAN_API_KEY=eyJhbGc...' >> ~/.openclaw/.env
```

### Option B: Create a permanent API key

API keys do not expire. First get a JWT (Option A), then:

```bash
curl -X POST https://staging-api.alphahuman.xyz/api-keys \
  -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json"
```

Save the returned key:

```bash
echo 'ALPHAHUMAN_API_KEY=alphahuman_user__...' >> ~/.openclaw/.env
```

### Verify the token

```bash
BACKEND=https://staging-api.alphahuman.xyz   # or http://localhost:5000
TOKEN=$(grep ALPHAHUMAN_API_KEY ~/.openclaw/.env | cut -d= -f2-)

curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BACKEND/memory/sync" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workspaceId":"test","agentId":"main","files":[]}'
```

- `200` — token is valid, you are good to go
- `401` — token is wrong, expired, or user does not exist in the database

---

## Manual config (alternative to `openclaw models auth login`)

If you prefer to configure manually, create or edit `~/.openclaw/openclaw.json`:

```json
{
  "gateway": { "mode": "local" },
  "agents": {
    "defaults": {
      "model": { "primary": "alphahuman/neocortex-mk1" },
      "workspace": "~/.openclaw/workspace",
      "compaction": {
        "mode": "safeguard",
        "memoryFlush": {
          "enabled": true,
          "softThresholdTokens": 4000,
          "systemPrompt": "Session nearing compaction. Store durable memories now.",
          "prompt": "Write any lasting notes to memory/YYYY-MM-DD.md or MEMORY.md; reply with NO_REPLY if nothing to store."
        }
      }
    }
  },
  "models": {
    "mode": "merge",
    "providers": {
      "alphahuman": {
        "baseUrl": "https://staging-api.alphahuman.xyz/openai/v1",
        "apiKey": "${ALPHAHUMAN_API_KEY}",
        "api": "openai-completions",
        "authHeader": true,
        "models": [
          {
            "id": "neocortex-mk1",
            "name": "Neocortex MK1",
            "reasoning": true,
            "input": ["text"],
            "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "plugins": {
    "allow": ["openclaw-model-provider"],
    "entries": {
      "openclaw-model-provider": {
        "enabled": true,
        "config": {
          "baseUrl": "https://staging-api.alphahuman.xyz/openai/v1",
          "modelId": "neocortex-mk1",
          "modelName": "Neocortex MK1",
          "apiKeyEnvVar": "ALPHAHUMAN_API_KEY",
          "memorySyncEnabled": true,
          "memorySyncUrl": "https://staging-api.alphahuman.xyz/memory/sync",
          "memorySyncApiKeyEnvVar": "ALPHAHUMAN_API_KEY"
        }
      }
    }
  },
  "tools": {
    "profile": "coding",
    "byProvider": { "alphahuman": { "profile": "coding", "allow": ["group:fs", "group:memory"] } }
  }
}
```

Replace `https://staging-api.alphahuman.xyz` with your actual backend URL.

---

## Troubleshooting

| Issue                                       | Fix                                                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `command not found: openclaw`               | Run `npm install -g openclaw`                                                                                               |
| `Missing env var "ALPHAHUMAN_API_KEY"`      | Add `ALPHAHUMAN_API_KEY=<token>` to `~/.openclaw/.env`                                                                      |
| `HTTP 401: "Invalid token"`                 | Token is wrong or user not in DB — generate a new one with `yarn run:dev src/scripts/generateUserToken.ts`                  |
| Token works in curl but not in OpenClaw     | Also run `export ALPHAHUMAN_API_KEY=<token>` in the same shell — OpenClaw may not load `~/.openclaw/.env` in all cases      |
| `Unknown model: alphahuman/neocortex-mk1`   | Run `openclaw models auth login --provider alphahuman` or add `models.providers.alphahuman` to config, then restart gateway |
| `openclaw models list` shows only anthropic | Start the gateway: `openclaw gateway`                                                                                       |
| `Gateway service not loaded` on restart     | Use `openclaw gateway` (foreground) or run `openclaw gateway install` first                                                 |
| MEMORY.md not syncing                       | Ensure `tools.byProvider.alphahuman` includes `group:fs` and `group:memory`                                                 |
| Backend not receiving requests              | Check gateway is running, `ALPHAHUMAN_API_KEY` is set, and `models.providers.alphahuman` points to the right URL            |

### Verify backend is receiving requests

Run the backend with debug logs:

```bash
DEBUG=app:* yarn dev
```

You should see:

```text
app:inference:chat POST /openai/v1/chat/completions model=neocortex-mk1 stream=true tools=N
app:memory:sync synced userId=... workspaceId=... agentId=... files=N
```

### View synced memory in MongoDB

```bash
mongosh <your-db-name> --eval "db.openclawmemories.find().pretty()"
```

Each document is scoped to a user (`userId`), so you can filter by user:

```bash
mongosh <your-db-name> --eval 'db.openclawmemories.find({ userId: ObjectId("<userId>") }).pretty()'
```

---

## What this plugin does

- Registers provider `alphahuman` and model `alphahuman/neocortex-mk1` in OpenClaw
- Uses OpenAI-compatible transport (`openai-completions`)
- Syncs `MEMORY.md` and `memory/**/*.md` to your backend on startup and after each agent run
- Uses hash-based idempotency — only changed files are uploaded
- Memory is scoped per user (`userId`) in the backend database
- Does not log API keys or tokens

---

## Plugin config reference

| Field                    | Description                                                                       |
| ------------------------ | --------------------------------------------------------------------------------- |
| `baseUrl`                | OpenAI-compatible base URL (e.g. `https://staging-api.alphahuman.xyz/openai/v1`)  |
| `modelId`                | Model identifier (default `neocortex-mk1`)                                        |
| `modelName`              | Display name in model list                                                        |
| `apiKeyEnvVar`           | Env var name for API key (default `ALPHAHUMAN_API_KEY`)                           |
| `memorySyncEnabled`      | Enable memory sync (default `true`)                                               |
| `memorySyncUrl`          | Backend endpoint for sync (e.g. `https://staging-api.alphahuman.xyz/memory/sync`) |
| `memorySyncApiKeyEnvVar` | Env var name for sync Bearer token                                                |

---

## Memory sync payload

The plugin POSTs to `memorySyncUrl`:

```json
{
  "workspaceId": "workspace",
  "agentId": "main",
  "source": "agent_end",
  "files": [
    {
      "filePath": "MEMORY.md",
      "content": "# My memory\n...",
      "timestamp": "2026-02-24T12:00:00.000Z",
      "hash": "sha256..."
    }
  ]
}
```