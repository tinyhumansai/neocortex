"""Tests for NeocortexChatStore."""

import pytest
from unittest.mock import MagicMock

from llama_index.core.llms import ChatMessage, MessageRole
from neocortex_llamaindex import NeocortexChatStore
from tinyhumansai import TinyHumanMemoryClient

@pytest.fixture
def mock_client():
    return MagicMock(spec=TinyHumanMemoryClient)

def test_chat_store_add_message(mock_client):
    store = NeocortexChatStore(client=mock_client)
    msg = ChatMessage(role=MessageRole.USER, content="Hello")
    store.add_message("session_1", msg)
    assert mock_client.ingest_memory.called
