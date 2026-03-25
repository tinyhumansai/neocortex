"""Tests for Neocortex Dify tools."""

import json
import os
import time
import uuid
import pytest
from unittest.mock import MagicMock

from neocortex_dify.tools.save_memory import SaveMemoryTool
from neocortex_dify.tools.recall_memory import RecallMemoryTool
from neocortex_dify.tools.delete_memory import DeleteMemoryTool
from neocortex_dify.tools.sync_memory import SyncMemoryTool
from neocortex_dify.tools.insert_document import InsertDocumentTool
from neocortex_dify.tools.insert_documents_batch import (
    InsertDocumentsBatchTool,
)
from neocortex_dify.tools.list_documents import ListDocumentsTool
from neocortex_dify.tools.get_document import GetDocumentTool
from neocortex_dify.tools.delete_document import DeleteDocumentTool
from neocortex_dify.tools.query_memory_context import QueryMemoryContextTool
from neocortex_dify.tools.chat_memory_context import ChatMemoryContextTool
from neocortex_dify.tools.record_interactions import RecordInteractionsTool
from neocortex_dify.tools.recall_thoughts import RecallThoughtsTool
from neocortex_dify.tools.chat_memory import ChatMemoryTool
from neocortex_dify.tools.interact_memory import InteractMemoryTool
from neocortex_dify.tools.recall_memory_master import RecallMemoryMasterTool
from neocortex_dify.tools.recall_memories import RecallMemoriesTool
from neocortex_dify.tools.get_ingestion_job import GetIngestionJobTool


class MockRuntime:
    def __init__(self, token):
        self.credentials = {"tinyhuman_api_key": token, "default_namespace": "test_space"}


class MockSession:
    """Minimal session stub for dify_plugin.Tool."""

    def __init__(self):
        self.user_id = "test-user"


class MockRuntimeEmpty:
    def __init__(self):
        self.credentials = {"default_namespace": "test_space"}


def test_all_tools_missing_token_return_error():
    tool_classes = [
        SaveMemoryTool,
        RecallMemoryTool,
        DeleteMemoryTool,
        SyncMemoryTool,
        InsertDocumentTool,
        InsertDocumentsBatchTool,
        ListDocumentsTool,
        GetDocumentTool,
        DeleteDocumentTool,
        QueryMemoryContextTool,
        ChatMemoryContextTool,
        RecordInteractionsTool,
        RecallThoughtsTool,
        ChatMemoryTool,
        InteractMemoryTool,
        RecallMemoryMasterTool,
        RecallMemoriesTool,
        GetIngestionJobTool,
    ]

    for tool_cls in tool_classes:
        runtime = MockRuntimeEmpty()
        session = MockSession()
        tool = tool_cls(runtime=runtime, session=session)
        tool.create_text_message = MagicMock(return_value={"text": "Error"})
        res = tool._invoke({})
        assert tool.create_text_message.called
        assert isinstance(res, dict)


def _make_tool(tool_cls, *, token: str):
    runtime = MockRuntime(token)
    session = MockSession()
    tool = tool_cls(runtime=runtime, session=session)
    # Dify Tool base requires runner context; mock for unit tests.
    tool.create_text_message = MagicMock(side_effect=lambda text: {"text": text})
    return tool


def _integration_token() -> str | None:
    return os.environ.get("ALPHAHUMAN_API_KEY") or os.environ.get("ALPHAHUMAN_TOKEN")


def _parse_tool_json_text(res: dict) -> dict | None:
    text = (res or {}).get("text")
    if not isinstance(text, str):
        return None
    raw = text.strip()
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except Exception:
        return None
    return parsed if isinstance(parsed, dict) else None


def _find_first_job_id(payload: object) -> str | None:
    # We don’t assume exact response shape; search broadly.
    if isinstance(payload, dict):
        for k in ("jobId", "job_id", "ingestionJobId", "ingestion_job_id", "ingestion_job", "ingestionJob"):
            v = payload.get(k)
            if isinstance(v, str) and v.strip():
                return v.strip()
        for v in payload.values():
            found = _find_first_job_id(v)
            if found:
                return found
    elif isinstance(payload, list):
        for v in payload:
            found = _find_first_job_id(v)
            if found:
                return found
    return None


def _print_tool_result(tool_name: str, res: dict, *, max_chars: int = 2000) -> None:
    text = (res or {}).get("text")
    if not isinstance(text, str):
        print(f"[{tool_name}] result (non-text): {res!r}")
        return
    raw = text.strip()
    if len(raw) > max_chars:
        raw = raw[:max_chars] + f"... (truncated, total {len(text)} chars)"
    print(f"[{tool_name}] {raw}")


@pytest.mark.integration
def test_all_tools_call_real_endpoints():
    token = _integration_token()
    if not token:
        pytest.skip("Set ALPHAHUMAN_API_KEY (or ALPHAHUMAN_TOKEN) to run integration tests.")

    ns = f"plugin-dify-test-{int(time.time())}"
    uniq = uuid.uuid4().hex[:10]
    doc_id = f"doc_{uniq}"
    batch_doc_id = f"doc_batch_{uniq}"
    key = f"mem_{uniq}"

    # ---- TinyHuman SDK tools (real network) ----
    save = _make_tool(SaveMemoryTool, token=token)
    recall = _make_tool(RecallMemoryTool, token=token)
    delete_mem = _make_tool(DeleteMemoryTool, token=token)

    res = save._invoke({"key": key, "content": f"hello from {uniq}", "namespace": ns})
    assert isinstance(res, dict)
    _print_tool_result("SaveMemoryTool", res)

    res = recall._invoke({"prompt": "hello", "namespace": ns, "num_chunks": 3})
    assert isinstance(res, dict)
    _print_tool_result("RecallMemoryTool", res)

    res = delete_mem._invoke({"namespace": ns})
    assert isinstance(res, dict)
    _print_tool_result("DeleteMemoryTool", res)

    # ---- HTTP tools (real network) ----
    insert_doc = _make_tool(InsertDocumentTool, token=token)
    list_docs = _make_tool(ListDocumentsTool, token=token)
    get_doc = _make_tool(GetDocumentTool, token=token)
    del_doc = _make_tool(DeleteDocumentTool, token=token)

    res = insert_doc._invoke(
        {
            "title": f"Test {uniq}",
            "content": f"content {uniq}",
            "namespace": ns,
            "document_id": doc_id,
            "source_type": "doc",
            "metadata_json": json.dumps({"test": True, "uniq": uniq}),
        }
    )
    assert isinstance(res, dict)
    _print_tool_result("InsertDocumentTool", res)
    insert_doc_payload = _parse_tool_json_text(res)

    res = list_docs._invoke({"namespace": ns, "limit": 10, "offset": 0})
    assert isinstance(res, dict)
    _print_tool_result("ListDocumentsTool", res)

    res = get_doc._invoke({"document_id": doc_id, "namespace": ns})
    assert isinstance(res, dict)
    _print_tool_result("GetDocumentTool", res)

    # Batch insert (uses same endpoint family)
    batch = _make_tool(InsertDocumentsBatchTool, token=token)
    res = batch._invoke(
        {
            "items_json": json.dumps(
                [
                    {
                        "title": f"Batch {uniq}",
                        "content": f"batch content {uniq}",
                        "namespace": ns,
                        "document_id": batch_doc_id,
                        "sourceType": "doc",
                    }
                ]
            )
        }
    )
    assert isinstance(res, dict)
    _print_tool_result("InsertDocumentsBatchTool", res)
    batch_payload = _parse_tool_json_text(res)

    # ---- Ingestion job status (end-to-end) ----
    # Prefer job id from ingest response, fallback to env override.
    job_id = (
        _find_first_job_id(batch_payload)
        or _find_first_job_id(insert_doc_payload)
        or os.environ.get("ALPHAHUMAN_INGESTION_JOB_ID")
    )
    assert job_id, (
        "Could not determine ingestion job id from insert responses. "
        "Set ALPHAHUMAN_INGESTION_JOB_ID to force this step."
    )

    ingestion = _make_tool(GetIngestionJobTool, token=token)
    res = ingestion._invoke({"job_id": job_id})
    assert isinstance(res, dict)
    _print_tool_result("GetIngestionJobTool", res)

    # Query / chat / interactions / thoughts / recall APIs
    query = _make_tool(QueryMemoryContextTool, token=token)
    res = query._invoke({"query": "content", "namespace": ns, "include_references": True, "max_chunks": 3})
    assert isinstance(res, dict)
    _print_tool_result("QueryMemoryContextTool", res)

    chat_ctx = _make_tool(ChatMemoryContextTool, token=token)
    res = chat_ctx._invoke(
        {"messages_json": json.dumps([{"role": "user", "content": "hello"}]), "temperature": 0.2, "max_tokens": 64}
    )
    assert isinstance(res, dict)
    _print_tool_result("ChatMemoryContextTool", res)

    chat = _make_tool(ChatMemoryTool, token=token)
    res = chat._invoke(
        {"messages_json": json.dumps([{"role": "user", "content": "hello"}]), "temperature": 0.2, "max_tokens": 64}
    )
    assert isinstance(res, dict)
    _print_tool_result("ChatMemoryTool", res)

    interact = _make_tool(InteractMemoryTool, token=token)
    res = interact._invoke(
        {"namespace": ns, "entity_names_json": json.dumps(["user"]), "description": f"likes coffee {uniq}", "interaction_level": 2}
    )
    assert isinstance(res, dict)
    _print_tool_result("InteractMemoryTool", res)

    record = _make_tool(RecordInteractionsTool, token=token)
    res = record._invoke(
        {"namespace": ns, "entity_names_json": json.dumps(["user", "assistant"]), "description": f"test interaction {uniq}"}
    )
    assert isinstance(res, dict)
    _print_tool_result("RecordInteractionsTool", res)

    thoughts = _make_tool(RecallThoughtsTool, token=token)
    res = thoughts._invoke({"namespace": ns, "max_chunks": 3, "temperature": 0.3, "persist": False})
    assert isinstance(res, dict)
    _print_tool_result("RecallThoughtsTool", res)

    master = _make_tool(RecallMemoryMasterTool, token=token)
    res = master._invoke({"namespace": ns, "max_chunks": 3})
    assert isinstance(res, dict)
    _print_tool_result("RecallMemoryMasterTool", res)

    memories = _make_tool(RecallMemoriesTool, token=token)
    res = memories._invoke({"namespace": ns, "top_k": 3, "min_retention": 0.1})
    assert isinstance(res, dict)
    _print_tool_result("RecallMemoriesTool", res)

    # Sync memory
    sync = _make_tool(SyncMemoryTool, token=token)
    res = sync._invoke(
        {
            "workspace_id": f"ws_{uniq}",
            "agent_id": f"agent_{uniq}",
            "files_json": json.dumps([{"path": "note.txt", "content": "hello"}]),
            "source": "pytest-integration",
        }
    )
    assert isinstance(res, dict)
    _print_tool_result("SyncMemoryTool", res)

    # Cleanup document (best-effort)
    res = del_doc._invoke({"document_id": doc_id, "namespace": ns})
    assert isinstance(res, dict)
    _print_tool_result("DeleteDocumentTool (doc)", res)

    # Cleanup batch doc (best-effort)
    res = del_doc._invoke({"document_id": batch_doc_id, "namespace": ns})
    assert isinstance(res, dict)
    _print_tool_result("DeleteDocumentTool (batch_doc)", res)
