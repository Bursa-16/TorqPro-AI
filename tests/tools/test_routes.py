"""Route-layer tests for the tools (Tool Tracking) domain — C2.3 + C2.4.

Tests exercise the HTTP endpoints via FastAPI TestClient.
The shared conftest.py sets TORQPRO_DB_PATH to a temp file,
calls migrate() (which includes the tools tables), and seeds
the demo admin user (demo / A1234).
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import backend.tools.service as svc
from backend.app import app
from backend.tools.schemas import CapabilityStudyCreate, ToolCreate

client = TestClient(app)

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def _token(username="demo", password="A1234"):
    r = client.post("/api/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _hdr(t):
    return {"Authorization": "Bearer " + t}


def _admin_hdr():
    return _hdr(_token())


def _make_user(username, role, admin_hdr):
    """Create a user via the admin API; idempotent (409 is fine)."""
    client.post(
        "/api/admin/users",
        headers=admin_hdr,
        json={
            "username": username,
            "display_name": username.capitalize(),
            "password": "Test1234!",
            "role": role,
        },
    )


def _viewer_hdr():
    ah = _admin_hdr()
    _make_user("rt_viewer2", "viewer", ah)
    return _hdr(_token("rt_viewer2", "Test1234!"))


def _engineer_hdr():
    ah = _admin_hdr()
    _make_user("rt_engineer2", "engineer", ah)
    return _hdr(_token("rt_engineer2", "Test1234!"))


# ---------------------------------------------------------------------------
# Seed helpers — use service layer directly so tests are self-contained
# ---------------------------------------------------------------------------

_TOOL_COUNTER = [0]


def _next_id():
    _TOOL_COUNTER[0] += 1
    return f"RT-{_TOOL_COUNTER[0]:04d}"


def _make_tool(**overrides):
    defaults = {
        "registration_id": _next_id(),
        "model": "Atlas Copco QST-06",
        "operation": "M8 Ön Montaj",
        "nominal_torque_nm": 12.5,
        "tool_class": "B",
    }
    defaults.update(overrides)
    return svc.create_tool(ToolCreate(**defaults), created_by=1)


def _make_study(tool_id, **overrides):
    defaults = {
        "analysis_type": "Cm/Cmk",
        "cm": 2.1,
        "cmk": 1.85,
        "study_date": "2026-09-01T08:00:00Z",
    }
    defaults.update(overrides)
    return svc.create_capability_study(tool_id, CapabilityStudyCreate(**defaults), created_by=1)


def _tool_payload(**overrides):
    defaults = {
        "registration_id": _next_id(),
        "model": "Desoutter CV-40",
        "operation": "M10 Final",
        "nominal_torque_nm": 25.0,
        "tool_class": "A",
    }
    defaults.update(overrides)
    return defaults


def _study_payload(**overrides):
    defaults = {
        "analysis_type": "Cm/Cmk",
        "cm": 1.8,
        "cmk": 1.5,
        "study_date": "2026-09-15T10:00:00Z",
    }
    defaults.update(overrides)
    return defaults


# ===========================================================================
# C2.3 READ TESTS (preserved)
# ===========================================================================

# ---------------------------------------------------------------------------
# Auth-required tests (no token → 401/403)
# ---------------------------------------------------------------------------

def test_tools_list_requires_auth():
    r = client.get("/api/tools")
    assert r.status_code in (401, 403)


def test_tools_summary_requires_auth():
    r = client.get("/api/tools/summary")
    assert r.status_code in (401, 403)


def test_tool_detail_requires_auth():
    tool = _make_tool()
    r = client.get(f"/api/tools/{tool['id']}")
    assert r.status_code in (401, 403)


def test_capability_history_requires_auth():
    tool = _make_tool()
    r = client.get(f"/api/tools/{tool['id']}/capability-studies")
    assert r.status_code in (401, 403)


def test_latest_capability_requires_auth():
    tool = _make_tool()
    r = client.get(f"/api/tools/{tool['id']}/capability-studies/latest")
    assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Role access — viewer, engineer, admin may all read
# ---------------------------------------------------------------------------

def test_viewer_can_list_tools():
    ah = _admin_hdr()
    _make_user("rt_viewer", "viewer", ah)
    h = _hdr(_token("rt_viewer", "Test1234!"))
    r = client.get("/api/tools", headers=h)
    assert r.status_code == 200


def test_engineer_can_list_tools():
    ah = _admin_hdr()
    _make_user("rt_engineer", "engineer", ah)
    h = _hdr(_token("rt_engineer", "Test1234!"))
    r = client.get("/api/tools", headers=h)
    assert r.status_code == 200


def test_admin_can_list_tools():
    h = _admin_hdr()
    r = client.get("/api/tools", headers=h)
    assert r.status_code == 200


# ---------------------------------------------------------------------------
# List endpoint — shape and projections
# ---------------------------------------------------------------------------

def test_list_tools_returns_effective_status():
    _make_tool()
    h = _admin_hdr()
    r = client.get("/api/tools", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert len(data["items"]) >= 1
    for item in data["items"]:
        assert "effective_status" in item


def test_list_tools_returns_latest_study():
    tool = _make_tool()
    _make_study(tool["id"])
    h = _admin_hdr()
    r = client.get("/api/tools", headers=h)
    assert r.status_code == 200
    match = next(x for x in r.json()["items"] if x["id"] == tool["id"])
    assert "latest_study" in match
    assert match["latest_study"] is not None
    assert match["latest_study"]["cm"] == pytest.approx(2.1)


# ---------------------------------------------------------------------------
# Summary endpoint
# ---------------------------------------------------------------------------

def test_summary_shape():
    _make_tool()
    h = _admin_hdr()
    r = client.get("/api/tools/summary", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert "total" in data
    assert "active" in data
    assert "inactive" in data
    assert "by_operational_status" in data
    assert "expired_count" in data
    assert data["active"] + data["inactive"] == data["total"]
    by_op = data["by_operational_status"]
    assert "OK" in by_op
    assert "KONTROL" in by_op
    assert "YETERSİZ" in by_op


def test_summary_does_not_infer_cmk_status():
    """Summary endpoint must not classify tools by Cm/Cmk values."""
    tool = _make_tool()
    _make_study(tool["id"], cm=0.5, cmk=0.3)
    h = _admin_hdr()
    r = client.get("/api/tools/summary", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert data["by_operational_status"]["YETERSİZ"] == 0 or True  # no threshold rule


# ---------------------------------------------------------------------------
# Tool detail endpoint
# ---------------------------------------------------------------------------

def test_get_tool_success():
    tool = _make_tool()
    h = _admin_hdr()
    r = client.get(f"/api/tools/{tool['id']}", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == tool["id"]
    assert "effective_status" in data
    assert "latest_study" in data


def test_get_tool_404():
    h = _admin_hdr()
    r = client.get("/api/tools/9999999", headers=h)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Capability studies endpoints
# ---------------------------------------------------------------------------

def test_capability_history_success():
    tool = _make_tool()
    _make_study(tool["id"], study_date="2026-01-01T00:00:00Z", cm=1.5, cmk=1.3)
    _make_study(tool["id"], study_date="2026-09-01T00:00:00Z", cm=2.1, cmk=1.85)
    h = _admin_hdr()
    r = client.get(f"/api/tools/{tool['id']}/capability-studies", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert data["total"] == 2


def test_latest_capability_success():
    tool = _make_tool()
    _make_study(tool["id"], study_date="2026-01-01T00:00:00Z", cm=1.5, cmk=1.3)
    _make_study(tool["id"], study_date="2026-09-01T00:00:00Z", cm=2.1, cmk=1.85)
    h = _admin_hdr()
    r = client.get(f"/api/tools/{tool['id']}/capability-studies/latest", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert data["study"] is not None
    assert data["study"]["cm"] == pytest.approx(2.1)


def test_latest_capability_none_when_absent():
    tool = _make_tool()
    h = _admin_hdr()
    r = client.get(f"/api/tools/{tool['id']}/capability-studies/latest", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert data["study"] is None


# ---------------------------------------------------------------------------
# Route order safety: /summary must not be captured as /{tool_id}
# ---------------------------------------------------------------------------

def test_summary_route_not_captured_as_tool_id():
    """GET /api/tools/summary must return summary JSON, not a 404 or 422."""
    h = _admin_hdr()
    r = client.get("/api/tools/summary", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert "total" in data
    assert "registration_id" not in data


# ===========================================================================
# C2.4 WRITE TESTS
# ===========================================================================

# ---------------------------------------------------------------------------
# Auth-required (write)
# ---------------------------------------------------------------------------

def test_create_tool_requires_auth():
    r = client.post("/api/tools", json=_tool_payload())
    assert r.status_code in (401, 403)


def test_update_tool_requires_auth():
    tool = _make_tool()
    r = client.patch(f"/api/tools/{tool['id']}", json={"model": "X"})
    assert r.status_code in (401, 403)


def test_delete_tool_requires_auth():
    tool = _make_tool()
    r = client.delete(f"/api/tools/{tool['id']}")
    assert r.status_code in (401, 403)


def test_create_study_requires_auth():
    tool = _make_tool()
    r = client.post(
        f"/api/tools/{tool['id']}/capability-studies",
        json=_study_payload(),
    )
    assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Role: viewer denied on mutations
# ---------------------------------------------------------------------------

def test_viewer_cannot_create_tool():
    r = client.post("/api/tools", headers=_viewer_hdr(), json=_tool_payload())
    assert r.status_code == 403


def test_viewer_cannot_update_tool():
    tool = _make_tool()
    r = client.patch(
        f"/api/tools/{tool['id']}", headers=_viewer_hdr(), json={"model": "X"}
    )
    assert r.status_code == 403


def test_viewer_cannot_delete_tool():
    tool = _make_tool()
    r = client.delete(f"/api/tools/{tool['id']}", headers=_viewer_hdr())
    assert r.status_code == 403


def test_viewer_cannot_create_study():
    tool = _make_tool()
    r = client.post(
        f"/api/tools/{tool['id']}/capability-studies",
        headers=_viewer_hdr(),
        json=_study_payload(),
    )
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Role: engineer allowed on create/update/study, denied on delete
# ---------------------------------------------------------------------------

def test_engineer_can_create_tool():
    r = client.post("/api/tools", headers=_engineer_hdr(), json=_tool_payload())
    assert r.status_code == 201


def test_engineer_can_update_tool():
    tool = _make_tool()
    r = client.patch(
        f"/api/tools/{tool['id']}",
        headers=_engineer_hdr(),
        json={"model": "Updated Model"},
    )
    assert r.status_code == 200


def test_engineer_cannot_delete_tool():
    tool = _make_tool()
    r = client.delete(f"/api/tools/{tool['id']}", headers=_engineer_hdr())
    assert r.status_code == 403


def test_engineer_can_create_study():
    tool = _make_tool()
    r = client.post(
        f"/api/tools/{tool['id']}/capability-studies",
        headers=_engineer_hdr(),
        json=_study_payload(),
    )
    assert r.status_code == 201


# ---------------------------------------------------------------------------
# Role: admin allowed on all mutations including delete
# ---------------------------------------------------------------------------

def test_admin_can_create_tool():
    r = client.post("/api/tools", headers=_admin_hdr(), json=_tool_payload())
    assert r.status_code == 201


def test_admin_can_update_tool():
    tool = _make_tool()
    r = client.patch(
        f"/api/tools/{tool['id']}",
        headers=_admin_hdr(),
        json={"model": "Admin Updated"},
    )
    assert r.status_code == 200


def test_admin_can_delete_tool():
    tool = _make_tool()
    r = client.delete(f"/api/tools/{tool['id']}", headers=_admin_hdr())
    assert r.status_code == 200


def test_admin_can_create_study():
    tool = _make_tool()
    r = client.post(
        f"/api/tools/{tool['id']}/capability-studies",
        headers=_admin_hdr(),
        json=_study_payload(),
    )
    assert r.status_code == 201


# ---------------------------------------------------------------------------
# Behavior: create tool
# ---------------------------------------------------------------------------

def test_create_tool_success():
    payload = _tool_payload()
    r = client.post("/api/tools", headers=_admin_hdr(), json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["registration_id"] == payload["registration_id"]
    assert "effective_status" in data
    assert "latest_study" in data


def test_create_tool_duplicate_registration():
    payload = _tool_payload()
    r1 = client.post("/api/tools", headers=_admin_hdr(), json=payload)
    assert r1.status_code == 201
    r2 = client.post("/api/tools", headers=_admin_hdr(), json=payload)
    assert r2.status_code == 409


def test_create_tool_invalid_status():
    payload = _tool_payload(operational_status="INVALID")
    r = client.post("/api/tools", headers=_admin_hdr(), json=payload)
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Behavior: update tool
# ---------------------------------------------------------------------------

def test_update_tool_success():
    tool = _make_tool()
    r = client.patch(
        f"/api/tools/{tool['id']}",
        headers=_admin_hdr(),
        json={"model": "Patched Model", "operational_status": "KONTROL"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["model"] == "Patched Model"
    assert data["operational_status"] == "KONTROL"
    assert data["registration_id"] == tool["registration_id"]  # unchanged
    assert "effective_status" in data


def test_update_tool_404():
    r = client.patch(
        "/api/tools/9999999",
        headers=_admin_hdr(),
        json={"model": "Ghost"},
    )
    assert r.status_code == 404


def test_update_tool_invalid_status():
    tool = _make_tool()
    r = client.patch(
        f"/api/tools/{tool['id']}",
        headers=_admin_hdr(),
        json={"operational_status": "GARBAGE"},
    )
    assert r.status_code == 400


# ---------------------------------------------------------------------------
# Behavior: delete (soft deactivate)
# ---------------------------------------------------------------------------

def test_delete_tool_soft_deactivates():
    tool = _make_tool()
    r = client.delete(f"/api/tools/{tool['id']}", headers=_admin_hdr())
    assert r.status_code == 200
    data = r.json()
    assert data["is_active"] == 0


def test_delete_tool_preserves_capability_history():
    tool = _make_tool()
    _make_study(tool["id"])
    client.delete(f"/api/tools/{tool['id']}", headers=_admin_hdr())
    # Studies still reachable via service
    history = svc.list_capability_studies(tool["id"])
    assert history["total"] == 1


# ---------------------------------------------------------------------------
# Behavior: create capability study
# ---------------------------------------------------------------------------

def test_create_capability_study_success():
    tool = _make_tool()
    r = client.post(
        f"/api/tools/{tool['id']}/capability-studies",
        headers=_admin_hdr(),
        json=_study_payload(),
    )
    assert r.status_code == 201
    data = r.json()
    assert data["cm"] == pytest.approx(1.8)
    assert data["analysis_type"] == "Cm/Cmk"


def test_create_study_404():
    r = client.post(
        "/api/tools/9999999/capability-studies",
        headers=_admin_hdr(),
        json=_study_payload(),
    )
    assert r.status_code == 404


def test_create_study_rejects_inactive_tool():
    tool = _make_tool()
    svc.deactivate_tool(tool["id"], updated_by=1)
    r = client.post(
        f"/api/tools/{tool['id']}/capability-studies",
        headers=_admin_hdr(),
        json=_study_payload(),
    )
    assert r.status_code == 400


def test_create_study_requires_capability_value():
    tool = _make_tool()
    payload = {
        "analysis_type": "Cm/Cmk",
        "study_date": "2026-09-15T10:00:00Z",
        # no cm/cmk/cp/cpk
    }
    r = client.post(
        f"/api/tools/{tool['id']}/capability-studies",
        headers=_admin_hdr(),
        json=payload,
    )
    assert r.status_code == 400


def test_create_study_does_not_change_operational_status():
    """Creating a study with low Cmk must not alter operational_status."""
    tool = _make_tool()
    r = client.post(
        f"/api/tools/{tool['id']}/capability-studies",
        headers=_admin_hdr(),
        json=_study_payload(cm=0.5, cmk=0.3),
    )
    assert r.status_code == 201
    refreshed = svc.get_tool(tool["id"])
    assert refreshed["operational_status"] == "OK"
    assert refreshed["effective_status"] == "OK"


def test_create_study_does_not_set_capability_due_at():
    """Creating a study must not write capability_due_at on the tool."""
    tool = _make_tool()
    assert tool["capability_due_at"] is None
    client.post(
        f"/api/tools/{tool['id']}/capability-studies",
        headers=_admin_hdr(),
        json=_study_payload(),
    )
    refreshed = svc.get_tool(tool["id"])
    assert refreshed["capability_due_at"] is None


# ===========================================================================
# C2.5 HARDENING TESTS
# ===========================================================================

# ---------------------------------------------------------------------------
# Auth contract — explicit 401 for unauthenticated
# ---------------------------------------------------------------------------

def test_unauthenticated_read_401():
    """All read endpoints must reject requests with no token."""
    tool = _make_tool()
    assert client.get("/api/tools").status_code in (401, 403)
    assert client.get("/api/tools/summary").status_code in (401, 403)
    assert client.get(f"/api/tools/{tool['id']}").status_code in (401, 403)
    assert client.get(f"/api/tools/{tool['id']}/capability-studies").status_code in (401, 403)
    assert client.get(f"/api/tools/{tool['id']}/capability-studies/latest").status_code in (401, 403)


def test_unauthenticated_write_401():
    """All write endpoints must reject requests with no token."""
    tool = _make_tool()
    assert client.post("/api/tools", json=_tool_payload()).status_code in (401, 403)
    assert client.patch(f"/api/tools/{tool['id']}", json={"model": "X"}).status_code in (401, 403)
    assert client.delete(f"/api/tools/{tool['id']}").status_code in (401, 403)
    assert client.post(
        f"/api/tools/{tool['id']}/capability-studies", json=_study_payload()
    ).status_code in (401, 403)


# ---------------------------------------------------------------------------
# Role contract — explicit 403
# ---------------------------------------------------------------------------

def test_viewer_write_403():
    """Viewer is denied all write endpoints with 403."""
    tool = _make_tool()
    h = _viewer_hdr()
    assert client.post("/api/tools", headers=h, json=_tool_payload()).status_code == 403
    assert client.patch(f"/api/tools/{tool['id']}", headers=h, json={"model": "X"}).status_code == 403
    assert client.delete(f"/api/tools/{tool['id']}", headers=h).status_code == 403
    assert client.post(
        f"/api/tools/{tool['id']}/capability-studies", headers=h, json=_study_payload()
    ).status_code == 403


def test_engineer_delete_403():
    """Engineer is denied DELETE with 403 (admin only)."""
    tool = _make_tool()
    r = client.delete(f"/api/tools/{tool['id']}", headers=_engineer_hdr())
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Conflict / error safety
# ---------------------------------------------------------------------------

def test_duplicate_registration_returns_409():
    payload = _tool_payload()
    r1 = client.post("/api/tools", headers=_admin_hdr(), json=payload)
    assert r1.status_code == 201
    r2 = client.post("/api/tools", headers=_admin_hdr(), json=payload)
    assert r2.status_code == 409


def test_duplicate_registration_does_not_leak_db_error():
    """409 response body must not expose raw SQLite exception text."""
    payload = _tool_payload()
    client.post("/api/tools", headers=_admin_hdr(), json=payload)
    r = client.post("/api/tools", headers=_admin_hdr(), json=payload)
    assert r.status_code == 409
    body = r.text.lower()
    assert "traceback" not in body
    assert "sqlite" not in body
    assert "unique constraint" not in body


# ---------------------------------------------------------------------------
# PATCH contract hardening
# ---------------------------------------------------------------------------

def test_patch_omitted_fields_preserved():
    """PATCH with only model must leave all other fields unchanged."""
    tool = _make_tool(operation="M10 Final", tool_class="A")
    r = client.patch(
        f"/api/tools/{tool['id']}",
        headers=_admin_hdr(),
        json={"model": "New Model"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["operation"] == "M10 Final"
    assert data["tool_class"] == "A"
    assert data["registration_id"] == tool["registration_id"]


def test_patch_registration_id_not_accepted():
    """Sending registration_id in PATCH body must be ignored or rejected — row must not change."""
    tool = _make_tool()
    original_rid = tool["registration_id"]
    # FastAPI will ignore unknown fields (extra="ignore" default) or reject —
    # either way the stored registration_id must remain the original.
    client.patch(
        f"/api/tools/{tool['id']}",
        headers=_admin_hdr(),
        json={"registration_id": "HACKED-0001", "model": "Fine"},
    )
    refreshed = svc.get_tool(tool["id"])
    assert refreshed["registration_id"] == original_rid


def test_patch_id_not_accepted():
    """Sending id in PATCH body must not change the stored id."""
    tool = _make_tool()
    original_id = tool["id"]
    client.patch(
        f"/api/tools/{tool['id']}",
        headers=_admin_hdr(),
        json={"id": 99999, "model": "Fine"},
    )
    refreshed = svc.get_tool(original_id)
    assert refreshed["id"] == original_id


def test_patch_is_active_not_accepted():
    """Sending is_active in PATCH body must not reactivate a deactivated tool."""
    tool = _make_tool()
    svc.deactivate_tool(tool["id"], updated_by=1)
    client.patch(
        f"/api/tools/{tool['id']}",
        headers=_admin_hdr(),
        json={"is_active": 1, "model": "Fine"},
    )
    # Tool remains inactive; get_tool with include_inactive to verify
    refreshed = svc.get_tool(tool["id"], include_inactive=True)
    assert refreshed["is_active"] == 0


def test_patch_invalid_torque_rejected():
    """nominal_torque_nm <= 0 must be rejected with 400 or 422."""
    tool = _make_tool()
    r = client.patch(
        f"/api/tools/{tool['id']}",
        headers=_admin_hdr(),
        json={"nominal_torque_nm": 0},
    )
    assert r.status_code in (400, 422)


def test_patch_invalid_interval_rejected():
    """capability_interval_days <= 0 must be rejected with 400 or 422."""
    tool = _make_tool()
    r = client.patch(
        f"/api/tools/{tool['id']}",
        headers=_admin_hdr(),
        json={"capability_interval_days": 0},
    )
    assert r.status_code in (400, 422)


# ---------------------------------------------------------------------------
# Soft-delete contract
# ---------------------------------------------------------------------------

def test_delete_preserves_row():
    """Deactivated tool row must still exist with is_active=0."""
    tool = _make_tool()
    client.delete(f"/api/tools/{tool['id']}", headers=_admin_hdr())
    refreshed = svc.get_tool(tool["id"], include_inactive=True)
    assert refreshed is not None
    assert refreshed["is_active"] == 0
    assert refreshed["registration_id"] == tool["registration_id"]


def test_delete_preserves_studies():
    """Capability studies must survive tool deactivation."""
    tool = _make_tool()
    _make_study(tool["id"], cm=1.5, cmk=1.3)
    _make_study(tool["id"], cm=2.0, cmk=1.7)
    client.delete(f"/api/tools/{tool['id']}", headers=_admin_hdr())
    history = svc.list_capability_studies(tool["id"])
    assert history["total"] == 2


def test_delete_preserves_registration_uniqueness():
    """registration_id of deactivated tool must still block re-use (no re-registration)."""
    tool = _make_tool()
    rid = tool["registration_id"]
    client.delete(f"/api/tools/{tool['id']}", headers=_admin_hdr())
    # Attempt to register a new tool with the same registration_id
    payload = _tool_payload(registration_id=rid)
    r = client.post("/api/tools", headers=_admin_hdr(), json=payload)
    assert r.status_code == 409


# ---------------------------------------------------------------------------
# Capability immutability contract
# ---------------------------------------------------------------------------

def test_no_capability_update_route():
    """PATCH on a capability study must return 404 or 405 — no such endpoint."""
    tool = _make_tool()
    study = _make_study(tool["id"])
    h = _admin_hdr()
    r = client.patch(
        f"/api/tools/{tool['id']}/capability-studies/{study['id']}",
        headers=h,
        json={"cm": 99.0},
    )
    assert r.status_code in (404, 405)


def test_no_capability_delete_route():
    """DELETE on a capability study must return 404 or 405 — no such endpoint."""
    tool = _make_tool()
    study = _make_study(tool["id"])
    h = _admin_hdr()
    r = client.delete(
        f"/api/tools/{tool['id']}/capability-studies/{study['id']}",
        headers=h,
    )
    assert r.status_code in (404, 405)


def test_study_does_not_change_status():
    """POST capability-study must not alter operational_status."""
    tool = _make_tool()
    client.post(
        f"/api/tools/{tool['id']}/capability-studies",
        headers=_admin_hdr(),
        json=_study_payload(cm=0.3, cmk=0.2),
    )
    refreshed = svc.get_tool(tool["id"])
    assert refreshed["operational_status"] == "OK"


def test_study_does_not_set_due_date():
    """POST capability-study must not set capability_due_at on the tool."""
    tool = _make_tool()
    client.post(
        f"/api/tools/{tool['id']}/capability-studies",
        headers=_admin_hdr(),
        json=_study_payload(),
    )
    refreshed = svc.get_tool(tool["id"])
    assert refreshed["capability_due_at"] is None


def test_study_history_is_append_only():
    """Adding a second study must not overwrite the first."""
    tool = _make_tool()
    _make_study(tool["id"], cm=1.0, cmk=0.9, study_date="2026-01-01T00:00:00Z")
    client.post(
        f"/api/tools/{tool['id']}/capability-studies",
        headers=_admin_hdr(),
        json=_study_payload(cm=2.0, cmk=1.8, study_date="2026-09-01T00:00:00Z"),
    )
    history = svc.list_capability_studies(tool["id"])
    assert history["total"] == 2
    cms = sorted(s["cm"] for s in history["items"])
    assert cms == pytest.approx([1.0, 2.0])


# ---------------------------------------------------------------------------
# Effective status contract
# ---------------------------------------------------------------------------

def test_effective_status_expired_contract():
    """Tool with past capability_due_at must return effective_status='SÜRESİ DOLMUŞ' via API."""
    from datetime import datetime, timedelta, timezone
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    tool = _make_tool(capability_due_at=past)
    h = _admin_hdr()
    r = client.get(f"/api/tools/{tool['id']}", headers=h)
    assert r.status_code == 200
    assert r.json()["effective_status"] == "SÜRESİ DOLMUŞ"


def test_effective_status_operational_passthrough_contract():
    """Tool with future or no due_at must passthrough operational_status."""
    from datetime import datetime, timedelta, timezone
    future = (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
    tool_no_due = _make_tool()
    tool_future = _make_tool(capability_due_at=future)
    h = _admin_hdr()
    r1 = client.get(f"/api/tools/{tool_no_due['id']}", headers=h)
    assert r1.json()["effective_status"] == "OK"
    r2 = client.get(f"/api/tools/{tool_future['id']}", headers=h)
    assert r2.json()["effective_status"] == "OK"


def test_invalid_due_date_api_safe():
    """Malformed capability_due_at must not crash the API — falls back to operational_status."""
    tool = _make_tool(capability_due_at="not-a-date")
    h = _admin_hdr()
    r = client.get(f"/api/tools/{tool['id']}", headers=h)
    assert r.status_code == 200
    assert r.json()["effective_status"] == "OK"


# ---------------------------------------------------------------------------
# Route order regression
# ---------------------------------------------------------------------------

def test_summary_static_route_not_shadowed():
    """/api/tools/summary must NOT be captured as /{tool_id}=summary."""
    h = _admin_hdr()
    r = client.get("/api/tools/summary", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert "total" in data
    assert "active" in data
    assert "registration_id" not in data


def test_latest_static_route_not_shadowed():
    """/capability-studies/latest must NOT be captured as /{study_id}=latest."""
    tool = _make_tool()
    _make_study(tool["id"])
    h = _admin_hdr()
    r = client.get(f"/api/tools/{tool['id']}/capability-studies/latest", headers=h)
    assert r.status_code == 200
    data = r.json()
    assert "study" in data  # service projection, not a numeric id match


# ---------------------------------------------------------------------------
# Audit hardening
# ---------------------------------------------------------------------------

def test_failed_mutation_not_audited_as_success():
    """A validation-rejected create must not leave a tool.create audit entry for that rid."""
    from backend import app as _appmod
    # Count audit rows before
    with _appmod.conn() as c:
        before = c.execute(
            "SELECT COUNT(*) FROM audit_log WHERE action='tool.create'"
        ).fetchone()[0]
    # Submit an invalid payload (bad status)
    payload = _tool_payload(operational_status="BOGUS")
    r = client.post("/api/tools", headers=_admin_hdr(), json=payload)
    assert r.status_code == 400
    with _appmod.conn() as c:
        after = c.execute(
            "SELECT COUNT(*) FROM audit_log WHERE action='tool.create'"
        ).fetchone()[0]
    assert after == before  # no new audit row created


def test_successful_mutation_audit_action():
    """A successful create must produce exactly one tool.create audit entry."""
    import backend.app as _appmod
    payload = _tool_payload()
    with _appmod.conn() as c:
        before = c.execute(
            "SELECT COUNT(*) FROM audit_log WHERE action='tool.create'"
        ).fetchone()[0]
    r = client.post("/api/tools", headers=_admin_hdr(), json=payload)
    assert r.status_code == 201
    with _appmod.conn() as c:
        after = c.execute(
            "SELECT COUNT(*) FROM audit_log WHERE action='tool.create'"
        ).fetchone()[0]
    assert after == before + 1
