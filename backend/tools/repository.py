"""SQLite schema and raw data-access functions for the tools (Tool Tracking) domain.

Route handlers must not execute SQL directly; they call service.py, which
calls this module. This module contains no business rules other than what
the database schema itself enforces (FK / UNIQUE / NOT NULL / CHECK).

Design guards preserved from C2.2 plan:
- No Cm/Cmk pass thresholds.
- No capability_interval_days default.
- No A/B/C tool_class enum enforcement.
- No automatic status derivation in SQL.
- No cascade delete (soft-delete only).
- capability studies are append-only (no update/delete functions).
"""
from __future__ import annotations

import sqlite3
from typing import Any

from backend.app import conn, now_iso
from backend.tools.exceptions import (
    ToolConflictError,
    ToolNotFoundError,
    ToolValidationError,
)

# ---------------------------------------------------------------------------
# DDL
# ---------------------------------------------------------------------------

DDL = """
CREATE TABLE IF NOT EXISTS tools (
    id                       INTEGER PRIMARY KEY,
    registration_id          TEXT    NOT NULL UNIQUE,
    model                    TEXT    NOT NULL,
    operation                TEXT    NOT NULL,
    nominal_torque_nm        REAL    NOT NULL CHECK(nominal_torque_nm > 0),
    tool_class               TEXT    NOT NULL,
    operational_status       TEXT    NOT NULL DEFAULT 'OK'
                                     CHECK(operational_status IN ('OK','KONTROL','YETERSİZ')),
    capability_due_at        TEXT    NULL,
    capability_interval_days INTEGER NULL,
    is_active                INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
    notes                    TEXT    NULL,
    created_by               INTEGER NOT NULL REFERENCES users(id),
    updated_by               INTEGER NULL     REFERENCES users(id),
    created_at               TEXT    NOT NULL,
    updated_at               TEXT    NULL
);

CREATE TABLE IF NOT EXISTS tool_capability_studies (
    id             INTEGER PRIMARY KEY,
    tool_id        INTEGER NOT NULL REFERENCES tools(id),
    analysis_type  TEXT    NOT NULL,
    cm             REAL    NULL,
    cmk            REAL    NULL,
    cp             REAL    NULL,
    cpk            REAL    NULL,
    lsl            REAL    NULL,
    usl            REAL    NULL,
    sample_count   INTEGER NULL CHECK(sample_count IS NULL OR sample_count > 0),
    method         TEXT    NULL,
    source         TEXT    NULL,
    study_date     TEXT    NOT NULL,
    created_by     INTEGER NOT NULL REFERENCES users(id),
    created_at     TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tools_registration_id
    ON tools(registration_id);

CREATE INDEX IF NOT EXISTS idx_capability_studies_tool_id_date
    ON tool_capability_studies(tool_id, study_date DESC);
"""

_VALID_OP_STATUSES = {"OK", "KONTROL", "YETERSİZ"}


def migrate(c: sqlite3.Connection) -> None:
    """Register the tools domain tables. Called once at startup inside
    the global migrate() in backend/app.py with an open connection."""
    c.executescript(DDL)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _row(c: sqlite3.Connection, tool_id: int) -> dict[str, Any]:
    row = c.execute("SELECT * FROM tools WHERE id = ?", (tool_id,)).fetchone()
    if row is None:
        raise ToolNotFoundError(f"Takım bulunamadı: id={tool_id}")
    return dict(row)


def _latest_study(c: sqlite3.Connection, tool_id: int) -> dict[str, Any] | None:
    row = c.execute(
        """SELECT id, analysis_type, cm, cmk, cp, cpk, study_date
           FROM tool_capability_studies
           WHERE tool_id = ?
           ORDER BY study_date DESC, id DESC
           LIMIT 1""",
        (tool_id,),
    ).fetchone()
    return dict(row) if row else None


def _attach_latest(tool: dict[str, Any], c: sqlite3.Connection) -> dict[str, Any]:
    tool["latest_study"] = _latest_study(c, tool["id"])
    return tool


# ---------------------------------------------------------------------------
# Tool CRUD
# ---------------------------------------------------------------------------

def create_tool(
    *,
    registration_id: str,
    model: str,
    operation: str,
    nominal_torque_nm: float,
    tool_class: str,
    operational_status: str = "OK",
    capability_due_at: str | None = None,
    capability_interval_days: int | None = None,
    notes: str | None = None,
    created_by: int,
) -> dict[str, Any]:
    registration_id = registration_id.strip()
    model = model.strip()
    operation = operation.strip()
    tool_class = tool_class.strip()

    if not registration_id:
        raise ToolValidationError("registration_id boş olamaz.")
    if not model:
        raise ToolValidationError("model boş olamaz.")
    if not operation:
        raise ToolValidationError("operation boş olamaz.")
    if not tool_class:
        raise ToolValidationError("tool_class boş olamaz.")
    if nominal_torque_nm <= 0:
        raise ToolValidationError("nominal_torque_nm sıfırdan büyük olmalıdır.")
    if operational_status not in _VALID_OP_STATUSES:
        raise ToolValidationError(
            f"operational_status geçersiz: {operational_status!r}. "
            f"İzin verilenler: {sorted(_VALID_OP_STATUSES)}"
        )

    now = now_iso()
    with conn() as c:
        try:
            c.execute(
                """INSERT INTO tools
                   (registration_id, model, operation, nominal_torque_nm,
                    tool_class, operational_status, capability_due_at,
                    capability_interval_days, notes, created_by, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    registration_id, model, operation, nominal_torque_nm,
                    tool_class, operational_status, capability_due_at,
                    capability_interval_days, notes, created_by, now,
                ),
            )
            c.commit()
            tool_id = c.execute("SELECT last_insert_rowid()").fetchone()[0]
        except sqlite3.IntegrityError as exc:
            if "UNIQUE" in str(exc).upper():
                raise ToolConflictError(
                    f"registration_id zaten kayıtlı: {registration_id!r}"
                ) from exc
            raise
        return _attach_latest(_row(c, tool_id), c)


def get_tool(tool_id: int, *, include_inactive: bool = False) -> dict[str, Any]:
    with conn() as c:
        row = c.execute("SELECT * FROM tools WHERE id = ?", (tool_id,)).fetchone()
        if row is None:
            raise ToolNotFoundError(f"Takım bulunamadı: id={tool_id}")
        tool = dict(row)
        if not include_inactive and not tool["is_active"]:
            raise ToolNotFoundError(f"Takım bulunamadı: id={tool_id}")
        return _attach_latest(tool, c)


def list_tools(
    *,
    include_inactive: bool = False,
) -> list[dict[str, Any]]:
    with conn() as c:
        if include_inactive:
            rows = c.execute(
                "SELECT * FROM tools ORDER BY registration_id ASC"
            ).fetchall()
        else:
            rows = c.execute(
                "SELECT * FROM tools WHERE is_active = 1 ORDER BY registration_id ASC"
            ).fetchall()
        return [_attach_latest(dict(r), c) for r in rows]


def update_tool(
    tool_id: int,
    *,
    updated_by: int,
    model: str | None = None,
    operation: str | None = None,
    nominal_torque_nm: float | None = None,
    tool_class: str | None = None,
    operational_status: str | None = None,
    capability_due_at: str | None = ...,   # type: ignore[assignment]
    capability_interval_days: int | None = ...,  # type: ignore[assignment]
    notes: str | None = ...,  # type: ignore[assignment]
) -> dict[str, Any]:
    """Update only the fields that are explicitly supplied (not sentinel).

    Uses Ellipsis (...) as sentinel so callers can distinguish
    "set to None" from "leave unchanged" for nullable fields.
    """
    with conn() as c:
        # Confirm tool exists (raises ToolNotFoundError if missing)
        current = _row(c, tool_id)

        sets: list[str] = []
        params: list[Any] = []

        def _add(col: str, val: Any, strip: bool = False) -> None:
            if val is None or val == "":
                raise ToolValidationError(f"{col} boş olamaz.")
            v = val.strip() if strip and isinstance(val, str) else val
            sets.append(f"{col} = ?")
            params.append(v)

        if model is not None:
            _add("model", model, strip=True)
        if operation is not None:
            _add("operation", operation, strip=True)
        if nominal_torque_nm is not None:
            if nominal_torque_nm <= 0:
                raise ToolValidationError("nominal_torque_nm sıfırdan büyük olmalıdır.")
            sets.append("nominal_torque_nm = ?")
            params.append(nominal_torque_nm)
        if tool_class is not None:
            _add("tool_class", tool_class, strip=True)
        if operational_status is not None:
            if operational_status not in _VALID_OP_STATUSES:
                raise ToolValidationError(f"operational_status geçersiz: {operational_status!r}")
            sets.append("operational_status = ?")
            params.append(operational_status)
        # Nullable fields: use sentinel check
        if capability_due_at is not ...:
            sets.append("capability_due_at = ?")
            params.append(capability_due_at)
        if capability_interval_days is not ...:
            sets.append("capability_interval_days = ?")
            params.append(capability_interval_days)
        if notes is not ...:
            sets.append("notes = ?")
            params.append(notes)

        if not sets:
            # Nothing to update — return current state
            return _attach_latest(current, c)

        sets.append("updated_by = ?")
        params.append(updated_by)
        sets.append("updated_at = ?")
        params.append(now_iso())
        params.append(tool_id)

        c.execute(
            f"UPDATE tools SET {', '.join(sets)} WHERE id = ?", params
        )
        c.commit()
        return _attach_latest(_row(c, tool_id), c)


def deactivate_tool(tool_id: int, *, updated_by: int) -> dict[str, Any]:
    """Soft-delete: set is_active = 0. Idempotent — no error if already inactive."""
    with conn() as c:
        # Confirm tool exists (raises ToolNotFoundError if missing)
        _row(c, tool_id)
        c.execute(
            "UPDATE tools SET is_active = 0, updated_by = ?, updated_at = ? WHERE id = ?",
            (updated_by, now_iso(), tool_id),
        )
        c.commit()
        # Return with include_inactive=True so deactivated row is visible
        row = c.execute("SELECT * FROM tools WHERE id = ?", (tool_id,)).fetchone()
        tool = dict(row)
        tool["latest_study"] = _latest_study(c, tool_id)
        return tool


# ---------------------------------------------------------------------------
# Capability Studies (append-only — no update/delete functions)
# ---------------------------------------------------------------------------

def create_capability_study(
    *,
    tool_id: int,
    analysis_type: str,
    cm: float | None = None,
    cmk: float | None = None,
    cp: float | None = None,
    cpk: float | None = None,
    lsl: float | None = None,
    usl: float | None = None,
    sample_count: int | None = None,
    method: str | None = None,
    source: str | None = None,
    study_date: str,
    created_by: int,
) -> dict[str, Any]:
    analysis_type = analysis_type.strip()
    if not analysis_type:
        raise ToolValidationError("analysis_type boş olamaz.")
    if not study_date or not study_date.strip():
        raise ToolValidationError("study_date boş olamaz.")

    # At least one capability value must be provided
    cap_values = [cm, cmk, cp, cpk]
    if all(v is None for v in cap_values):
        raise ToolValidationError(
            "En az bir yetenek değeri (cm, cmk, cp veya cpk) sağlanmalıdır."
        )

    if sample_count is not None and sample_count <= 0:
        raise ToolValidationError("sample_count sıfırdan büyük olmalıdır.")

    now = now_iso()
    with conn() as c:
        # Tool must exist and be active
        row = c.execute("SELECT id, is_active FROM tools WHERE id = ?", (tool_id,)).fetchone()
        if row is None:
            raise ToolNotFoundError(f"Takım bulunamadı: id={tool_id}")
        if not row["is_active"]:
            raise ToolValidationError(
                f"Pasif takıma yetenek çalışması eklenemez: tool_id={tool_id}"
            )

        c.execute(
            """INSERT INTO tool_capability_studies
               (tool_id, analysis_type, cm, cmk, cp, cpk, lsl, usl,
                sample_count, method, source, study_date, created_by, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                tool_id, analysis_type, cm, cmk, cp, cpk, lsl, usl,
                sample_count, method, source, study_date, created_by, now,
            ),
        )
        c.commit()
        study_id = c.execute("SELECT last_insert_rowid()").fetchone()[0]
        row2 = c.execute(
            "SELECT * FROM tool_capability_studies WHERE id = ?", (study_id,)
        ).fetchone()
        return dict(row2)


def list_capability_studies(tool_id: int) -> list[dict[str, Any]]:
    with conn() as c:
        rows = c.execute(
            """SELECT * FROM tool_capability_studies
               WHERE tool_id = ?
               ORDER BY study_date DESC, id DESC""",
            (tool_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_latest_capability_study(tool_id: int) -> dict[str, Any] | None:
    with conn() as c:
        row = c.execute(
            """SELECT * FROM tool_capability_studies
               WHERE tool_id = ?
               ORDER BY study_date DESC, id DESC
               LIMIT 1""",
            (tool_id,),
        ).fetchone()
        return dict(row) if row else None
