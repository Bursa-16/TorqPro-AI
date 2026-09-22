"""Pydantic request schemas for the tools (Tool Tracking) domain.

Response shapes are returned as plain dicts from the repository/service
layer, matching the existing TorqPro pattern (no response models).
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class ToolCreate(BaseModel):
    registration_id: str = Field(min_length=1)
    model: str = Field(min_length=1)
    operation: str = Field(min_length=1)
    nominal_torque_nm: float = Field(gt=0)
    tool_class: str = Field(min_length=1)
    operational_status: str | None = "OK"
    notes: str | None = None
    capability_due_at: str | None = None
    capability_interval_days: int | None = Field(default=None, gt=0)


class ToolPatch(BaseModel):
    model: str | None = Field(default=None, min_length=1)
    operation: str | None = Field(default=None, min_length=1)
    nominal_torque_nm: float | None = Field(default=None, gt=0)
    tool_class: str | None = Field(default=None, min_length=1)
    operational_status: str | None = None
    notes: str | None = None
    capability_due_at: str | None = None
    capability_interval_days: int | None = Field(default=None, gt=0)


class CapabilityStudyCreate(BaseModel):
    analysis_type: str = Field(min_length=1)
    cm: float | None = None
    cmk: float | None = None
    cp: float | None = None
    cpk: float | None = None
    lsl: float | None = None
    usl: float | None = None
    sample_count: int | None = Field(default=None, gt=0)
    method: str | None = None
    source: str | None = None
    study_date: str = Field(min_length=1)
