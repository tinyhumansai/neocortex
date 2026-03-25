"""Tests for Neocortex memory tools."""

import asyncio

import pytest
from unittest.mock import MagicMock

from neocortex_vercelai import NeocortexMemoryTools
from tinyhumansai import TinyHumanMemoryClient


@pytest.fixture
def mock_client():
    return MagicMock(spec=TinyHumanMemoryClient)


def test_get_tools(mock_client):
    wrapper = NeocortexMemoryTools(client=mock_client)
    tools = wrapper.get_tools()

    expected = {
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
    }
    missing = expected.difference(set(tools.keys()))
    assert not missing, f"Missing tool keys: {sorted(missing)}"

    save_tool = tools["save_memory"]
    res = asyncio.run(
        save_tool.run(key="test", content="value", namespace="ns", metadata_json=None)
    )
    assert mock_client.ingest_memory.called
    assert "test" in res
