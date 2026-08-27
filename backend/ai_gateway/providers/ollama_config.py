"""TorqPro AI Gateway - Ollama local provider configuration (AI-P2L).

Server-side-only configuration for the Ollama Chat API adapter.  All
values come from environment variables; none are accepted from request
parameters, frontend input, or any user-controlled source.

Numeric constants (default timeout, default base URL port) are defined
in the route module (``backend.api.routes.ai_gateway``) rather than
here because the AST-based safety test
``test_no_engineering_numeric_literal_anywhere_in_ai_gateway`` prohibits
non-trivial integer/float literals anywhere under ``backend/ai_gateway/``.
The ``default_timeout_seconds`` and ``default_base_url`` values are
therefore passed in from the route module as arguments to
:func:`load_from_env`.

To enable the Ollama provider, set the following environment variables::

    TORQPRO_OLLAMA_ENABLED=true
    TORQPRO_OLLAMA_BASE_URL=http://127.0.0.1:11434   # optional, this is the default
    TORQPRO_OLLAMA_MODEL=qwen3:8b                    # configurable, no hard-coded default
    TORQPRO_OLLAMA_TIMEOUT_SECONDS=120               # optional, local inference can be slow

No API key is required for normal local Ollama usage.

Privacy / cost rules:
- No secret is stored or transmitted -- Ollama is purely local HTTP.
- An Ollama failure NEVER silently falls over to the Anthropic provider
  (which would create unexpected cloud cost / data transfer).
  PAID_CLOUD_AUTO_FALLBACK = NO.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

_ENV_ENABLED    = "TORQPRO_OLLAMA_ENABLED"
_ENV_BASE_URL   = "TORQPRO_OLLAMA_BASE_URL"
_ENV_MODEL      = "TORQPRO_OLLAMA_MODEL"
_ENV_TIMEOUT    = "TORQPRO_OLLAMA_TIMEOUT_SECONDS"
_ENV_KEEP_ALIVE = "TORQPRO_OLLAMA_KEEP_ALIVE"


@dataclass(frozen=True)
class OllamaProviderConfig:
    """Immutable, server-side-only configuration for the Ollama adapter.

    Never instantiated from request input.  The route module constructs
    exactly one instance at startup via :func:`load_from_env`.

    Attributes:
        enabled:         ``True`` iff the adapter should be registered.
        base_url:        Ollama server base URL (scheme + host + port).
        model:           Ollama model tag to request (e.g. ``"qwen3:8b"``).
        timeout_seconds: Per-request HTTP timeout in seconds.
    """

    enabled: bool
    base_url: str
    model: str
    timeout_seconds: float
    keep_alive: str

    def is_enabled(self) -> bool:
        """Return ``True`` iff the adapter is both enabled and has a
        non-empty base URL and model tag."""
        return self.enabled and bool(self.base_url.strip()) and bool(self.model.strip())


def load_from_env(
    *,
    default_timeout_seconds: float,
    default_base_url: str,
    default_model: str,
    default_keep_alive: str,
) -> OllamaProviderConfig:
    """Read Ollama provider configuration from environment variables.

    ``default_timeout_seconds``, ``default_base_url``, ``default_model``,
    and ``default_keep_alive`` are supplied by the caller (the route module)
    so that no numeric/string literal lives inside ``backend/ai_gateway/``
    (AST guard constraint).

    Never raises: missing or malformed env vars always fall back to the
    supplied default or ``enabled=False``.
    """
    enabled_raw = os.getenv(_ENV_ENABLED, "").strip().lower()
    enabled = enabled_raw in ("1", "true", "yes")

    base_url = os.getenv(_ENV_BASE_URL, "").strip() or default_base_url

    model = os.getenv(_ENV_MODEL, "").strip() or default_model

    timeout_raw = os.getenv(_ENV_TIMEOUT, "").strip()
    try:
        timeout_seconds = float(timeout_raw) if timeout_raw else default_timeout_seconds
    except ValueError:
        timeout_seconds = default_timeout_seconds

    keep_alive = os.getenv(_ENV_KEEP_ALIVE, "").strip() or default_keep_alive

    return OllamaProviderConfig(
        enabled=enabled,
        base_url=base_url,
        model=model,
        timeout_seconds=timeout_seconds,
        keep_alive=keep_alive,
    )


__all__ = ["OllamaProviderConfig", "load_from_env"]
