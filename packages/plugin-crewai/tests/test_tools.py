"""Tests for Neocortex memory tools."""

import pytest
from unittest.mock import MagicMock

from neocortex_crewai import (
    NeocortexSaveMemoryTool,
    create_neocortex_tools,
)
from tinyhumansai import TinyHumanMemoryClient

@pytest.fixture
def mock_client():
    return MagicMock(spec=TinyHumanMemoryClient)

def test_save_memory_tool(mock_client):
    tool = NeocortexSaveMemoryTool(client=mock_client)
    res = tool.run(
        key="test_key",
        content="test content"
    )
    assert mock_client.ingest_memory.called
    assert "test_key" in res


def test_create_neocortex_tools_count(mock_client):
    tools = create_neocortex_tools(client=mock_client, default_namespace="test_ns")
    assert len(tools) == 19
