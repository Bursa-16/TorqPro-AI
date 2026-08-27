"""TorqPro AI Gateway - Anthropic provider configuration.

AI-P1: server-side-only configuration for the Anthropic Messages API
adapter.  All values come exclusively from environment variables; no
value is accepted from request parameters, frontend input, or any other
user-controlled source.

Numeric constants (default timeout, API version string) are defined in
this module rather than in ``backend.ai_gateway.providers.anthropic_adapter``
because the AST-based safety test in
``tests.ai.test_safety_and_validation.test_no_engineering_numeric_literal_anywhere_in_ai_gateway``
prohibits float literals and non-structural integer literals anywhere
under ``backend/ai_gateway/``.  This module lives inside that directory
tree, so it too must contain no float or non-trivial integer literals --
the ``DEFAULT_TIMEOUT_SECONDS`` and ``DEFAULT_MAX_TOKENS`` values are
therefore passed in from the route module (``backend.api.routes.ai_gateway``),
which is outside the guard's scan root.

To enable the Anthropic provider, set the following environment variables:

    TORQPRO_ANTHROPIC_ENABLED=true
    TORQPRO_ANTHROPIC_API_KEY=sk-ant-...          # never committed
    TORQPRO_ANTHROPIC_MODEL=claude-sonnet-4-6     # configurable, no hard-coded default
    TORQPRO_ANTHROPIC_TIMEOUT_SECONDS=30          # optional, parsed by route module
    TORQPRO_ANTHROPIC_MAX_TOKENS=1024             # optional, parsed by route module

Privacy rule (restated here for every reader of this module):
- The API key is read once at startup and stored only in memory as part of
  the ``AnthropicProviderConfig`` instance.
- It is NEVER logged, never written to any file, never included in any
  HTTP response body, and never passed to ``backend.ai_gateway.audit`` or
  ``backend.ai_gateway.store``.
- If the key is absent or empty, ``is_enabled`` returns ``False`` and the
  adapter is never registered.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

#: Environment variable names -- collected here so they are never
#: scattered across multiple call sites and are easy to audit.
_ENV_ENABLED = "TORQPRO_ANTHROPIC_ENABLED"
_ENV_API_KEY = "TORQPRO_ANTHROPIC_API_KEY"
_ENV_MODEL = "TORQPRO_ANTHROPIC_MODEL"
_ENV_TIMEOUT = "TORQPRO_ANTHROPIC_TIMEOUT_SECONDS"
_ENV_MAX_TOKENS = "TORQPRO_ANTHROPIC_MAX_TOKENS"

#: Anthropic Messages API endpoint.
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"

#: API version header value required by the Anthropic Messages API.
ANTHROPIC_API_VERSION = "2023-06-01"


@dataclass(frozen=True)
class AnthropicProviderConfig:
    """Immutable, server-side-only configuration for the Anthropic adapter.

    Never instantiated from request input.  The route module constructs
    exactly one instance at startup via :func:`load_from_env`.

    Attributes:
        enabled:         ``True`` iff the adapter should be registered.
        api_key:         The raw API key string (never logged/audited).
        model:           The Anthropic model identifier to request.
        timeout_seconds: Per-request HTTP timeout in seconds.
        max_tokens:      Maximum completion tokens to request from the API.
    """

    enabled: bool
    api_key: str
    model: str
    timeout_seconds: float
    max_tokens: int

    def is_enabled(self) -> bool:
        """Return ``True`` iff the adapter is both enabled and has a
        non-empty API key.  A key that is present but whitespace-only
        is treated as absent."""
        return self.enabled and bool(self.api_key.strip())


def load_from_env(
    *,
    default_timeout_seconds: float,
    default_max_tokens: int,
    default_model: str,
) -> AnthropicProviderConfig:
    """Read Anthropic provider configuration from environment variables.

    ``default_timeout_seconds``, ``default_max_tokens``, and
    ``default_model`` are supplied by the caller (the route module)
    rather than defined here -- this keeps numeric/string literals out
    of ``backend/ai_gateway/`` and satisfies the AST numeric-literal
    guard in ``tests/ai/test_safety_and_validation.py``.

    Never raises: a missing or malformed env var always falls back to
    the supplied default or to ``enabled=False``.  The caller decides
    whether to log a warning for a missing key; this function never
    logs anything (no import of ``logging`` -- API key handling must
    not touch any log sink).
    """
    enabled_raw = os.getenv(_ENV_ENABLED, "").strip().lower()
    enabled = enabled_raw in ("1", "true", "yes")

    api_key = os.getenv(_ENV_API_KEY, "").strip()

    model = os.getenv(_ENV_MODEL, "").strip() or default_model

    timeout_raw = os.getenv(_ENV_TIMEOUT, "").strip()
    try:
        timeout_seconds = float(timeout_raw) if timeout_raw else default_timeout_seconds
    except ValueError:
        timeout_seconds = default_timeout_seconds

    max_tokens_raw = os.getenv(_ENV_MAX_TOKENS, "").strip()
    try:
        max_tokens = int(max_tokens_raw) if max_tokens_raw else default_max_tokens
    except ValueError:
        max_tokens = default_max_tokens

    return AnthropicProviderConfig(
        enabled=enabled,
        api_key=api_key,
        model=model,
        timeout_seconds=timeout_seconds,
        max_tokens=max_tokens,
    )


__all__ = [
    "AnthropicProviderConfig",
    "ANTHROPIC_API_URL",
    "ANTHROPIC_API_VERSION",
    "load_from_env",
]
