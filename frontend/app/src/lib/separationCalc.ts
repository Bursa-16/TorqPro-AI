/**
 * VDI-ENG-04B — Residual Clamp Force / Separation Check
 * CLASSIFICATION: CALCULATED_RESULT
 *
 * Formulas (all values in kN):
 *   DeltaFb = n × phi × FA           — additional bolt force
 *   DeltaFk = n × (1 − phi) × FA     — clamp force loss
 *   FK_res  = FM − DeltaFk            — residual clamp force
 *   FA_sep  = FM / ((1 − phi) × n)   — separation load limit (when denominator > 0)
 *
 * FM ≤ 0 → returns null (no separation conclusion).
 */

export const SEP_EPS = 1e-6

export type SeparationStatus = 'CLAMPED' | 'SEPARATION_BOUNDARY' | 'SEPARATED'

export interface SeparationResult {
  deltaFb:  number          // kN — additional bolt force  n×phi×FA
  deltaFk:  number          // kN — clamp force loss       n×(1−phi)×FA
  FK_res:   number          // kN — residual clamp force   FM − deltaFk
  FA_sep:   number | null   // kN — separation load limit  FM/((1−phi)×n); null if denom ≤ 0
  status:   SeparationStatus
}

/**
 * @param FM   Assembly preload (kN) — must be > 0 for a result
 * @param phi  Load distribution factor Φ — from calculate()
 * @param n    Load introduction factor n — inputs.v_n
 * @param FA   Operating load (kN) — inputs.v_FA
 */
export function calculateSeparation(
  FM: number,
  phi: number,
  n: number,
  FA: number,
): SeparationResult | null {
  if (FM <= 0) return null

  const deltaFb = n * phi * FA
  const deltaFk = n * (1 - phi) * FA
  const FK_res  = FM - deltaFk

  const denom = (1 - phi) * n
  const FA_sep = denom > SEP_EPS ? FM / denom : null

  let status: SeparationStatus
  if      (FK_res > SEP_EPS)             status = 'CLAMPED'
  else if (Math.abs(FK_res) <= SEP_EPS)  status = 'SEPARATION_BOUNDARY'
  else                                   status = 'SEPARATED'

  return { deltaFb, deltaFk, FK_res, FA_sep, status }
}
