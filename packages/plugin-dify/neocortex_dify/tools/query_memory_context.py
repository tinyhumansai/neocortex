import json
from typing import Any

from dify_plugin import Tool

from ._shared import get_auth_and_namespace, get_base_url, parse_json, request_json


class QueryMemoryContextTool(Tool):
    """Query memory context (POST /v1/memory/queries)."""

    def _invoke(self, tool_parameters: dict[str, Any]) -> dict[str, Any]:
        query = tool_parameters.get("query")
        namespace = tool_parameters.get("namespace")
        include_references = tool_parameters.get("include_references")
        max_chunks = tool_parameters.get("max_chunks")
        document_ids_json = tool_parameters.get("document_ids_json")
        recall_only = tool_parameters.get("recall_only")
        llm_query = tool_parameters.get("llm_query")

        token, ns = get_auth_and_namespace(self.runtime.credentials, {"namespace": namespace})
        if not token:
            return self.create_text_message("Error: missing alphahuman_api_key credential.")
        if not query:
            return self.create_text_message("Error: query is required.")

        document_ids = parse_json(document_ids_json, default=None)
        base_url = get_base_url(self.runtime.credentials)

        try:
            payload = request_json(
                token=token,
                base_url=base_url,
                method="POST",
                path="/v1/memory/queries",
                json_body={
                    "query": query,
                    "namespace": ns,
                    "includeReferences": include_references,
                    "maxChunks": max_chunks,
                    "documentIds": document_ids,
                    "recallOnly": recall_only,
                    "llmQuery": llm_query,
                },
            )
            return self.create_text_message(json.dumps(payload, ensure_ascii=False))
        except Exception as exc:
            return self.create_text_message(f"Failed to query memory context: {exc}")

