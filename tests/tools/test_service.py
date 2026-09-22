"""Service-layer unit tests for the tools (Tool Tracking) domain — C2.2 / C2.5.

Tests exercise backend.tools.service directly (no HTTP layer).
The shared conftest.py sets TORQPRO_DB_PATH to a temp file,
calls migrate() (which includes the tools tables), and seeds
the demo admin user (demo / A1234).
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

import backend.tools.service as svc
from backend.tools.exceptions import (
    ToolConflictError,
    ToolNotFoundError,
    ToolValidationError,
)
from backend.tools.schemas import CapabilityStudyCreate, ToolCreate, ToolPatch

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_SVC_COUNTER = [0]


def _next_reg():
    _SVC_COUNTER[0] += 1
    return f"SVC-{_SVC_COUNTER[0]:04d}"


def _create(**overrides):
    defaults = {
        "registration_id": _next_reg(),
        "model": "Bosch GSR 18V",
        "operation": "M10 Sıkma",
        "nominal_torque_nm": 25.0,
        "tool_class": "A",
    }
    defaults.update(overrides)
    return svc.create_tool(ToolCreate(**defaults), created_by=1)


def _study(tool_id, **overrides):
    defaults = {
        "analysis_type": "Cm/Cmk",
        "cm": 1.8,
        "cmk": 1.65,
        "study_date": "2026-09-01T08:00:00Z",
    }
    defaults.update(overrides)
    return svc.create_capability_study(tool_id, CapabilityStudyCreate(**defaults), created_by=1)


# ===========================================================================
# create_tool
# ===========================================================================

def test_create_tool_returns_enriched_dict():
    t = _create()
    assert "id" in t
    assert "registration_id" in t
    assert "effective_status" in t
    assert "latest_study" in t
    assert t["is_active"] in (True, 1)


def test_create_tool_default_status_ok():
    t = _create()
    assert t["operational_status"] == "OK"
    assert t["effective_status"] == "OK"


def test_create_tool_custom_status():
    t = _create(operational_status="KONTROL")
    assert t["operational_status"] == "KONTROL"


def test_create_tool_invalid_status_raises():
    with pytest.raises(ToolValidationError):
        _create(operational_status="GEÇERSIZ")


def test_create_tool_duplicate_raises_conflict():
    reg = _next_reg()
    _create(registration_id=reg)
    with pytest.raises(ToolConflictError):
        _create(registration_id=reg)


def test_create_tool_zero_torque_raises():
    with pytest.raises(ValidationError):
        _create(nominal_torque_nm=0)


def test_create_tool_negative_torque_raises():
    with pytest.raises(ValidationError):
        _create(nominal_torque_nm=-5.0)


# ===========================================================================
# get_tool
# ===========================================================================

def test_get_tool_returns_correct_id():
    t = _create()
    fetched = svc.get_tool(t["id"])
    assert fetched["id"] == t["id"]
    assert fetched["registration_id"] == t["registration_id"]


def test_get_tool_not_found_raises():
    with pytest.raises(ToolNotFoundError):
        svc.get_tool(9999999)


def test_get_tool_inactive_raises_by_default():
    t = _create()
    svc.deactivate_tool(t["id"], updated_by=1)
    with pytest.raises(ToolNotFoundError):
        svc.get_tool(t["id"])


def test_get_tool_inactive_visible_with_flag():
    t = _create()
    svc.deactivate_tool(t["id"], updated_by=1)
    fetched = svc.get_tool(t["id"], include_inactive=True)
    assert fetched["is_active"] in (False, 0)


# ===========================================================================
# list_tools
# ===========================================================================

def test_list_tools_returns_dict_with_items():
    _create()
    result = svc.list_tools()
    assert "items" in result
    assert "total" in result
    assert result["total"] == len(result["items"])


def test_list_tools_excludes_inactive_by_default():
    t = _create()
    svc.deactivate_tool(t["id"], updated_by=1)
    result = svc.list_tools()
    ids = {item["id"] for item in result["items"]}
    assert t["id"] not in ids


def test_list_tools_includes_inactive_with_flag():
    t = _create()
    svc.deactivate_tool(t["id"], updated_by=1)
    result = svc.list_tools(include_inactive=True)
    ids = {item["id"] for item in result["items"]}
    assert t["id"] in ids


# ===========================================================================
# update_tool
# ===========================================================================

def test_update_tool_partial_update():
    t = _create(operation="Eski Operasyon")
    updated = svc.update_tool(t["id"], ToolPatch(model="Yeni Model"), updated_by=1)
    assert updated["model"] == "Yeni Model"
    assert updated["operation"] == "Eski Operasyon"


def test_update_tool_not_found_raises():
    with pytest.raises(ToolNotFoundError):
        svc.update_tool(9999999, ToolPatch(model="X"), updated_by=1)


def test_update_tool_invalid_status_raises():
    t = _create()
    with pytest.raises(ToolValidationError):
        svc.update_tool(t["id"], ToolPatch(operational_status="BOGUS"), updated_by=1)


# ===========================================================================
# deactivate_tool
# ===========================================================================

def test_deactivate_tool_sets_inactive():
    t = _create()
    result = svc.deactivate_tool(t["id"], updated_by=1)
    assert result["is_active"] in (False, 0)


def test_deactivate_preserves_row():
    t = _create()
    svc.deactivate_tool(t["id"], updated_by=1)
    still_there = svc.get_tool(t["id"], include_inactive=True)
    assert still_there["registration_id"] == t["registration_id"]


# ===========================================================================
# effective_status (via service layer)
# ===========================================================================

def test_effective_status_no_due_date():
    t = _create(operational_status="OK")
    assert t["effective_status"] == "OK"


def test_effective_status_past_due_date():
    t = _create(capability_due_at="2000-01-01T00:00:00Z", operational_status="OK")
    assert t["effective_status"] == "SÜRESİ DOLMUŞ"


def test_effective_status_malformed_due_date_safe():
    t = _create(capability_due_at="not-a-date", operational_status="OK")
    assert t["effective_status"] == "OK"


# ===========================================================================
# capability studies
# ===========================================================================

def test_create_capability_study_appends():
    t = _create()
    s1 = _study(t["id"], study_date="2026-01-01T00:00:00Z")
    s2 = _study(t["id"], study_date="2026-09-01T00:00:00Z")
    result = svc.list_capability_studies(t["id"])
    assert result["total"] == 2
    ids = {s["id"] for s in result["items"]}
    assert s1["id"] in ids
    assert s2["id"] in ids


def test_create_study_does_not_change_operational_status():
    t = _create(operational_status="KONTROL")
    _study(t["id"])
    refreshed = svc.get_tool(t["id"])
    assert refreshed["operational_status"] == "KONTROL"


def test_create_study_does_not_set_capability_due_at():
    t = _create()
    assert t["capability_due_at"] is None
    _study(t["id"])
    refreshed = svc.get_tool(t["id"])
    assert refreshed["capability_due_at"] is None


def test_get_latest_capability_study():
    t = _create()
    _study(t["id"], study_date="2026-01-01T00:00:00Z", cm=1.5, cmk=1.2)
    _study(t["id"], study_date="2026-09-01T00:00:00Z", cm=2.0, cmk=1.9)
    result = svc.get_latest_capability_study(t["id"])
    assert result["study"] is not None
    assert result["study"]["cm"] == pytest.approx(2.0)


def test_create_study_on_inactive_tool_raises():
    t = _create()
    svc.deactivate_tool(t["id"], updated_by=1)
    with pytest.raises((ToolValidationError, ToolNotFoundError)):
        _study(t["id"])


# ===========================================================================
# tools_summary
# ===========================================================================

def test_tools_summary_shape():
    _create()
    result = svc.tools_summary()
    assert "total" in result
    assert "active" in result
    assert "inactive" in result
    assert "by_operational_status" in result
    assert "expired_count" in result
    assert result["active"] + result["inactive"] == result["total"]


def test_tools_summary_expired_count():
    _create(capability_due_at="2000-01-01T00:00:00Z")
    result = svc.tools_summary()
    assert result["expired_count"] >= 1
