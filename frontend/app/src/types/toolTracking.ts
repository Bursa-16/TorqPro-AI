// ── toolTracking.ts ──────────────────────────────────────────────────────────
// Type contract for the Tool Tracking (Sıkıcı Takip) module.
// C2.8: nullable cm/cmk/lastCapabilityDate; ApiTool raw shape; ToolsSummary.
// C2.9: mutation payload types; OperationalStatus; ApiCapabilityStudy.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Effective display status values — including the derived "SÜRESİ DOLMUŞ".
 * These are NOT all persisted in the DB; effective_status is computed by the backend.
 */
export type ToolStatus = 'OK' | 'KONTROL' | 'YETERSİZ' | 'SÜRESİ DOLMUŞ'

/**
 * Persisted operational_status values only — excludes the derived "SÜRESİ DOLMUŞ".
 * Use this for create/update forms and API payloads.
 */
export type OperationalStatus = 'OK' | 'KONTROL' | 'YETERSİZ'

export const OPERATIONAL_STATUS_OPTIONS: OperationalStatus[] = ['OK', 'KONTROL', 'YETERSİZ']

// ── Raw backend shapes ────────────────────────────────────────────────────────

export interface ApiToolLatestStudy {
  id: number
  analysis_type: string
  cm: number | null
  cmk: number | null
  cp: number | null
  cpk: number | null
  study_date: string
}

export interface ApiTool {
  id: number
  registration_id: string
  model: string
  operation: string
  nominal_torque_nm: number
  tool_class: string
  operational_status: string
  effective_status: string
  capability_due_at: string | null
  capability_interval_days: number | null
  is_active: number | boolean
  notes: string | null
  created_by: number
  updated_by: number | null
  created_at: string
  updated_at: string | null
  latest_study: ApiToolLatestStudy | null
}

export interface ApiCapabilityStudy {
  id: number
  tool_id: number
  analysis_type: string
  cm: number | null
  cmk: number | null
  cp: number | null
  cpk: number | null
  lsl: number | null
  usl: number | null
  sample_count: number | null
  method: string | null
  source: string | null
  study_date: string
  created_by: number
  created_at: string
}

// ── Display model ─────────────────────────────────────────────────────────────

/**
 * A single tool tracking record as displayed in the inventory table.
 * status is sourced from backend effective_status — never derived from cm/cmk.
 */
export interface ToolTrackingRecord {
  id: string
  registrationId: string
  model: string
  operation: string
  nominalTorqueNm: number
  toolClass: string
  /** null when no capability study exists */
  cm: number | null
  /** null when no capability study exists */
  cmk: number | null
  /** "YYYY-MM-DD" or null when no study */
  lastCapabilityDate: string | null
  /** From backend effective_status — never computed by frontend */
  status: ToolStatus
  /** Retained for edit form pre-fill — the persisted value, not effective */
  operationalStatus: OperationalStatus
  capabilityDueAt: string | null
  capabilityIntervalDays: number | null
  notes: string | null
}

// ── Summary ───────────────────────────────────────────────────────────────────

export interface ToolsSummary {
  total: number
  active: number
  inactive: number
  by_operational_status: Record<string, number>
  expired_count: number
}

// ── Mutation payload types ────────────────────────────────────────────────────

/** POST /api/tools */
export interface ToolCreatePayload {
  registration_id: string
  model: string
  operation: string
  nominal_torque_nm: number
  tool_class: string
  operational_status: OperationalStatus
  notes?: string | null
  capability_due_at?: string | null
  capability_interval_days?: number | null
}

/** PATCH /api/tools/{id} — all fields optional */
export interface ToolPatchPayload {
  model?: string
  operation?: string
  nominal_torque_nm?: number
  tool_class?: string
  operational_status?: OperationalStatus
  notes?: string | null
  capability_due_at?: string | null
  capability_interval_days?: number | null
}

/** POST /api/tools/{id}/capability-studies */
export interface CapabilityStudyCreatePayload {
  analysis_type: string
  cm?: number | null
  cmk?: number | null
  cp?: number | null
  cpk?: number | null
  lsl?: number | null
  usl?: number | null
  sample_count?: number | null
  method?: string | null
  source?: string | null
  study_date: string
}

// ── Mapping helper ────────────────────────────────────────────────────────────

/**
 * Map raw ApiTool → ToolTrackingRecord.
 * Status from effective_status — never derived from cm/cmk.
 */
export function mapApiTool(tool: ApiTool): ToolTrackingRecord {
  return {
    id: String(tool.id),
    registrationId: tool.registration_id,
    model: tool.model,
    operation: tool.operation,
    nominalTorqueNm: tool.nominal_torque_nm,
    toolClass: tool.tool_class,
    status: tool.effective_status as ToolStatus,
    operationalStatus: tool.operational_status as OperationalStatus,
    capabilityDueAt: tool.capability_due_at,
    capabilityIntervalDays: tool.capability_interval_days,
    notes: tool.notes,
    cm: tool.latest_study?.cm ?? null,
    cmk: tool.latest_study?.cmk ?? null,
    lastCapabilityDate: tool.latest_study?.study_date
      ? tool.latest_study.study_date.slice(0, 10)
      : null,
  }
}
