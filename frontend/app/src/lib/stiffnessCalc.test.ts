import { describe, it, expect } from 'vitest'
import { calculateStiffness } from './stiffnessCalc'

// Reference compliance values from DEFAULT inputs (v_plaka=10, v_boy=40, Steel E=210 GPa):
//   db = 40 / (210000 × 78.5) = 2.4264...e-6 mm/N
//   dp = 10 / (210000 × 100 ) = 4.7619...e-7 mm/N
const DB = 40 / (210000 * 78.5)
const DP = 10 / (210000 * 100)

describe('VDI-ENG-04C — calculateStiffness', () => {

  // ── CASE 1: Stiffness from DEFAULT bolt/plate geometry ────────────────────
  it('CASE 1 — stiffness units: c_b = 1/(db×1000), c_p = 1/(dp×1000)', () => {
    const r = calculateStiffness(DB, DP, 40, 1, 36)
    expect(r.c_b).toBeCloseTo(1 / (DB * 1000), 9)
    expect(r.c_p).toBeCloseTo(1 / (DP * 1000), 9)
  })

  // ── CASE 2: Preload displacements (FM = 40 kN) ───────────────────────────
  it('CASE 2 — preload displacements: δ = FM × 1e6 × compliance', () => {
    const r = calculateStiffness(DB, DP, 40, 1, 36)
    expect(r.f_b_preload_um).toBeCloseTo(40 * 1e6 * DB, 6)
    expect(r.f_p_preload_um).toBeCloseTo(40 * 1e6 * DP, 6)
    // Bolt is softer than plate → bolt elongation > plate compression
    expect(r.f_b_preload_um).toBeGreaterThan(r.f_p_preload_um)
  })

  // ── CASE 3: Operating displacements ──────────────────────────────────────
  it('CASE 3 — operating: bolt = (FM+ΔFb)×db×1e6, clamp = FK_res×dp×1e6', () => {
    const r = calculateStiffness(DB, DP, 40, 1, 36)
    expect(r.f_b_operating_um).toBeCloseTo(41 * 1e6 * DB, 6)
    expect(r.f_p_operating_um).toBeCloseTo(36 * 1e6 * DP, 6)
    // Operating bolt elongation > preload (bolt loaded further)
    expect(r.f_b_operating_um).toBeGreaterThan(r.f_b_preload_um)
    // Operating plate compression < preload (clamp force reduced)
    expect(r.f_p_operating_um).toBeLessThan(r.f_p_preload_um)
  })

  // ── CASE 4: Operating opening displacement Δδ_op ─────────────────────────
  it('CASE 4 — delta_op_um = ΔFb × db × 1e6  (= ΔFb / c_b in μm)', () => {
    const r = calculateStiffness(DB, DP, 40, 1, 36)
    const expected = 1 * 1e6 * DB
    expect(r.delta_op_um).toBeCloseTo(expected, 9)
    // Also verify via c_b: ΔFb / c_b gives mm → convert to μm
    expect(r.delta_op_um).toBeCloseTo((1 / r.c_b) * 1000, 6)
  })

  // ── CASE 5: Separated joint — f_p_operating clamps to 0 ──────────────────
  it('CASE 5 — FK_res < 0 → f_p_operating_um = 0 (no negative compression)', () => {
    const r = calculateStiffness(DB, DP, 40, 1, -5)
    expect(r.f_p_operating_um).toBe(0)
  })

  // ── CASE 6: FK_res exactly 0 (separation boundary) ───────────────────────
  it('CASE 6 — FK_res = 0 → f_p_operating_um = 0', () => {
    const r = calculateStiffness(DB, DP, 40, 1, 0)
    expect(r.f_p_operating_um).toBe(0)
  })

})
