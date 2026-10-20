import { describe, it, expect } from 'vitest'
import { calculateContactPressure } from './contactPressureCalc'

const PI_OVER_4 = Math.PI / 4

describe('VDI-ENG-04D — calculateContactPressure', () => {

  // ── CASE 1: Approved validation case ─────────────────────────────────────
  // D_outer=17mm, d_h=11mm, F_M=40kN
  // A_contact = π/4 × (17² - 11²) = π/4 × 168 = 131.9469... mm²
  // p_avg = 40000 / A_contact = 303.15... MPa
  it('CASE 1 — nominal: D_outer=17 d_h=11 FM=40', () => {
    const r = calculateContactPressure(17, 11, 40)
    expect(r).not.toBeNull()

    const expectedA = PI_OVER_4 * (17 ** 2 - 11 ** 2)
    expect(r!.A_contact_mm2).toBeCloseTo(expectedA, 9)
    expect(r!.A_contact_mm2).toBeCloseTo(131.9469, 3)

    const expectedP = 40000 / expectedA
    expect(r!.p_avg_MPa).toBeCloseTo(expectedP, 9)
    expect(r!.p_avg_MPa).toBeCloseTo(303.15, 1)

    expect(r!.F_contact_N).toBeCloseTo(40000, 9)
    expect(r!.D_outer_mm).toBe(17)
    expect(r!.d_h_mm).toBe(11)
  })

  // ── CASE 2: D_outer === d_h → invalid geometry ───────────────────────────
  it('CASE 2 — D_outer === d_h → null (zero area)', () => {
    expect(calculateContactPressure(15, 15, 40)).toBeNull()
  })

  // ── CASE 3: D_outer < d_h → reversed / invalid ───────────────────────────
  it('CASE 3 — D_outer < d_h → null (reversed diameters)', () => {
    expect(calculateContactPressure(10, 15, 40)).toBeNull()
  })

  // ── CASE 4: D_outer <= 0 or d_h <= 0 → null ──────────────────────────────
  it('CASE 4a — D_outer=0 → null', () => {
    expect(calculateContactPressure(0, 11, 40)).toBeNull()
  })

  it('CASE 4b — D_outer<0 → null', () => {
    expect(calculateContactPressure(-5, 11, 40)).toBeNull()
  })

  it('CASE 4c — d_h=0 → null', () => {
    expect(calculateContactPressure(17, 0, 40)).toBeNull()
  })

  it('CASE 4d — d_h<0 → null', () => {
    expect(calculateContactPressure(17, -3, 40)).toBeNull()
  })

  // ── CASE 5: F_contact <= 0 → no pressure conclusion ─────────────────────
  it('CASE 5a — FM=0 → null', () => {
    expect(calculateContactPressure(17, 11, 0)).toBeNull()
  })

  it('CASE 5b — FM<0 → null', () => {
    expect(calculateContactPressure(17, 11, -10)).toBeNull()
  })

  // ── REGRESSION: A_contact formula parity ─────────────────────────────────
  it('REGRESSION — A_contact = π/4 × (D_outer² - d_h²)', () => {
    const D = 20, dh = 12
    const r = calculateContactPressure(D, dh, 30)
    expect(r).not.toBeNull()
    expect(r!.A_contact_mm2).toBeCloseTo(PI_OVER_4 * (D ** 2 - dh ** 2), 9)
  })

  // ── REGRESSION: p_avg = F_N / A_contact (1 N/mm² = 1 MPa) ───────────────
  it('REGRESSION — p_avg = F_N / A_contact', () => {
    const r = calculateContactPressure(20, 12, 30)
    expect(r).not.toBeNull()
    const expectedA = PI_OVER_4 * (20 ** 2 - 12 ** 2)
    expect(r!.p_avg_MPa).toBeCloseTo(30000 / expectedA, 9)
  })

})
