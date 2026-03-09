"""Optional LLM query functionality for third-party providers."""

from __future__ import annotations
from .types import LLMQueryResponse, TinyHumanError
from typing import Any, Optional
import httpx

SUPPORTED_LLM_PROVIDERS = ("openai", "anthropic", "google")


def recall_with_llm(
    *,
    prompt: str,
    provider: str,
    model: str,
    api_key: str,
    context: str = "",
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
    url: Optional[str] = None,
) -> LLMQueryResponse:
    """Optional: run a prompt through a supported LLM with optional context.

    Uses the provider's REST API (no extra SDK deps). Requires a separate
    API key from the LLM provider.

    Supported built-in providers: ``openai``, ``anthropic``, ``google`` (Gemini).
    For custom providers, pass ``url`` to use an OpenAI-compatible API endpoint.

    Args:
        prompt: User prompt to send.
        provider: Provider name. For built-in: "openai", "anthropic", "google".
            For custom: any name (ignored if url is provided).
        model: Model name (e.g. "gpt-4o-mini", "claude-3-5-sonnet-20241022", "gemini-1.5-flash").
        api_key: Provider API key (not the TinyHumans token).
        context: Optional context string (e.g. from recall_memory().context) injected as system/context.
        max_tokens: Optional max tokens to generate.
        temperature: Optional sampling temperature.
        url: Optional custom API endpoint URL. If provided, uses OpenAI-compatible format
            (POST with JSON body: {"model": ..., "messages": [{"role": "system/user", "content": ...}]}).
            Response expected: {"choices": [{"message": {"content": "..."}}]}.

    Returns:
        LLMQueryResponse with the model reply text.

    Raises:
        ValueError: If provider is unsupported (when url not provided) or api_key missing.
        TinyHumanError: On provider API errors.
    """
    if not api_key or not api_key.strip():
        raise ValueError("api_key is required for recall_with_llm")
    api_key = api_key.strip()

    if url:
        # Custom provider: use OpenAI-compatible format
        text = _query_custom(
            url=url,
            prompt=prompt,
            model=model,
            api_key=api_key,
            context=context,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    else:
        # Built-in provider
        provider = provider.strip().lower()
        if provider not in SUPPORTED_LLM_PROVIDERS:
            raise ValueError(
                f"provider must be one of {SUPPORTED_LLM_PROVIDERS}, got {provider!r}. "
                "For custom providers, pass the 'url' parameter."
            )
        text = _query_llm(
            prompt=prompt,
            provider=provider,
            model=model,
            api_key=api_key,
            context=context,
            max_tokens=max_tokens,
            temperature=temperature,
        )
    return LLMQueryResponse(text=text)


def _query_llm(
    *,
    prompt: str,
    provider: str,
    model: str,
    api_key: str,
    context: str = "",
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> str:
    with httpx.Client(timeout=60) as http:
        if provider == "openai":
            return _query_openai(
                http,
                prompt=prompt,
                model=model,
                api_key=api_key,
                context=context,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        if provider == "anthropic":
            return _query_anthropic(
                http,
                prompt=prompt,
                model=model,
                api_key=api_key,
                context=context,
                max_tokens=max_tokens,
                temperature=temperature,
            )
        if provider == "google":
            return _query_google(
                http,
                prompt=prompt,
                model=model,
                api_key=api_key,
                context=context,
                max_tokens=max_tokens,
                temperature=temperature,
            )
    raise ValueError(f"Unsupported provider: {provider}")


def _query_openai(
    http: httpx.Client,
    *,
    prompt: str,
    model: str,
    api_key: str,
    context: str = "",
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> str:
    messages: list[dict[str, str]] = []
    if context:
        messages.append({"role": "system", "content": context})
    messages.append({"role": "user", "content": prompt})
    body: dict[str, Any] = {"model": model, "messages": messages}
    if max_tokens is not None:
        body["max_tokens"] = max_tokens
    if temperature is not None:
        body["temperature"] = temperature
    r = http.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=body,
    )
    _raise_llm_error(r, "OpenAI")
    data = r.json()
    return data["choices"][0]["message"]["content"]


def _query_anthropic(
    http: httpx.Client,
    *,
    prompt: str,
    model: str,
    api_key: str,
    context: str = "",
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> str:
    body: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens if max_tokens is not None else 1024,
        "messages": [{"role": "user", "content": prompt}],
    }
    if context:
        body["system"] = context
    if temperature is not None:
        body["temperature"] = temperature
    r = http.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json=body,
    )
    _raise_llm_error(r, "Anthropic")
    data = r.json()
    return data["content"][0]["text"]


def _query_google(
    http: httpx.Client,
    *,
    prompt: str,
    model: str,
    api_key: str,
    context: str = "",
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> str:
    parts: list[dict[str, str]] = [{"text": prompt}]
    if context:
        parts = [{"text": f"Context:\n{context}\n\nUser: {prompt}"}]
    body: dict[str, Any] = {"contents": [{"parts": parts}]}
    if max_tokens is not None or temperature is not None:
        body["generationConfig"] = {}
        if max_tokens is not None:
            body["generationConfig"]["maxOutputTokens"] = max_tokens
        if temperature is not None:
            body["generationConfig"]["temperature"] = temperature
    r = http.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}",
        headers={"Content-Type": "application/json"},
        json=body,
    )
    _raise_llm_error(r, "Google")
    data = r.json()
    return data["candidates"][0]["content"]["parts"][0]["text"]


def _query_custom(
    *,
    url: str,
    prompt: str,
    model: str,
    api_key: str,
    context: str = "",
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> str:
    """Query a custom provider using OpenAI-compatible format."""
    messages: list[dict[str, str]] = []
    if context:
        messages.append({"role": "system", "content": context})
    messages.append({"role": "user", "content": prompt})
    body: dict[str, Any] = {"model": model, "messages": messages}
    if max_tokens is not None:
        body["max_tokens"] = max_tokens
    if temperature is not None:
        body["temperature"] = temperature

    with httpx.Client(timeout=60) as http:
        r = http.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        _raise_llm_error(r, "Custom provider")
        data = r.json()
        # OpenAI-compatible response format
        return data["choices"][0]["message"]["content"]


def _raise_llm_error(response: httpx.Response, provider: str) -> None:
    if response.is_success:
        return
    try:
        payload = response.json()
        err = payload.get("error", {})
        msg = err.get("message", payload.get("message", response.text))
    except Exception:
        msg = response.text
    raise TinyHumanError(f"{provider} API error: {msg}", response.status_code, None)
