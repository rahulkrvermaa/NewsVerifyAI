import time
from typing import Any, Dict, List

from openai import (
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
    NotFoundError,
    OpenAI,
    RateLimitError,
)

from config import get_settings

GEMINI_FALLBACK_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-flash-latest",
]


class LLMServiceError(Exception):
    """Raised when LLM calls fail after retries and fallbacks."""


def create_json_completion(
    messages: List[Dict[str, str]],
    *,
    temperature: float = 0.1,
    timeout: float = 45.0,
) -> str:
    """
    Execute a structured JSON chat completion with exponential-backoff retries
    on transient 429/503/network errors and automatic Gemini model fallback.
    """
    settings = get_settings()
    if not settings.llm_configured:
        raise LLMServiceError(
            "LLM_API_KEY is not configured. Add LLM_API_KEY to your .env file."
        )

    client = OpenAI(
        api_key=settings.LLM_API_KEY,
        base_url=settings.LLM_BASE_URL,
        timeout=timeout,
        max_retries=1,
    )

    candidate_models = [settings.LLM_MODEL]
    if "generativelanguage.googleapis.com" in settings.LLM_BASE_URL:
        for m in GEMINI_FALLBACK_MODELS:
            if m not in candidate_models:
                candidate_models.append(m)

    last_exc: Exception | None = None
    for model_name in candidate_models:
        for attempt in range(2):
            try:
                resp = client.chat.completions.create(
                    model=model_name,
                    temperature=temperature,
                    response_format={"type": "json_object"},
                    messages=messages,  # type: ignore[arg-type]
                )
                return resp.choices[0].message.content or "{}"
            except (RateLimitError, InternalServerError, APITimeoutError, APIConnectionError) as exc:
                last_exc = exc
                if attempt == 0:
                    time.sleep(1.5)
                    continue
                # Move to next fallback model
                break
            except NotFoundError as exc:
                last_exc = exc
                # Model unavailable; try next fallback
                break

    raise LLMServiceError(
        f"LLM service unavailable after retries and fallback models ({type(last_exc).__name__}: {last_exc})."
    ) from last_exc
