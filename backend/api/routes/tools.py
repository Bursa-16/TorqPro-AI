"""Tool Tracking API — read + write (VISUAL-02C-C2.3 / C2.4).

Thin FastAPI routes. All business logic lives in backend.tools.service;
SQL lives in backend.tools.repository.

Read endpoints (C2.3):
  GET  /api/tools
  GET  /api/tools/summary
  GET  /api/tools/{tool_id}
  GET  /api/tools/{tool_id}/capability-studies
  GET  /api/tools/{tool_id}/capability-studies/latest

Write endpoints (C2.4):
  POST   /api/tools
  PATCH  /api/tools/{tool_id}
  DELETE /api/tools/{tool_id}   (soft-deactivate; admin only)
  POST   /api/tools/{tool_id}/capability-studies
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

router = APIRouter(tags=["tools"])

# Deferred imports after `router` assignment to break the circular-import
# chain that would occur if backend.app re-enters this module mid-import
# (same pattern as production_validation.py, governance, joints, etc.).
from backend.api.dependencies import user
from backend.app import audit
from backend.tools import service as svc
from backend.tools.exceptions import (
    ToolConflictError,
    ToolNotFoundError,
    ToolValidationError,
)
from backend.tools.schemas import (
    CapabilityStudyCreate,
    ToolCreate,
    ToolPatch,
)


def _handle(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ToolNotFoundError as exc:
        raise HTTPException(404, str(exc))
    except ToolConflictError as exc:
        raise HTTPException(409, str(exc))
    except ToolValidationError as exc:
        raise HTTPException(400, str(exc))


def _require_engineer_or_admin(u: dict) -> None:
    if u["role"] == "viewer":
        raise HTTPException(403, "Viewer rolü bu işlemi yapamaz")


def _require_admin(u: dict) -> None:
    if u["role"] != "admin":
        raise HTTPException(403, "Bu işlem yalnızca admin rolüne açıktır")


# ---------------------------------------------------------------------------
# IMPORTANT: /summary must be declared BEFORE /{tool_id} so FastAPI does not
# capture the literal string "summary" as a tool_id path parameter.
# Similarly, /capability-studies/latest is declared before /capability-studies.
# ---------------------------------------------------------------------------

@router.get("/api/tools/summary")
def get_tools_summary(u=Depends(user)):  # noqa: B008
    return svc.tools_summary()


@router.get("/api/tools")
def list_tools(include_inactive: bool = False, u=Depends(user)):  # noqa: B008
    return svc.list_tools(include_inactive=include_inactive)


@router.post("/api/tools", status_code=201)
def create_tool(body: ToolCreate, u=Depends(user)):  # noqa: B008
    _require_engineer_or_admin(u)
    result = _handle(svc.create_tool, body, u["id"])
    audit(u["id"], "tool.create", result["registration_id"])
    return result


@router.get("/api/tools/{tool_id}")
def get_tool(tool_id: int, u=Depends(user)):  # noqa: B008
    return _handle(svc.get_tool, tool_id)


@router.patch("/api/tools/{tool_id}")
def update_tool(tool_id: int, body: ToolPatch, u=Depends(user)):  # noqa: B008
    _require_engineer_or_admin(u)
    result = _handle(svc.update_tool, tool_id, body, u["id"])
    audit(u["id"], "tool.update", str(tool_id))
    return result


@router.delete("/api/tools/{tool_id}")
def deactivate_tool(tool_id: int, u=Depends(user)):  # noqa: B008
    _require_admin(u)
    result = _handle(svc.deactivate_tool, tool_id, u["id"])
    audit(u["id"], "tool.deactivate", str(tool_id))
    return result


@router.get("/api/tools/{tool_id}/capability-studies/latest")
def get_latest_capability_study(tool_id: int, u=Depends(user)):  # noqa: B008
    return _handle(svc.get_latest_capability_study, tool_id)


@router.get("/api/tools/{tool_id}/capability-studies")
def list_capability_studies(tool_id: int, u=Depends(user)):  # noqa: B008
    return _handle(svc.list_capability_studies, tool_id)


@router.post("/api/tools/{tool_id}/capability-studies", status_code=201)
def create_capability_study(
    tool_id: int, body: CapabilityStudyCreate, u=Depends(user)  # noqa: B008
):
    _require_engineer_or_admin(u)
    result = _handle(svc.create_capability_study, tool_id, body, u["id"])
    audit(u["id"], "tool.capability_study.create", str(tool_id))
    return result
