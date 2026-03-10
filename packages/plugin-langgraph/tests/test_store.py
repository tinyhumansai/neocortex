"""Tests for TinyHumanStore (LangGraph BaseStore adapter)."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional, Sequence
from unittest.mock import MagicMock, call, patch

import pytest

from tinyhumansai.types import (
    GetContextResponse,
    IngestMemoryResponse,
    DeleteMemoryResponse,
    MemoryItem,
    ReadMemoryItem,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def mock_client():
    client = MagicMock()
    # Default: no known namespaces on init
    client.recall_memory.return_value = GetContextResponse(
        context="", items=[], count=0
    )
    client.ingest_memory.return_value = IngestMemoryResponse(
        ingested=1, updated=0, errors=0
    )
    client.ingest_memories.return_value = IngestMemoryResponse(
        ingested=1, updated=0, errors=0
    )
    client.delete_memory.return_value = DeleteMemoryResponse(deleted=1)
    return client


@pytest.fixture()
def store(mock_client):
    from neocortex_langgraph.store import TinyHumanStore

    return TinyHumanStore(client=mock_client)


# ---------------------------------------------------------------------------
# Contract test
# ---------------------------------------------------------------------------


def test_isinstance_base_store(store):
    from langgraph.store.base import BaseStore

    assert isinstance(store, BaseStore)


# ---------------------------------------------------------------------------
# PutOp
# ---------------------------------------------------------------------------


def test_put_calls_ingest(store, mock_client):
    store.put(("user", "123"), key="pref", value={"theme": "dark"})

    # ingest_memory is called twice: once for the put, once for namespace tracking
    assert mock_client.ingest_memory.call_count >= 1
    # First call is the actual put
    first_call = mock_client.ingest_memory.call_args_list[0]
    item = first_call.kwargs["item"]
    assert item.namespace == "user:123"
    assert item.key == "pref"
    assert json.loads(item.content) == {"theme": "dark"}


def test_put_none_deletes(store, mock_client):
    store.put(("user", "123"), key="pref", value=None)

    mock_client.delete_memory.assert_called_once_with(
        namespace="user:123", key="pref"
    )


def test_put_tracks_namespace(store, mock_client):
    store.put(("user", "123"), key="k", value={"a": 1})

    assert "user:123" in store._known_namespaces


# ---------------------------------------------------------------------------
# GetOp
# ---------------------------------------------------------------------------


def test_get_found(store, mock_client):
    mock_client.recall_memory.return_value = GetContextResponse(
        context="",
        items=[
            ReadMemoryItem(
                key="pref",
                content='{"theme":"dark"}',
                namespace="user:123",
                metadata={},
                created_at="2024-01-01T00:00:00Z",
                updated_at="2024-01-01T00:00:00Z",
            )
        ],
        count=1,
    )

    item = store.get(("user", "123"), key="pref")

    assert item is not None
    assert item.value == {"theme": "dark"}
    assert item.key == "pref"


def test_get_not_found(store, mock_client):
    mock_client.recall_memory.return_value = GetContextResponse(
        context="", items=[], count=0
    )
    item = store.get(("user", "123"), key="missing")
    assert item is None


# ---------------------------------------------------------------------------
# SearchOp
# ---------------------------------------------------------------------------


def test_search(store, mock_client):
    mock_client.recall_memory.return_value = GetContextResponse(
        context="",
        items=[
            ReadMemoryItem(
                key="k1",
                content='{"data":"hello"}',
                namespace="user:123",
                metadata={},
                created_at="",
                updated_at="",
            )
        ],
        count=1,
    )

    results = store.search(("user", "123"), query="hello")

    assert len(results) == 1
    assert results[0].value == {"data": "hello"}

    mock_client.recall_memory.assert_called_with(
        namespace="user:123", prompt="hello", num_chunks=10
    )


# ---------------------------------------------------------------------------
# ListNamespacesOp
# ---------------------------------------------------------------------------


def test_list_namespaces(store):
    store._known_namespaces = {"user:1", "user:2", "org:x"}

    result = store.list_namespaces(prefix=("user",))
    ns_list = [tuple(ns) for ns in result]
    assert ("user", "1") in ns_list
    assert ("user", "2") in ns_list
    assert ("org", "x") not in ns_list


def test_list_namespaces_with_suffix(store):
    store._known_namespaces = {"a:b:c", "x:y:c", "a:b:d"}

    result = store.list_namespaces(suffix=("c",))
    ns_list = [tuple(ns) for ns in result]
    assert ("a", "b", "c") in ns_list
    assert ("x", "y", "c") in ns_list
    assert ("a", "b", "d") not in ns_list


def test_list_namespaces_max_depth(store):
    store._known_namespaces = {"a", "a:b", "a:b:c"}

    result = store.list_namespaces(max_depth=2)
    ns_list = [tuple(ns) for ns in result]
    assert ("a",) in ns_list
    assert ("a", "b") in ns_list
    assert ("a", "b", "c") not in ns_list


# ---------------------------------------------------------------------------
# Namespace join/split
# ---------------------------------------------------------------------------


def test_namespace_roundtrip(store):
    ns = ("user", "123", "memories")
    joined = store._join_ns(ns)
    assert joined == "user:123:memories"
    assert store._split_ns(joined) == ns


# ---------------------------------------------------------------------------
# Value parsing
# ---------------------------------------------------------------------------


def test_parse_value_dict():
    from neocortex_langgraph.store import TinyHumanStore

    assert TinyHumanStore._parse_value('{"a":1}') == {"a": 1}


def test_parse_value_non_dict():
    from neocortex_langgraph.store import TinyHumanStore

    assert TinyHumanStore._parse_value('"hello"') == {"value": "hello"}


def test_parse_value_invalid_json():
    from neocortex_langgraph.store import TinyHumanStore

    assert TinyHumanStore._parse_value("not json") == {"value": "not json"}


# ---------------------------------------------------------------------------
# Async
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_abatch(store, mock_client):
    mock_client.recall_memory.return_value = GetContextResponse(
        context="", items=[], count=0
    )
    results = await store.abatch([])
    assert results == []
