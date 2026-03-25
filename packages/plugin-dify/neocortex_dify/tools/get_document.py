import json
from typing import Any

from dify_plugin import Tool

from ._shared import get_base_url, request_json


class GetDocumentTool(Tool):
    """Get a single document (GET /v1/memory/documents/:documentId)."""

    def _invoke(self, tool_parameters: dict[str, Any]) -> dict[str, Any]:
        document_id = tool_parameters.get("document_id")
        namespace = tool_parameters.get("namespace")

        token = (self.runtime.credentials or {}).get("alphahuman_api_key")
        if not token:
            return self.create_text_message("Error: missing alphahuman_api_key credential.")
        if not document_id:
            return self.create_text_message("Error: document_id is required.")

        base_url = get_base_url(self.runtime.credentials)
        try:
            payload = request_json(
                token=token,
                base_url=base_url,
                method="GET",
                path=f"/v1/memory/documents/{document_id}",
                query_params={"namespace": namespace},
            )
            return self.create_text_message(json.dumps(payload, ensure_ascii=False))
        except Exception as exc:
            return self.create_text_message(f"Failed to get document: {exc}")

