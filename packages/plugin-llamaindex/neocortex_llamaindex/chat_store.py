"""LlamaIndex BaseChatStore backed by the TinyHumans memory API."""

import json
from typing import Any, List, Optional

from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.core.storage.chat_store.base import BaseChatStore

from tinyhumansai import TinyHumanMemoryClient, MemoryItem, TinyHumanError


class NeocortexChatStore(BaseChatStore):
    """Chat message history stored in the TinyHumans memory API.

    Each key gets mapped to a namespace in the TinyHuman API. This ensures
    conversations are isolated and persistent.

    Args:
        client: An initialized :class:`TinyHumanMemoryClient`.
        namespace_prefix: Prefix for the namespace (default ``"chat_store"``).
    """

    def __init__(
        self,
        client: TinyHumanMemoryClient,
        namespace_prefix: str = "chat_store",
    ) -> None:
        self._client = client
        self._namespace_prefix = namespace_prefix

    @classmethod
    def class_name(cls) -> str:
        """Get class name."""
        return "NeocortexChatStore"

    def _get_namespace(self, key: str) -> str:
        return f"{self._namespace_prefix}_{key}"

    def set_messages(self, key: str, messages: List[ChatMessage]) -> None:
        """Set messages for a key. Clears existing memory in the namespace first."""
        self.delete_messages(key)
        for msg in messages:
            self.add_message(key, msg)

    def get_messages(self, key: str) -> List[ChatMessage]:
        """Get messages for a key."""
        namespace = self._get_namespace(key)
        try:
            resp = self._client.recall_memory(
                namespace=namespace,
                prompt="*",
                num_chunks=1000,
            )
        except TinyHumanError:
            return []

        # Sort by creation time to reconstruct history sequentially
        sorted_items = sorted(resp.items, key=lambda it: it.created_at or "")
        
        chat_messages: List[ChatMessage] = []
        for item in sorted_items:
            try:
                role_str = item.metadata.get("role", "user")
                role = MessageRole(role_str)
                content = item.content
                chat_messages.append(
                    ChatMessage(
                        role=role,
                        content=content,
                        additional_kwargs=item.metadata.get("additional_kwargs", {})
                    )
                )
            except Exception:
                pass  # Skip corrupted messages
        return chat_messages

    def add_message(self, key: str, message: ChatMessage, idx: Optional[int] = None) -> None:
        """Add a message for a key. The sequence is handled via creation time."""
        import time
        ts = time.time()
        namespace = self._get_namespace(key)
        item_key = f"{ts}_{idx if idx is not None else 0}"
        
        metadata = {
            "role": message.role.value,
            "additional_kwargs": message.additional_kwargs or {}
        }
        
        self._client.ingest_memory(
            item=MemoryItem(
                key=item_key,
                content=str(message.content or ""),
                namespace=namespace,
                metadata=metadata,
            )
        )

    def delete_messages(self, key: str) -> Optional[List[ChatMessage]]:
        """Delete all messages for a key."""
        namespace = self._get_namespace(key)
        messages = self.get_messages(key)
        try:
            self._client.delete_memory(namespace=namespace, delete_all=True)
        except TinyHumanError:
            pass
        return messages

    def delete_message(self, key: str, idx: int) -> Optional[ChatMessage]:
        """Delete specific message for a key."""
        messages = self.get_messages(key)
        if 0 <= idx < len(messages):
            msg = messages.pop(idx)
            self.set_messages(key, messages)
            return msg
        return None

    def delete_last_message(self, key: str) -> Optional[ChatMessage]:
        """Delete last message for a key."""
        return self.delete_message(key, -1)

    def get_keys(self) -> List[str]:
        """Get all keys. Not deeply supported by pure namespace prefixing without tracking meta-collections."""
        return []
