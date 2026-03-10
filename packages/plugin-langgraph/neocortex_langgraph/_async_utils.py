"""Async helper utilities for TinyHumans integrations."""

from __future__ import annotations

import asyncio
from typing import Any, Callable, TypeVar

T = TypeVar("T")


async def _run_sync(fn: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """Run a synchronous function in a thread via asyncio.to_thread (Python 3.9+)."""
    if kwargs:
        return await asyncio.to_thread(lambda: fn(*args, **kwargs))
    return await asyncio.to_thread(fn, *args)
