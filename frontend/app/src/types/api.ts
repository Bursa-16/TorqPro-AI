// TorqPro API Types — derived from backend/app.py contracts

export interface LoginRequest { username: string; password: string }
export interface LoginResponse { token: string; display_name: string; role: string; expires_in: number }
export interface HealthResponse { status: string; version: string; database_ok: boolean; server_time: string }

export interface Calculation {
  id: number; record_no: string; user_id: number; created_at: string
  family: string | null; standard: string | null; thread: string | null; property_class: string | null
  nut: string | null; washer: string | null; coating: string | null
  mu_thread: number | null; mu_bearing: number | null; preload_ratio: number | null
  torque_nm: number | null; preload_n: number | null; confidence: number | null
  engagement_mm: number | null; internal_material: string | null
  bearing_limit_mpa: number | null; source_mode: string | null
}

export interface EngineeringCheckRequest {
  diameter_mm: number; pitch_mm: number; stress_area_mm2: number; rp02_mpa: number
  target_yield_ratio: number
  mu_thread_min: number; mu_thread_nom: number; mu_thread_max: number
  mu_bearing_min: number; mu_bearing_nom: number; mu_bearing_max: number
  effective_bearing_diameter_mm: number; engagement_mm: number
  internal_rm_mpa: number; bolt_rm_mpa: number; nut_proof_mpa: number
}

export interface EngineeringCheckResult {
  preload_n: number
  torque_min_nm: number; torque_nom_nm: number; torque_max_nm: number
  nut_proof_util_pct: number; internal_thread_sf: number; external_thread_sf: number
}

export interface SystemInfo {
  status: string; version: string; database_ok: boolean; database_size_kb: number
  total_users: number; active_users: number; calculation_count: number
  audit_count: number; schema_version: number; server_time: string
}

export type UserRole = 'admin' | 'engineer' | 'viewer'
export interface AuthUser { id: number; username: string; display_name: string; role: UserRole; is_active: number }
export type FeatureStatus = 'ready' | 'beta' | 'planned'
export type EngineeringStatus = 'validated' | 'calculated' | 'warning' | 'error' | 'draft' | 'review' | 'ai_assisted'
