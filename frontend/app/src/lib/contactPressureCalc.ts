/**
 * VDI-ENG-04D — Average Bearing / Contact Pressure
 * CLASSIFICATION: CALCULATED_RESULT
 *
 * Scope: assembly average bearing pressure only.
 * This is NOT a radial pressure distribution.
 * This is NOT a contact-mechanics (FEA) result.
 * This is NOT a contact safety check — no pass/fail limit is applied.
 *
 * Formula:
 *   A_contact = π/4 × (D_outer² - d_h²)            — annular contact area (mm²)
 *   p_avg     = F_contact_N / A_contact              — average bearing pressure (MPa = N/mm²)
 *
 * D_outer and d_h MUST be explicit user-supplied inputs.
 * D_w (effective bearing diameter) is NOT a substitute for D_outer.
 * No geometry is derived from nominal bolt diameter.
 *
 * Contact force: F_M (assembly preload) — audited as physically appropriate for
 * under-head / under-nut bearing contact at assembly (VDI-ENG-04D-AUDIT-01).
 */

export interface ContactPressureResult {
  A_contact_mm2: number   // mm² — annular bearing area
  p_avg_MPa:    number    // MPa — average bearing pressure (1 N/mm² = 1 MPa)
  F_contact_N:  number    // N   — contact force used (F_M converted from kN)
  D_outer_mm:   number    // mm  — outer bearing diameter (echoed for traceability)
  d_h_mm:       number    // mm  — clearance-hole diameter (echoed for traceability)
}

/**
 * @param D_outer_mm  Outer bearing/contact diameter (mm)  — must be > d_h_mm > 0
 * @param d_h_mm      Clearance-hole / through-hole diameter (mm)  — must be > 0
 * @param FM_kN       Assembly preload F_M (kN)  — must be > 0
 * @returns ContactPressureResult | null  (null on invalid geometry or zero force)
 */
export function calculateContactPressure(
  D_outer_mm: number,
  d_h_mm:     number,
  FM_kN:      number,
): ContactPressureResult | null {
  if (D_outer_mm <= 0 || d_h_mm <= 0) return null
  if (D_outer_mm <= d_h_mm)           return null   // D_outer must strictly exceed d_h
  if (FM_kN <= 0)                     return null

  const F_contact_N   = FM_kN * 1000
  const A_contact_mm2 = (Math.PI / 4) * (D_outer_mm ** 2 - d_h_mm ** 2)
  const p_avg_MPa     = F_contact_N / A_contact_mm2

  return { A_contact_mm2, p_avg_MPa, F_contact_N, D_outer_mm, d_h_mm }
}
