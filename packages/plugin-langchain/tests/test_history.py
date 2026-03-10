"""Tests for TinyHumanChatMessageHistory (LangChain adapter)."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, call

import pytest

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from tinyhumansai.types import (
    DeleteMemoryResponse,
    GetContextResponse,
    IngestMemoryResponse,
    ReadMemoryItem,
)
from neocortex_langchain.history import TinyHumanChatMessageHistory


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_client():
    client = MagicMock()
    client.recall_memory.return_value = GetContextResponse(
        context="", items=[], count=0
    )
    client.ingest_memories.return_value = IngestMemoryResponse(
        ingested=1, updated=0, errors=0
    )
    client.delete_memory.return_value = DeleteMemoryResponse(deleted=1)
    return client


@pytest.fixture()
def history(mock_client):
    return TinyHumanChatMessageHistory(
        client=mock_client, session_id="sess-1"
    )


# ---------------------------------------------------------------------------
# Contract test
# ---------------------------------------------------------------------------


def test_isinstance_base_history(history):
    from langchain_core.chat_history import BaseChatMessageHistory

    assert isinstance(history, BaseChatMessageHistory)


# ---------------------------------------------------------------------------
# messages property
# ---------------------------------------------------------------------------


def test_messages_empty(history, mock_client):
    assert history.messages == []


def test_messages_returns_sorted(history, mock_client):
    mock_client.recall_memory.return_value = GetContextResponse(
        context="",
        items=[
            ReadMemoryItem(
                key="2",
                content="second",
                namespace="chat_history_sess-1",
                metadata={"message_type": "ai"},
                created_at="2024-01-01T00:00:02Z",
                updated_at="",
            ),
            ReadMemoryItem(
                key="1",
                content="first",
                namespace="chat_history_sess-1",
                metadata={"message_type": "human"},
                created_at="2024-01-01T00:00:01Z",
                updated_at="",
            ),
        ],
        count=2,
    )

    msgs = history.messages
    assert len(msgs) == 2
    assert isinstance(msgs[0], HumanMessage)
    assert msgs[0].content == "first"
    assert isinstance(msgs[1], AIMessage)
    assert msgs[1].content == "second"


def test_messages_system_type(history, mock_client):
    mock_client.recall_memory.return_value = GetContextResponse(
        context="",
        items=[
            ReadMemoryItem(
                key="1",
                content="you are helpful",
                namespace="chat_history_sess-1",
                metadata={"message_type": "system"},
                created_at="2024-01-01T00:00:01Z",
                updated_at="",
            )
        ],
        count=1,
    )
    msgs = history.messages
    assert len(msgs) == 1
    assert isinstance(msgs[0], SystemMessage)


# ---------------------------------------------------------------------------
# add_messages
# ---------------------------------------------------------------------------


def test_add_messages(history, mock_client):
    history.add_messages([
        HumanMessage(content="Hello"),
        AIMessage(content="Hi there!"),
    ])

    mock_client.ingest_memories.assert_called_once()
    items = mock_client.ingest_memories.call_args.kwargs["items"]
    assert len(items) == 2
    assert items[0].content == "Hello"
    assert items[0].metadata == {"message_type": "human"}
    assert items[0].namespace == "chat_history_sess-1"
    assert items[1].content == "Hi there!"
    assert items[1].metadata == {"message_type": "ai"}


def test_add_messages_empty(history, mock_client):
    history.add_messages([])
    mock_client.ingest_memories.assert_not_called()


# ---------------------------------------------------------------------------
# clear
# ---------------------------------------------------------------------------


def test_clear(history, mock_client):
    history.clear()

    mock_client.delete_memory.assert_called_once_with(
        namespace="chat_history_sess-1",
        delete_all=True,
    )


# ---------------------------------------------------------------------------
# Namespace isolation
# ---------------------------------------------------------------------------


def test_different_sessions_use_different_namespaces(mock_client):
    h1 = TinyHumanChatMessageHistory(client=mock_client, session_id="a")
    h2 = TinyHumanChatMessageHistory(client=mock_client, session_id="b")
    assert h1._namespace != h2._namespace
    assert h1._namespace == "chat_history_a"
    assert h2._namespace == "chat_history_b"
