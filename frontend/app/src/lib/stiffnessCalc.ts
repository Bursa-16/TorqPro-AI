/**
 * VDI-ENG-04C — Joint Stiffness Working Diagram
 * CLASSIFICATION: CALCULATED_RESULT
 *
 * Derives bolt and plate stiffness (kN/mm) from compliances (mm/N),
 * then computes preload and operating displacements for the working diagram.
 *
 * Formulas (forces in kN, compliances in mm/N, stiffnesses in kN/mm, displacements in μm):
 *   c_b  = 1 / (db × 1000)               — bolt stiffness
 *   c_p  = 1 / (dp × 1000)               — plate stiffness
 *   δ_b  = FM × 1e6 × db                 — bolt elongation at preload
 *   δ_p  = FM × 1e6 × dp                 — plate compression at preload
 *   Δδ_op = ΔFb × 1e6 × db              — joint opening at operating point
 */

export interface StiffnessResult {
  c_b:              number  // kN/mm — bolt stiffness
  c_p:              number  // kN/mm — plate/clamp stiffness
  f_b_preload_um:   number  // μm    — bolt elongation at preload FM
  f_p_preload_um:   number  // μm    — plate compression at preload FM
  f_b_operating_um: number  // μm    — bolt elongation at FM + ΔFb
  f_p_operating_um: number  // μm    — plate compression at max(0, FK_res)
  delta_op_um:      number  // μm    — joint opening at operating point
}

/**
 * @param db      Bolt compliance  (mm/N) — VdiResult.db
 * @param dp      Plate compliance (mm/N) — VdiResult.dp
 * @param FM      Assembly preload (kN)   — must be > 0
 * @param deltaFb Additional bolt force   (kN) — SeparationResult.deltaFb
 * @param FK_res  Residual clamp force    (kN) — SeparationResult.FK_res
 */
export function calculateStiffness(
  db: number,
  dp: number,
  FM: number,
  deltaFb: number,
  FK_res: number,
): StiffnessResult {
  const c_b = 1 / (db * 1000)
  const c_p = 1 / (dp * 1000)

  const f_b_preload_um   = FM * 1e6 * db
  const f_p_preload_um   = FM * 1e6 * dp
  const f_b_operating_um = (FM + deltaFb) * 1e6 * db
  const f_p_operating_um = Math.max(0, FK_res) * 1e6 * dp
  const delta_op_um      = deltaFb * 1e6 * db

  return {
    c_b,
    c_p,
    f_b_preload_um,
    f_p_preload_um,
    f_b_operating_um,
    f_p_operating_um,
    delta_op_um,
  }
}
