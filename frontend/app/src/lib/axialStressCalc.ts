/**
 * VDI-ENG-04A — Operating Axial Stress + Rp0.2 Utilization
 * CLASSIFICATION: CALCULATED_RESULT
 *
 * Scope: axial operating-stress assessment only.
 * Tightening torsion is NOT included.
 * This is NOT an equivalent-stress calculation.
 * This is NOT a full VDI 2230 yield assessment.
 *
 * Formulas (all values in stated units):
 *   F_b,op  = FM + ΔFb                         — operating bolt force (kN)
 *   σ_axial = (F_b,op × 1000) / A_s            — operating axial stress (MPa)
 *   η_axial = σ_axial / Rp0.2                  — axial utilization vs yield stress
 *
 * FM ≤ 0, A_s ≤ 0, or Rp0.2 ≤ 0 → returns null (no conclusion).
 */

export const AXIAL_EPS = 1e-6

export type AxialStatus = 'BELOW_RP02' | 'AT_RP02_BOUNDARY' | 'ABOVE_RP02'

export interface AxialStressResult {
  FB_op_kN:    number        // kN  — operating bolt force  FM + ΔFb
  sigma_axial: number        // MPa — operating axial stress (F_b,op × 1000) / A_s
  eta_axial:   number        // —   — axial utilization      σ_axial / Rp0.2
  status:      AxialStatus
}

/**
 * @param FM_kN      Assembly preload (kN)         — must be > 0
 * @param deltaFb_kN Additional bolt force (kN)    — SeparationResult.deltaFb
 * @param As_mm2     Tensile stress area (mm²)     — must be > 0
 * @param Rp02_mpa   0.2% proof/yield stress (MPa) — must be > 0
 */
export function calculateAxialStress(
  FM_kN:      number,
  deltaFb_kN: number,
  As_mm2:     number,
  Rp02_mpa:   number,
): AxialStressResult | null {
  if (FM_kN <= 0 || As_mm2 <= 0 || Rp02_mpa <= 0) return null

  const FB_op_kN    = FM_kN + deltaFb_kN
  const sigma_axial = (FB_op_kN * 1000) / As_mm2
  const eta_axial   = sigma_axial / Rp02_mpa

  let status: AxialStatus
  if      (sigma_axial < Rp02_mpa - AXIAL_EPS)              status = 'BELOW_RP02'
  else if (Math.abs(sigma_axial - Rp02_mpa) <= AXIAL_EPS)   status = 'AT_RP02_BOUNDARY'
  else                                                        status = 'ABOVE_RP02'

  return { FB_op_kN, sigma_axial, eta_axial, status }
}
