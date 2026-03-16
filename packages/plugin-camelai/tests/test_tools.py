"""Tests for Neocortex memory tools."""

import pytest
from unittest.mock import MagicMock

from neocortex_camelai import NeocortexToolkit
from tinyhumansai import TinyHumanMemoryClient

@pytest.fixture
def mock_client():
    return MagicMock(spec=TinyHumanMemoryClient)

def test_save_memory_tool(mock_client):
    toolkit = NeocortexToolkit(client=mock_client)
    res = toolkit.save_memory(
        key="test_key",
        content="test content"
    )
    assert mock_client.ingest_memory.called
    assert "test_key" in res

def test_get_tools(mock_client):
    toolkit = NeocortexToolkit(client=mock_client)
    tools = toolkit.get_tools()
    assert len(tools) == 3
