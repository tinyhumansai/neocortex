import json
from typing import Any

from dify_plugin import Tool

from ._shared import get_auth_and_namespace, get_base_url, parse_json, request_json


class InsertDocumentTool(Tool):
    """Insert one document (POST /v1/memory/documents)."""

    def _invoke(self, tool_parameters: dict[str, Any]) -> dict[str, Any]:
        title = tool_parameters.get("title")
        content = tool_parameters.get("content")
        namespace = tool_parameters.get("namespace")
        document_id = tool_parameters.get("document_id")
        source_type = tool_parameters.get("source_type") or "doc"
        metadata_json = tool_parameters.get("metadata_json")
        priority = tool_parameters.get("priority")
        created_at = tool_parameters.get("created_at")
        updated_at = tool_parameters.get("updated_at")

        token, ns = get_auth_and_namespace(self.runtime.credentials, {"namespace": namespace})
        if not token:
            return self.create_text_message("Error: missing alphahuman_api_key credential.")
        if not title or not content or not ns or not document_id:
            return self.create_text_message("Error: title, content, namespace, and document_id are required.")

        metadata = parse_json(metadata_json, default={})
        base_url = get_base_url(self.runtime.credentials)

        try:
            payload = request_json(
                token=token,
                base_url=base_url,
                method="POST",
                path="/v1/memory/documents",
                json_body={
                    "title": title,
                    "content": content,
                    "namespace": ns,
                    "sourceType": source_type,
                    "metadata": metadata,
                    "priority": priority,
                    "createdAt": created_at,
                    "updatedAt": updated_at,
                    "document_id": document_id,
                },
            )
            return self.create_text_message(json.dumps(payload, ensure_ascii=False))
        except Exception as exc:
            return self.create_text_message(f"Failed to insert document: {exc}")

