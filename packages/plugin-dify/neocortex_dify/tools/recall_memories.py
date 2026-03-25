import json
from typing import Any

from dify_plugin import Tool

from ._shared import get_auth_and_namespace, get_base_url, request_json


class RecallMemoriesTool(Tool):
    """Recall Ebbinghaus memories (POST /v1/memory/memories/recall)."""

    def _invoke(self, tool_parameters: dict[str, Any]) -> dict[str, Any]:
        namespace = tool_parameters.get("namespace")
        top_k = tool_parameters.get("top_k")
        min_retention = tool_parameters.get("min_retention")
        as_of = tool_parameters.get("as_of")

        token, ns = get_auth_and_namespace(self.runtime.credentials, {"namespace": namespace})
        if not token:
            return self.create_text_message("Error: missing alphahuman_api_key credential.")

        base_url = get_base_url(self.runtime.credentials)
        try:
            payload = request_json(
                token=token,
                base_url=base_url,
                method="POST",
                path="/v1/memory/memories/recall",
                json_body={
                    "namespace": ns,
                    "topK": top_k,
                    "minRetention": min_retention,
                    "asOf": as_of,
                },
            )
            return self.create_text_message(json.dumps(payload, ensure_ascii=False))
        except Exception as exc:
            return self.create_text_message(f"Failed to recall memories: {exc}")

