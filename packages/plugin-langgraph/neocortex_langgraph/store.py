"""LangGraph BaseStore implementation backed by the TinyHumans memory API."""

from __future__ import annotations

import json
import logging
from typing import Any, Iterable, Optional, Sequence

from langgraph.store.base import (
    BaseStore,
    GetOp,
    Item,
    ListNamespacesOp,
    NamespacePath,
    Op,
    PutOp,
    Result,
    SearchOp,
)

from tinyhumansai import TinyHumanMemoryClient, MemoryItem, TinyHumanError

from ._async_utils import _run_sync

logger = logging.getLogger(__name__)

_META_NAMESPACE = "__tinyhuman_meta__"
_META_KEY = "known_namespaces"


class TinyHumanStore(BaseStore):
    """A LangGraph :class:`BaseStore` backed by the TinyHumans memory API.

    Args:
        client: An initialised :class:`TinyHumanMemoryClient`.
        namespace_separator: String used to join namespace tuples (default ``":"``).
    """

    def __init__(
        self,
        client: TinyHumanMemoryClient,
        namespace_separator: str = ":",
    ) -> None:
        self._client = client
        self._sep = namespace_separator
        self._known_namespaces: set[str] = set()
        self._load_known_namespaces()

    # ------------------------------------------------------------------
    # Namespace helpers
    # ------------------------------------------------------------------

    def _join_ns(self, namespace: tuple[str, ...]) -> str:
        return self._sep.join(namespace)

    def _split_ns(self, joined: str) -> tuple[str, ...]:
        return tuple(joined.split(self._sep))

    def _load_known_namespaces(self) -> None:
        try:
            resp = self._client.recall_memory(
                namespace=_META_NAMESPACE,
                prompt="*",
                num_chunks=1,
                key=_META_KEY,
            )
            if resp.items:
                data = json.loads(resp.items[0].content)
                if isinstance(data, list):
                    self._known_namespaces = set(data)
        except (TinyHumanError, json.JSONDecodeError, Exception) as exc:
            logger.debug("Could not load known namespaces: %s", exc)

    def _persist_known_namespaces(self) -> None:
        try:
            self._client.ingest_memory(
                item=MemoryItem(
                    key=_META_KEY,
                    content=json.dumps(sorted(self._known_namespaces)),
                    namespace=_META_NAMESPACE,
                )
            )
        except TinyHumanError as exc:
            logger.warning("Failed to persist known namespaces: %s", exc)

    def _track_namespace(self, joined_ns: str) -> None:
        if joined_ns not in self._known_namespaces:
            self._known_namespaces.add(joined_ns)
            self._persist_known_namespaces()

    # ------------------------------------------------------------------
    # BaseStore interface
    # ------------------------------------------------------------------

    def batch(self, ops: Iterable[Op]) -> list[Result]:
        results: list[Result] = []
        for op in ops:
            results.append(self._exec_op(op))
        return results

    async def abatch(self, ops: Iterable[Op]) -> list[Result]:
        return await _run_sync(self.batch, list(ops))

    # ------------------------------------------------------------------
    # Operation dispatch
    # ------------------------------------------------------------------

    def _exec_op(self, op: Op) -> Result:
        if isinstance(op, GetOp):
            return self._handle_get(op)
        if isinstance(op, PutOp):
            return self._handle_put(op)
        if isinstance(op, SearchOp):
            return self._handle_search(op)
        if isinstance(op, ListNamespacesOp):
            return self._handle_list_namespaces(op)
        raise NotImplementedError(f"Unsupported operation: {type(op)}")

    # ------------------------------------------------------------------
    # GetOp
    # ------------------------------------------------------------------

    def _handle_get(self, op: GetOp) -> Item | None:
        joined = self._join_ns(op.namespace)
        try:
            resp = self._client.recall_memory(
                namespace=joined,
                prompt="*",
                num_chunks=1,
                key=op.key,
            )
        except TinyHumanError:
            return None
        if not resp.items:
            return None
        ri = resp.items[0]
        value = self._parse_value(ri.content)
        return Item(
            value=value,
            key=ri.key,
            namespace=op.namespace,
            created_at=self._parse_datetime(ri.created_at),
            updated_at=self._parse_datetime(ri.updated_at),
        )

    # ------------------------------------------------------------------
    # PutOp
    # ------------------------------------------------------------------

    def _handle_put(self, op: PutOp) -> None:
        joined = self._join_ns(op.namespace)
        if op.value is None:
            try:
                self._client.delete_memory(namespace=joined, key=op.key)
            except TinyHumanError as exc:
                logger.warning("delete_memory failed: %s", exc)
            return None

        content = json.dumps(op.value)
        metadata: dict[str, Any] = {}
        if isinstance(op.value, dict):
            metadata = {k: v for k, v in op.value.items() if isinstance(v, (str, int, float, bool))}
        self._client.ingest_memory(
            item=MemoryItem(
                key=op.key,
                content=content,
                namespace=joined,
                metadata=metadata,
            )
        )
        self._track_namespace(joined)
        return None

    # ------------------------------------------------------------------
    # SearchOp
    # ------------------------------------------------------------------

    def _handle_search(self, op: SearchOp) -> list[Item]:
        joined = self._join_ns(op.namespace_prefix)
        limit = op.limit if op.limit else 10
        query = op.query or "*"
        try:
            resp = self._client.recall_memory(
                namespace=joined,
                prompt=query,
                num_chunks=limit,
            )
        except TinyHumanError:
            return []
        items: list[Item] = []
        for ri in resp.items:
            value = self._parse_value(ri.content)
            items.append(
                Item(
                    value=value,
                    key=ri.key,
                    namespace=self._split_ns(ri.namespace),
                    created_at=self._parse_datetime(ri.created_at),
                    updated_at=self._parse_datetime(ri.updated_at),
                )
            )
        return items

    # ------------------------------------------------------------------
    # ListNamespacesOp
    # ------------------------------------------------------------------

    def _handle_list_namespaces(self, op: ListNamespacesOp) -> list[tuple[str, ...]]:
        candidates = [self._split_ns(ns) for ns in self._known_namespaces]

        if op.match_conditions:
            for condition in op.match_conditions:
                if condition.match_type == "prefix":
                    prefix = tuple(condition.path)
                    candidates = [c for c in candidates if c[: len(prefix)] == prefix]
                elif condition.match_type == "suffix":
                    suffix = tuple(condition.path)
                    candidates = [c for c in candidates if c[-len(suffix) :] == suffix]

        if op.max_depth is not None:
            candidates = [c for c in candidates if len(c) <= op.max_depth]

        candidates.sort()

        offset = op.offset or 0
        limit = op.limit or 100
        return candidates[offset : offset + limit]

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_value(content: str) -> dict[str, Any]:
        try:
            val = json.loads(content)
            if isinstance(val, dict):
                return val
            return {"value": val}
        except (json.JSONDecodeError, TypeError):
            return {"value": content}

    @staticmethod
    def _parse_datetime(dt_str: str) -> Optional[Any]:
        if not dt_str:
            return None
        try:
            from datetime import datetime, timezone

            return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None
