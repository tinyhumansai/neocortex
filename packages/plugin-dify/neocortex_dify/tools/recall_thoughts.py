import json
from typing import Any

from dify_plugin import Tool

from ._shared import get_auth_and_namespace, get_base_url, request_json


class RecallThoughtsTool(Tool):
    """Generate reflective thoughts (POST /v1/memory/memories/thoughts)."""

    def _invoke(self, tool_parameters: dict[str, Any]) -> dict[str, Any]:
        namespace = tool_parameters.get("namespace")
        max_chunks = tool_parameters.get("max_chunks")
        temperature = tool_parameters.get("temperature")
        randomness_seed = tool_parameters.get("randomness_seed")
        persist = tool_parameters.get("persist")
        enable_prediction_check = tool_parameters.get("enable_prediction_check")
        thought_prompt = tool_parameters.get("thought_prompt")

        token, ns = get_auth_and_namespace(self.runtime.credentials, {"namespace": namespace})
        if not token:
            return self.create_text_message("Error: missing alphahuman_api_key credential.")

        base_url = get_base_url(self.runtime.credentials)
        try:
            payload = request_json(
                token=token,
                base_url=base_url,
                method="POST",
                path="/v1/memory/memories/thoughts",
                json_body={
                    "namespace": ns,
                    "maxChunks": max_chunks,
                    "temperature": temperature,
                    "randomnessSeed": randomness_seed,
                    "persist": persist,
                    "enablePredictionCheck": enable_prediction_check,
                    "thoughtPrompt": thought_prompt,
                },
            )
            return self.create_text_message(json.dumps(payload, ensure_ascii=False))
        except Exception as exc:
            return self.create_text_message(f"Failed to recall thoughts: {exc}")

