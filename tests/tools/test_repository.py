"""Repository-layer tests for the tools (Tool Tracking) domain.

All tests use an in-memory SQLite database via the shared conftest.py
fixture which sets TORQPRO_DB_PATH to a temp file and calls migrate().
The tests exercise the repository functions directly — no HTTP layer.
"""
from __future__ import annotations

import pytest

import backend.tools.repository as repo
from backend.tools.exceptions import (
    ToolConflictError,
    ToolNotFoundError,
    ToolValidationError,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_CREATED_BY = 1  # demo admin user created by conftest migrate/seed


def _make_tool(**overrides) -> dict:
    defaults = {
        "registration_id": "TRK-0001",
        "model": "Atlas Copco QST-06",
        "operation": "M8 Ön Montaj",
        "nominal_torque_nm": 12.5,
        "tool_class": "B",
        "created_by": _CREATED_BY,
    }
    defaults.update(overrides)
    return repo.create_tool(**defaults)


def _make_study(tool_id: int, **overrides) -> dict:
    defaults = {
        "tool_id": tool_id,
        "analysis_type": "Cm/Cmk",
        "cm": 2.1,
        "cmk": 1.85,
        "study_date": "2026-09-01T08:00:00Z",
        "created_by": _CREATED_BY,
    }
    defaults.update(overrides)
    return repo.create_capability_study(**defaults)


# ---------------------------------------------------------------------------
# Migration
# ---------------------------------------------------------------------------

def test_migrate_idempotent():
    """migrate() must be callable multiple times without error."""
    from backend.app import conn
    with conn() as c:
        repo.migrate(c)
        repo.migrate(c)  # second call — no error


# ---------------------------------------------------------------------------
# Tool CRUD
# ---------------------------------------------------------------------------

def test_create_and_get_tool():
    tool = _make_tool(registration_id="TRK-C-001")
    assert tool["id"] is not None
    fetched = repo.get_tool(tool["id"])
    assert fetched["registration_id"] == "TRK-C-001"
    assert fetched["is_active"] == 1
    assert fetched["latest_study"] is None


def test_unique_registration_id():
    _make_tool(registration_id="TRK-DUP-001")
    with pytest.raises(ToolConflictError):
        _make_tool(registration_id="TRK-DUP-001")


def test_nominal_torque_check():
    with pytest.raises(ToolValidationError):
        _make_tool(registration_id="TRK-BAD-NM", nominal_torque_nm=0.0)
    with pytest.raises(ToolValidationError):
        _make_tool(registration_id="TRK-BAD-NM2", nominal_torque_nm=-5.0)


def test_invalid_operational_status():
    with pytest.raises(ToolValidationError):
        _make_tool(registration_id="TRK-BAD-ST", operational_status="INVALID")


def test_list_active_tools_only():
    t1 = _make_tool(registration_id="TRK-LST-A1")
    t2 = _make_tool(registration_id="TRK-LST-A2")
    repo.deactivate_tool(t2["id"], updated_by=_CREATED_BY)

    active_ids = {t["id"] for t in repo.list_tools()}
    assert t1["id"] in active_ids
    assert t2["id"] not in active_ids


def test_include_inactive():
    t = _make_tool(registration_id="TRK-INC-001")
    repo.deactivate_tool(t["id"], updated_by=_CREATED_BY)

    all_ids = {x["id"] for x in repo.list_tools(include_inactive=True)}
    assert t["id"] in all_ids


def test_update_tool():
    t = _make_tool(registration_id="TRK-UPD-001")
    updated = repo.update_tool(
        t["id"],
        updated_by=_CREATED_BY,
        model="Desoutter CV-40",
        operational_status="KONTROL",
    )
    assert updated["model"] == "Desoutter CV-40"
    assert updated["operational_status"] == "KONTROL"
    assert updated["updated_by"] == _CREATED_BY
    assert updated["updated_at"] is not None
    # Fields not supplied remain unchanged
    assert updated["registration_id"] == "TRK-UPD-001"


def test_update_empty_body_is_noop():
    t = _make_tool(registration_id="TRK-UPD-NOOP")
    result = repo.update_tool(t["id"], updated_by=_CREATED_BY)
    assert result["registration_id"] == "TRK-UPD-NOOP"


def test_update_missing_tool():
    with pytest.raises(ToolNotFoundError):
        repo.update_tool(999999, updated_by=_CREATED_BY, model="X")


def test_deactivate_idempotent():
    t = _make_tool(registration_id="TRK-DEACT-001")
    repo.deactivate_tool(t["id"], updated_by=_CREATED_BY)
    # Second call must not raise
    result = repo.deactivate_tool(t["id"], updated_by=_CREATED_BY)
    assert result["is_active"] == 0


def test_deactivate_missing_tool():
    with pytest.raises(ToolNotFoundError):
        repo.deactivate_tool(999998, updated_by=_CREATED_BY)


# ---------------------------------------------------------------------------
# Capability Studies
# ---------------------------------------------------------------------------

def test_capability_fk():
    """Inserting a study for a non-existent tool raises ToolNotFoundError."""
    with pytest.raises(ToolNotFoundError):
        repo.create_capability_study(
            tool_id=999997,
            analysis_type="Cm/Cmk",
            cm=2.0, cmk=1.7,
            study_date="2026-09-01T00:00:00Z",
            created_by=_CREATED_BY,
        )


def test_create_capability_study():
    t = _make_tool(registration_id="TRK-CAP-001")
    study = _make_study(t["id"])
    assert study["id"] is not None
    assert study["tool_id"] == t["id"]
    assert study["cm"] == pytest.approx(2.1)
    assert study["cmk"] == pytest.approx(1.85)


def test_study_on_inactive_tool():
    t = _make_tool(registration_id="TRK-CAP-INACT")
    repo.deactivate_tool(t["id"], updated_by=_CREATED_BY)
    with pytest.raises(ToolValidationError):
        _make_study(t["id"])


def test_study_requires_at_least_one_capability_value():
    t = _make_tool(registration_id="TRK-CAP-EMPTY")
    with pytest.raises(ToolValidationError):
        repo.create_capability_study(
            tool_id=t["id"],
            analysis_type="Cm/Cmk",
            # cm/cmk/cp/cpk all None
            study_date="2026-09-01T00:00:00Z",
            created_by=_CREATED_BY,
        )


def test_latest_study_ordering():
    """get_latest_capability_study returns the most recent by study_date."""
    t = _make_tool(registration_id="TRK-CAP-ORD")
    _make_study(t["id"], study_date="2026-01-01T00:00:00Z", cm=1.5, cmk=1.3)
    _make_study(t["id"], study_date="2026-06-01T00:00:00Z", cm=1.8, cmk=1.6)
    _make_study(t["id"], study_date="2026-09-01T00:00:00Z", cm=2.1, cmk=1.85)

    latest = repo.get_latest_capability_study(t["id"])
    assert latest is not None
    assert latest["cm"] == pytest.approx(2.1)
    assert latest["study_date"] == "2026-09-01T00:00:00Z"


def test_list_capability_studies_newest_first():
    t = _make_tool(registration_id="TRK-CAP-LIST")
    _make_study(t["id"], study_date="2025-03-01T00:00:00Z", cm=1.4, cmk=1.2)
    _make_study(t["id"], study_date="2026-03-01T00:00:00Z", cm=1.9, cmk=1.7)

    studies = repo.list_capability_studies(t["id"])
    assert len(studies) == 2
    assert studies[0]["study_date"] > studies[1]["study_date"]


def test_soft_delete_preserves_capability_history():
    t = _make_tool(registration_id="TRK-CAP-SOFT")
    _make_study(t["id"])
    repo.deactivate_tool(t["id"], updated_by=_CREATED_BY)

    # History must still be accessible after deactivation
    studies = repo.list_capability_studies(t["id"])
    assert len(studies) == 1


def test_get_latest_study_none_when_empty():
    t = _make_tool(registration_id="TRK-CAP-NONE")
    assert repo.get_latest_capability_study(t["id"]) is None


def test_latest_study_attached_on_list():
    t = _make_tool(registration_id="TRK-CAP-ATT")
    _make_study(t["id"])
    tools = repo.list_tools()
    match = next(x for x in tools if x["id"] == t["id"])
    assert match["latest_study"] is not None
    assert match["latest_study"]["cm"] == pytest.approx(2.1)


def test_no_capability_update_function():
    """update_capability_study must NOT exist on the repository module."""
    assert not hasattr(repo, "update_capability_study"), (
        "update_capability_study must not be implemented — studies are immutable"
    )


def test_no_capability_delete_function():
    """delete_capability_study must NOT exist on the repository module."""
    assert not hasattr(repo, "delete_capability_study"), (
        "delete_capability_study must not be implemented — studies are immutable"
    )
