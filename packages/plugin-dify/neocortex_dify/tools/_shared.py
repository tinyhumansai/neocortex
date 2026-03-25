from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional, Tuple

import httpx


DEFAULT_BASE_URL = "https://staging-api.alphahuman.xyz"
BASE_URL_ENV = "ALPHAHUMAN_BASE_URL"


def get_auth_and_namespace(runtime_credentials: Dict[str, Any], tool_parameters: Dict[str, Any]) -> Tuple[Optional[str], str]:
    token = (runtime_credentials or {}).get("alphahuman_api_key")
    default_namespace = (runtime_credentials or {}).get("default_namespace") or "agent_memory"
    namespace = tool_parameters.get("namespace") or default_namespace
    return (token, str(namespace))


def get_base_url(runtime_credentials: Dict[str, Any]) -> str:
    # Prefer explicit env var at runtime; Dify credentials can be extended later if needed.
    base = os.environ.get(BASE_URL_ENV) or DEFAULT_BASE_URL
    return str(base).rstrip("/")


def parse_json(value: Any, *, default: Any) -> Any:
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    if not isinstance(value, str):
        return default
    raw = value.strip()
    if not raw:
        return default
    try:
        return json.loads(raw)
    except Exception:
        return default


def request_json(
    *,
    token: str,
    base_url: str,
    method: str,
    path: str,
    json_body: Any = None,
    query_params: Optional[Dict[str, Any]] = None,
    timeout_s: float = 30.0,
) -> Any:
    url = f"{base_url}{path}"
    with httpx.Client(timeout=timeout_s) as client:
        res = client.request(
            method=method.upper(),
            url=url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            params={k: v for k, v in (query_params or {}).items() if v is not None},
            json=json_body,
        )
    try:
        payload = res.json()
    except Exception:
        payload = {"raw": res.text}
    if res.status_code >= 400 or payload.get("success") is False:
        err = payload.get("error") or f"HTTP {res.status_code}"
        raise RuntimeError(err)
    return payload

