import json
from typing import Any

from dify_plugin import Tool

from ._shared import get_auth_and_namespace, get_base_url, parse_json, request_json


class SyncMemoryTool(Tool):
    """Sync memory files (POST /v1/memory/sync)."""

    def _invoke(self, tool_parameters: dict[str, Any]) -> dict[str, Any]:
        workspace_id = tool_parameters.get("workspace_id")
        agent_id = tool_parameters.get("agent_id")
        files_json = tool_parameters.get("files_json")
        source = tool_parameters.get("source")

        token, _ns = get_auth_and_namespace(self.runtime.credentials, tool_parameters)
        if not token:
            return self.create_text_message("Error: missing alphahuman_api_key credential.")
        if not workspace_id or not agent_id or files_json is None:
            return self.create_text_message("Error: workspace_id, agent_id, and files_json are required.")

        files = parse_json(files_json, default=[])
        base_url = get_base_url(self.runtime.credentials)

        try:
            payload = request_json(
                token=token,
                base_url=base_url,
                method="POST",
                path="/v1/memory/sync",
                json_body={
                    "workspaceId": workspace_id,
                    "agentId": agent_id,
                    "source": source,
                    "files": files,
                },
            )
            return self.create_text_message(json.dumps(payload, ensure_ascii=False))
        except Exception as exc:
            return self.create_text_message(f"Failed to sync memory: {exc}")

