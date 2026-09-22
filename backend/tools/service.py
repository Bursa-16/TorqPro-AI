"""Business-logic service layer for the tools (Tool Tracking) domain.

Route handlers call this module; this module calls repository.py.
No SQL here. No circular imports with backend.app routes.

Design guards preserved from C2 plan:
- effective_status derived ONLY from capability_due_at expiry.
- No Cm/Cmk / Cp/Cpk threshold evaluation.
- No operational_status mutation on capability study creation.
- No expiry interval defaults.
- Capability studies are append-only.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from backend.tools import repository as repo
from backend.tools.exceptions import ToolValidationError
from backend.tools.schemas import CapabilityStudyCreate, ToolCreate, ToolPatch

_VALID_OP_STATUSES = {"OK", "KONTROL", "YETERSİZ"}

# ---------------------------------------------------------------------------
# Effective status helper
# ---------------------------------------------------------------------------

_EXPIRED_STATUS = "SÜRESİ DOLMUŞ"


def _parse_iso_utc(value: str) -> datetime | None:
    """Parse an ISO-8601 datetime string to a UTC-aware datetime.

    Returns None on any parse error so callers can safely fall back.
    Accepts trailing 'Z' (replaces with +00:00).
    """
    try:
        normalised = value.strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalised)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, AttributeError):
        return None


def _effective_status(tool: dict[str, Any]) -> str:
    """Compute the effective display status for a tool row.

    Rule:
      - If capability_due_at is explicitly stored AND parses as a valid
        datetime AND is in the past (< current UTC) → "SÜRESİ DOLMUŞ"
      - Otherwise → operational_status (as persisted)

    Malformed stored due dates do not crash; they fall through to
    operational_status.

    NOT derived from Cm/Cmk or any threshold value.
    """
    due_raw = tool.get("capability_due_at")
    if due_raw:
        due_dt = _parse_iso_utc(due_raw)
        if due_dt is not None and due_dt < datetime.now(timezone.utc):
            return _EXPIRED_STATUS
    return tool["operational_status"]


def _enrich(tool: dict[str, Any]) -> dict[str, Any]:
    """Attach effective_status to a tool dict in place and return it."""
    tool["effective_status"] = _effective_status(tool)
    return tool


# ---------------------------------------------------------------------------
# Tool CRUD
# ---------------------------------------------------------------------------

def create_tool(body: ToolCreate, created_by: int) -> dict[str, Any]:
    op_status = (body.operational_status or "OK").strip()
    if op_status not in _VALID_OP_STATUSES:
        raise ToolValidationError(
            f"operational_status geçersiz: {op_status!r}. "
            f"İzin verilenler: {sorted(_VALID_OP_STATUSES)}"
        )
    tool = repo.create_tool(
        registration_id=body.registration_id,
        model=body.model,
        operation=body.operation,
        nominal_torque_nm=body.nominal_torque_nm,
        tool_class=body.tool_class,
        operational_status=op_status,
        capability_due_at=body.capability_due_at,
        capability_interval_days=body.capability_interval_days,
        notes=body.notes,
        created_by=created_by,
    )
    return _enrich(tool)


def get_tool(tool_id: int, *, include_inactive: bool = False) -> dict[str, Any]:
    return _enrich(repo.get_tool(tool_id, include_inactive=include_inactive))


def list_tools(*, include_inactive: bool = False) -> dict[str, Any]:
    items = [_enrich(t) for t in repo.list_tools(include_inactive=include_inactive)]
    return {"items": items, "total": len(items)}


def update_tool(tool_id: int, body: ToolPatch, updated_by: int) -> dict[str, Any]:
    if (
        body.operational_status is not None
        and body.operational_status not in _VALID_OP_STATUSES
    ):
        raise ToolValidationError(
            f"operational_status geçersiz: {body.operational_status!r}"
        )

    # Build kwargs — only fields that were explicitly set in the patch body.
    # Use model_fields_set (Pydantic v2) to distinguish "not provided" from
    # "provided as None" for nullable fields.
    set_fields = body.model_fields_set

    kwargs: dict[str, Any] = {}
    if "model" in set_fields:
        kwargs["model"] = body.model
    if "operation" in set_fields:
        kwargs["operation"] = body.operation
    if "nominal_torque_nm" in set_fields:
        kwargs["nominal_torque_nm"] = body.nominal_torque_nm
    if "tool_class" in set_fields:
        kwargs["tool_class"] = body.tool_class
    if "operational_status" in set_fields:
        kwargs["operational_status"] = body.operational_status
    # Nullable fields use Ellipsis sentinel in repo.update_tool;
    # only pass them if explicitly included in the patch.
    if "capability_due_at" in set_fields:
        kwargs["capability_due_at"] = body.capability_due_at
    if "capability_interval_days" in set_fields:
        kwargs["capability_interval_days"] = body.capability_interval_days
    if "notes" in set_fields:
        kwargs["notes"] = body.notes

    tool = repo.update_tool(tool_id, updated_by=updated_by, **kwargs)
    return _enrich(tool)


def deactivate_tool(tool_id: int, updated_by: int) -> dict[str, Any]:
    tool = repo.deactivate_tool(tool_id, updated_by=updated_by)
    return _enrich(tool)


# ---------------------------------------------------------------------------
# Capability Studies
# ---------------------------------------------------------------------------

def create_capability_study(
    tool_id: int, body: CapabilityStudyCreate, created_by: int
) -> dict[str, Any]:
    return repo.create_capability_study(
        tool_id=tool_id,
        analysis_type=body.analysis_type,
        cm=body.cm,
        cmk=body.cmk,
        cp=body.cp,
        cpk=body.cpk,
        lsl=body.lsl,
        usl=body.usl,
        sample_count=body.sample_count,
        method=body.method,
        source=body.source,
        study_date=body.study_date,
        created_by=created_by,
    )


def list_capability_studies(tool_id: int) -> dict[str, Any]:
    items = repo.list_capability_studies(tool_id)
    return {"items": items, "total": len(items)}


def get_latest_capability_study(tool_id: int) -> dict[str, Any]:
    study = repo.get_latest_capability_study(tool_id)
    return {"study": study}


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def tools_summary() -> dict[str, Any]:
    """Return aggregate counts.

    expired_count uses ONLY explicit capability_due_at — never inferred
    from study_date or Cm/Cmk values.
    """
    all_tools = repo.list_tools(include_inactive=True)
    now = datetime.now(timezone.utc)

    total = len(all_tools)
    active = sum(1 for t in all_tools if t["is_active"])
    inactive = total - active

    by_op: dict[str, int] = {"OK": 0, "KONTROL": 0, "YETERSİZ": 0}
    expired_count = 0

    for t in all_tools:
        if not t["is_active"]:
            continue
        op = t.get("operational_status", "OK")
        if op in by_op:
            by_op[op] += 1

        due_raw = t.get("capability_due_at")
        if due_raw:
            due_dt = _parse_iso_utc(due_raw)
            if due_dt is not None and due_dt < now:
                expired_count += 1

    return {
        "total": total,
        "active": active,
        "inactive": inactive,
        "by_operational_status": by_op,
        "expired_count": expired_count,
    }
