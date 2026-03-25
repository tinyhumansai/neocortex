import json
from typing import Any

from dify_plugin import Tool

from ._shared import get_auth_and_namespace, get_base_url, parse_json, request_json


class RecordInteractionsTool(Tool):
    """Record interactions (POST /v1/memory/interactions)."""

    def _invoke(self, tool_parameters: dict[str, Any]) -> dict[str, Any]:
        namespace = tool_parameters.get("namespace")
        entity_names_json = tool_parameters.get("entity_names_json")
        description = tool_parameters.get("description")
        interaction_level = tool_parameters.get("interaction_level")
        interaction_levels_json = tool_parameters.get("interaction_levels_json")
        timestamp = tool_parameters.get("timestamp")

        token, ns = get_auth_and_namespace(self.runtime.credentials, {"namespace": namespace})
        if not token:
            return self.create_text_message("Error: missing alphahuman_api_key credential.")
        if not entity_names_json:
            return self.create_text_message("Error: entity_names_json is required.")

        entity_names = parse_json(entity_names_json, default=[])
        interaction_levels = parse_json(interaction_levels_json, default=None)
        base_url = get_base_url(self.runtime.credentials)

        try:
            body = {
                "namespace": ns,
                "entityNames": entity_names,
                "description": description,
                "interactionLevel": interaction_level,
                "interactionLevels": interaction_levels,
                "timestamp": timestamp,
            }
            payload = request_json(
                token=token,
                base_url=base_url,
                method="POST",
                path="/v1/memory/interactions",
                json_body={k: v for k, v in body.items() if v is not None},
            )
            return self.create_text_message(json.dumps(payload, ensure_ascii=False))
        except Exception as exc:
            return self.create_text_message(f"Failed to record interactions: {exc}")

