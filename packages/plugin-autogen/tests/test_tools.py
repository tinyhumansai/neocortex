"""Tests for Neocortex memory tools."""

import pytest
from unittest.mock import MagicMock

from neocortex_autogen import NeocortexMemoryTools
from tinyhumansai import TinyHumanMemoryClient

@pytest.fixture
def mock_client():
    return MagicMock(spec=TinyHumanMemoryClient)

def test_save_memory_tool(mock_client):
    tools = NeocortexMemoryTools(client=mock_client)
    res = tools.save_memory(
        key="test_key",
        content="test content"
    )
    assert mock_client.ingest_memory.called
    assert "test_key" in res


def test_full_tool_surface_methods_exist(mock_client):
    tools = NeocortexMemoryTools(client=mock_client)
    expected = [
        "save_memory",
        "recall_memory",
        "delete_memory",
        "sync_memory",
        "insert_document",
        "insert_documents_batch",
        "list_documents",
        "get_document",
        "delete_document",
        "query_memory_context",
        "chat_memory_context",
        "record_interactions",
        "recall_thoughts",
        "chat_memory",
        "interact_memory",
        "recall_memory_master",
        "recall_memories",
        "get_ingestion_job",
    ]
    for name in expected:
        assert hasattr(tools, name), f"missing tool method: {name}"
