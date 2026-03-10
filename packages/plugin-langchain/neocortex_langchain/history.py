"""LangChain BaseChatMessageHistory backed by the TinyHumans memory API."""

from __future__ import annotations

import time
from typing import List, Sequence

from langchain_core.chat_history import BaseChatMessageHistory
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    messages_from_dict,
)

from tinyhumansai import TinyHumanMemoryClient, MemoryItem


_TYPE_MAP = {
    "human": HumanMessage,
    "ai": AIMessage,
    "system": SystemMessage,
}


class TinyHumanChatMessageHistory(BaseChatMessageHistory):
    """Chat message history stored in the TinyHumans memory API.

    Each session gets its own namespace so ``clear()`` only deletes
    that session's messages.

    Args:
        client: An initialised :class:`TinyHumanMemoryClient`.
        session_id: Unique identifier for this conversation session.
        namespace_prefix: Prefix for the namespace (default ``"chat_history"``).
    """

    def __init__(
        self,
        client: TinyHumanMemoryClient,
        session_id: str,
        namespace_prefix: str = "chat_history",
    ) -> None:
        self._client = client
        self._session_id = session_id
        self._namespace = f"{namespace_prefix}_{session_id}"

    @property
    def messages(self) -> List[BaseMessage]:  # noqa: UP006
        resp = self._client.recall_memory(
            namespace=self._namespace,
            prompt="*",
            num_chunks=1000,
        )
        sorted_items = sorted(resp.items, key=lambda it: it.created_at or "")
        msgs: List[BaseMessage] = []
        for item in sorted_items:
            msg_type = item.metadata.get("message_type", "human")
            cls = _TYPE_MAP.get(msg_type, HumanMessage)
            msgs.append(cls(content=item.content))
        return msgs

    def add_messages(self, messages: Sequence[BaseMessage]) -> None:
        ts = time.time()
        items = []
        for i, msg in enumerate(messages):
            msg_type = _message_type(msg)
            items.append(
                MemoryItem(
                    key=f"{ts}_{i}",
                    content=msg.content,
                    namespace=self._namespace,
                    metadata={"message_type": msg_type},
                )
            )
        if items:
            self._client.ingest_memories(items=items)

    def clear(self) -> None:
        self._client.delete_memory(
            namespace=self._namespace,
            delete_all=True,
        )


def _message_type(msg: BaseMessage) -> str:
    if isinstance(msg, HumanMessage):
        return "human"
    if isinstance(msg, AIMessage):
        return "ai"
    if isinstance(msg, SystemMessage):
        return "system"
    return msg.type
