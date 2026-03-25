import json
from typing import Any

from dify_plugin import Tool

from ._shared import get_auth_and_namespace, get_base_url, request_json


class RecallMemoryMasterTool(Tool):
    """Recall master memory context (POST /v1/memory/recall)."""

    def _invoke(self, tool_parameters: dict[str, Any]) -> dict[str, Any]:
        namespace = tool_parameters.get("namespace")
        max_chunks = tool_parameters.get("max_chunks")

        token, ns = get_auth_and_namespace(self.runtime.credentials, {"namespace": namespace})
        if not token:
            return self.create_text_message("Error: missing alphahuman_api_key credential.")

        base_url = get_base_url(self.runtime.credentials)
        try:
            payload = request_json(
                token=token,
                base_url=base_url,
                method="POST",
                path="/v1/memory/recall",
                json_body={"namespace": ns, "maxChunks": max_chunks},
            )
            return self.create_text_message(json.dumps(payload, ensure_ascii=False))
        except Exception as exc:
            return self.create_text_message(f"Failed to recall memory master: {exc}")

