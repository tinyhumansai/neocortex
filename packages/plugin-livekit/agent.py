"""LiveKit voice agent wired with Neocortex memory.

Run with:
  python agent.py dev

Local setup:
  set -a; source .env; set +a
  python agent.py download-files
  python agent.py dev
"""

from __future__ import annotations

import os
import time
from typing import Any

from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentServer, AgentSession, ConversationItemAddedEvent, UserInputTranscribedEvent, room_io
from livekit.plugins import silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from neocortex_livekit import NeocortexLiveKitTools

load_dotenv(".env")


DEFAULT_AGENT_NAME = "neocortex-memory-agent"
DEFAULT_MEMORY_NAMESPACE = "livekit:shared"
DEFAULT_SEED_PROMPT = "Summarize important known user facts and preferences."
MIN_FINAL_TRANSCRIPT_CHARS = 3


def _safe_item_text(item: Any) -> str:
    attr = getattr(item, "text_content", None)
    if callable(attr):
        try:
            text = attr()
            if isinstance(text, str):
                return text
        except Exception:
            pass
    if isinstance(attr, str):
        return attr

    content = getattr(item, "content", None)
    if isinstance(content, list):
        chunks: list[str] = []
        for c in content:
            if isinstance(c, str) and c.strip():
                chunks.append(c.strip())
        return " ".join(chunks)
    return ""


def _build_assistant_instructions(seed_context: str) -> str:
    return (
        "You are a helpful voice AI assistant. Keep responses short and natural.\n"
        "You have persistent memory context below. Use it when relevant.\n"
        "If asked what you remember, summarize from memory context and current chat.\n"
        "Do not claim you have no memory unless memory context is actually empty.\n\n"
        f"Known memory context:\n{seed_context}"
    )


def _save_memory(
    memory: NeocortexLiveKitTools,
    *,
    key: str,
    content: str,
    metadata: dict[str, Any],
    label: str,
) -> None:
    try:
        memory.save_memory(key=key, content=content, metadata=metadata)
        print(f"[memory] saved {label} key={key}")
    except Exception as exc:
        print(f"[memory] failed to save {label}: {exc}")


server = AgentServer()


@server.rtc_session(agent_name=os.getenv("LIVEKIT_AGENT_NAME", DEFAULT_AGENT_NAME))
async def memory_agent(ctx: agents.JobContext) -> None:
    print(f"[session] joined room={ctx.room.name}")
    token = os.getenv("ALPHAHUMAN_API_KEY")
    if not token:
        raise ValueError("ALPHAHUMAN_API_KEY is required")

    # Use a stable namespace so memory survives room changes between sessions.
    namespace = os.getenv("LIVEKIT_MEMORY_NAMESPACE", DEFAULT_MEMORY_NAMESPACE)
    print(f"[memory] namespace={namespace!r}")
    memory = NeocortexLiveKitTools(
        token=token,
        base_url=os.getenv("ALPHAHUMAN_BASE_URL"),
        namespace=namespace,
    )

    seed_context = ""
    try:
        seed_context = memory.recall_memory(prompt=DEFAULT_SEED_PROMPT, num_chunks=10)
    except Exception as exc:
        print(f"[memory] seed recall failed: {exc}")
        seed_context = ""

    class Assistant(Agent):
        def __init__(self) -> None:
            super().__init__(
                instructions=_build_assistant_instructions(seed_context)
            )

    session = AgentSession(
        stt="deepgram/nova-3:multi",
        llm="openai/gpt-4.1-mini",
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )

    @session.on("user_input_transcribed")
    def on_user_input_transcribed(event: UserInputTranscribedEvent) -> None:
        print(
            "[stt] "
            f"final={event.is_final} "
            f"lang={event.language} "
            f"text={event.transcript!r}"
        )
        if not event.is_final:
            return
        text = event.transcript.strip()
        if len(text) < MIN_FINAL_TRANSCRIPT_CHARS:
            return
        key = f"user-{int(time.time() * 1000)}"
        _save_memory(
            memory,
            key=key,
            content=text,
            metadata={
                "source": "livekit-user",
                "language": event.language,
                "room": ctx.room.name,
            },
            label="user transcript",
        )

    @session.on("conversation_item_added")
    def on_conversation_item_added(event: ConversationItemAddedEvent) -> None:
        role = getattr(event.item, "role", "")
        text_preview = _safe_item_text(event.item).strip()
        if text_preview:
            print(f"[conversation] role={role} text={text_preview[:200]!r}")
        else:
            print(f"[conversation] role={role} (non-text item)")
        if role != "assistant":
            return
        text = text_preview
        if len(text) < MIN_FINAL_TRANSCRIPT_CHARS:
            return
        key = f"assistant-{int(time.time() * 1000)}"
        _save_memory(
            memory,
            key=key,
            content=text,
            metadata={"source": "livekit-assistant", "room": ctx.room.name},
            label="assistant reply",
        )

    @session.on("speech_created")
    def on_speech_created(event: Any) -> None:
        source = getattr(event, "source", "unknown")
        user_initiated = getattr(event, "user_initiated", None)
        print(
            f"[tts] speech_created source={source} user_initiated={user_initiated}"
        )

    @session.on("agent_state_changed")
    def on_agent_state_changed(event: Any) -> None:
        print(
            "[state] "
            f"agent {getattr(event, 'old_state', 'unknown')} -> "
            f"{getattr(event, 'new_state', 'unknown')}"
        )

    @session.on("user_state_changed")
    def on_user_state_changed(event: Any) -> None:
        print(
            "[state] "
            f"user {getattr(event, 'old_state', 'unknown')} -> "
            f"{getattr(event, 'new_state', 'unknown')}"
        )

    @session.on("metrics_collected")
    def on_metrics_collected(event: Any) -> None:
        metrics = getattr(event, "metrics", None)
        if metrics is not None:
            print(f"[metrics] {metrics.__class__.__name__}")

    @session.on("error")
    def on_error(event: Any) -> None:
        err = getattr(event, "error", None)
        source = getattr(event, "source", None)
        print(f"[error] source={source} error={err}")

    await session.start(
        room=ctx.room,
        agent=Assistant(),
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(),
            text_output=room_io.TextOutputOptions(sync_transcription=False),
        ),
    )
    print("[session] started and waiting for user audio")
    await session.generate_reply(instructions="Greet the user and offer your help.")


if __name__ == "__main__":
    agents.cli.run_app(server)
