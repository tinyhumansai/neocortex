"""Tests for Neocortex memory tools."""

import pytest
from unittest.mock import MagicMock

from neocortex_keywordsai import NeocortexMemoryTools
from tinyhumansai import TinyHumanMemoryClient

@pytest.fixture
def mock_client():
    return MagicMock(spec=TinyHumanMemoryClient)

def test_tool_definitions(mock_client):
    tools = NeocortexMemoryTools(client=mock_client)
    defs = tools.get_tool_definitions()
    
    assert len(defs) == 20
    assert defs[0]["type"] == "function"
    assert defs[0]["function"]["name"] == "save_memory"

def test_tool_execution(mock_client):
    tools = NeocortexMemoryTools(client=mock_client)
    funcs = tools.get_tool_functions()
    
    assert "save_memory" in funcs
    
    res = funcs["save_memory"](key="test", content="value")
    assert mock_client.ingest_memory.called
    assert "test" in res
    assert "sync_memory" in funcs
