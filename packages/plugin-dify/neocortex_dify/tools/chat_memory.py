import json
from typing import Any

from dify_plugin import Tool

from ._shared import get_base_url, parse_json, request_json


class ChatMemoryTool(Tool):
    """Chat with memory cache (POST /v1/memory/chat)."""

    def _invoke(self, tool_parameters: dict[str, Any]) -> dict[str, Any]:
        messages_json = tool_parameters.get("messages_json")
        temperature = tool_parameters.get("temperature")
        max_tokens = tool_parameters.get("max_tokens")

        token = (self.runtime.credentials or {}).get("alphahuman_api_key")
        if not token:
            return self.create_text_message("Error: missing alphahuman_api_key credential.")
        if not messages_json:
            return self.create_text_message("Error: messages_json is required.")

        messages = parse_json(messages_json, default=[])
        base_url = get_base_url(self.runtime.credentials)

        try:
            payload = request_json(
                token=token,
                base_url=base_url,
                method="POST",
                path="/v1/memory/chat",
                json_body={
                    "messages": messages,
                    "temperature": temperature,
                    "maxTokens": max_tokens,
                },
            )
            return self.create_text_message(json.dumps(payload, ensure_ascii=False))
        except Exception as exc:
            return self.create_text_message(f"Failed to chat memory: {exc}")

