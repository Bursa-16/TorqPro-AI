"""Domain exceptions for the tools (Tool Tracking) module."""
from __future__ import annotations


class ToolError(Exception):
    """Base class for all tool-tracking domain errors."""


class ToolNotFoundError(ToolError):
    pass


class ToolConflictError(ToolError):
    """Uniqueness conflict — e.g. duplicate registration_id."""


class ToolValidationError(ToolError):
    """Input fails a data-integrity rule."""
