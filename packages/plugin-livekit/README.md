# Neocortex LiveKit Plugin

LiveKit plugin for **Neocortex-powered memories** in voice/video agents. It stores user and assistant turns in Neocortex and recalls memory context for future sessions.

## Requirements

- Python 3.9+
- [livekit-agents](https://pypi.org/project/livekit-agents/) >= 1.0
- [httpx](https://www.python-httpx.org/) for talking to the Alphahuman backend

## Install

```bash
pip install neocortex-livekit
```

Or from this repo:

```bash
pip install -e ./packages/plugin-livekit
```

## Environment

Create `packages/plugin-livekit/.env`:

```bash
LIVEKIT_URL=wss://<your-project>.livekit.cloud
LIVEKIT_API_KEY=<livekit-api-key>
LIVEKIT_API_SECRET=<livekit-api-secret>
ALPHAHUMAN_API_KEY=<full-alphahuman-key>
ALPHAHUMAN_BASE_URL=http://localhost:5000
LIVEKIT_MEMORY_NAMESPACE=livekit:shared
```

Notes:

- `ALPHAHUMAN_API_KEY` must be the **full key**, not key prefix.
- Use a stable `LIVEKIT_MEMORY_NAMESPACE` for cross-room memory recall.

## Plugin integration pattern

Use `NeocortexLiveKitTools` inside your LiveKit `rtc_session` to save turns and recall context.

```python
import os
from livekit import agents
from livekit.agents import AgentServer
from neocortex_livekit import NeocortexLiveKitTools

server = AgentServer()

@server.rtc_session(agent_name="neocortex-memory-agent")
async def my_agent(ctx: agents.JobContext):
    memory = NeocortexLiveKitTools(
        token=os.environ["ALPHAHUMAN_API_KEY"],
        base_url=os.getenv("ALPHAHUMAN_BASE_URL"),
        namespace=os.getenv("LIVEKIT_MEMORY_NAMESPACE", "livekit:shared"),
    )

    # 1) Recall context before generating replies
    ctx_text = memory.recall_memory(
        prompt="Summarize important known user facts and preferences.",
        num_chunks=10,
    )

    # 2) Save user/assistant turns during the session
    memory.save_memory(
        key="user-<timestamp>",
        content="User transcript text",
        metadata={"source": "livekit-user", "room": ctx.room.name},
    )
    memory.save_memory(
        key="assistant-<timestamp>",
        content="Assistant reply text",
        metadata={"source": "livekit-assistant", "room": ctx.room.name},
    )
```

`agent.py` in this package is the full reference implementation of this pattern with event hooks (`user_input_transcribed`, `conversation_item_added`) and debug logs.

## Run locally (agent.py)

`agent.py` is the local dev entrypoint.

From `packages/plugin-livekit`:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
set -a; source .env; set +a
python agent.py download-files
python agent.py dev
```

## Voice E2E test

1. Keep `python agent.py dev` running.
2. Open [agents-playground.livekit.io](https://agents-playground.livekit.io/).
3. Set agent name to `neocortex-memory-agent` (explicit dispatch).
4. Join and speak.
5. Validate logs:
  - `[stt] ...` for transcript
  - `[tts] ...` for speech output
  - `[memory] saved user transcript ...`
  - `[memory] saved assistant reply ...`

## Memory verification flow

Use two sessions to verify persistence:

1. Session A:
  - "My favorite food is pizza."
  - End call.
2. Session B (new room, same `LIVEKIT_MEMORY_NAMESPACE`):
  - "What is my favorite food?"
3. Expect recall-aware answer and memory save logs.

## Troubleshooting

- `Invalid token`: wrong key format or wrong backend URL.
- `Insufficient ingestion budget`: backend quota exhausted; writes are blocked.
- No session logs after worker register: missing explicit dispatch agent name in Playground.
- Slow warnings from silero: expected on weaker CPU; non-fatal for dev.

## Run tests

```bash
cd packages/plugin-livekit
python3 -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
pytest -q
```

## Tooling API (optional)

`NeocortexLiveKitTools` methods:

- `save_memory`
- `recall_memory`
- `delete_memory`
- `build_prompt_with_memory`

