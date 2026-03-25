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
    assert len(tools) == 19


def test_query_memory_context_uses_default_namespace(mock_client):
    toolkit = NeocortexToolkit(client=mock_client, default_namespace="my_default")
    toolkit._request_json = MagicMock(return_value={"context": {"chunks": []}})

    toolkit.query_memory_context(query="user preference")

    call_kwargs = toolkit._request_json.call_args.kwargs
    assert call_kwargs["path"] == "/v1/memory/queries"
    assert call_kwargs["json_body"]["namespace"] == "my_default"
