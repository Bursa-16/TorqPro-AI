import { describe, it, expect } from 'vitest'
import { calculateAxialStress } from './axialStressCalc'

describe('VDI-ENG-04A — calculateAxialStress', () => {

  // ── CASE 1: Approved validation case ─────────────────────────────────────
  // FM=40 kN, ΔFb=0.82 kN, As=58 mm², Rp0.2=900 MPa
  it('CASE 1 — BELOW_RP02: FM=40 ΔFb=0.82 As=58 Rp0.2=900', () => {
    const r = calculateAxialStress(40, 0.82, 58, 900)
    expect(r).not.toBeNull()
    // F_b,op = 40 + 0.82 = 40.82 kN
    expect(r!.FB_op_kN).toBeCloseTo(40.82, 9)
    // σ_axial = 40820 / 58 = 703.793103... MPa
    expect(r!.sigma_axial).toBeCloseTo(40820 / 58, 9)
    // η_axial = 703.793.../900 = 0.781992...
    expect(r!.eta_axial).toBeCloseTo((40820 / 58) / 900, 9)
    expect(r!.status).toBe('BELOW_RP02')
  })

  // ── CASE 2: At boundary σ = Rp0.2 ────────────────────────────────────────
  it('CASE 2 — AT_RP02_BOUNDARY: σ_axial exactly = Rp0.2', () => {
    // Choose As and FM so that σ_axial = exactly Rp0.2 = 900 MPa
    // F_b,op = 900 × As / 1000 kN; use As=100 → F_b,op = 90 kN
    const r = calculateAxialStress(90, 0, 100, 900)
    expect(r).not.toBeNull()
    // σ = 90000/100 = 900.0 MPa
    expect(r!.sigma_axial).toBeCloseTo(900, 9)
    expect(r!.status).toBe('AT_RP02_BOUNDARY')
    expect(r!.eta_axial).toBeCloseTo(1.0, 9)
  })

  // ── CASE 3: Above Rp0.2 ──────────────────────────────────────────────────
  it('CASE 3 — ABOVE_RP02: σ_axial > Rp0.2', () => {
    // F_b,op = 100 kN, As=100 mm² → σ = 1000 > 900
    const r = calculateAxialStress(100, 0, 100, 900)
    expect(r).not.toBeNull()
    expect(r!.sigma_axial).toBeCloseTo(1000, 9)
    expect(r!.status).toBe('ABOVE_RP02')
    expect(r!.eta_axial).toBeGreaterThan(1.0)
  })

  // ── CASE 4: FM=0 → null ───────────────────────────────────────────────────
  it('CASE 4 — FM=0 → null', () => {
    expect(calculateAxialStress(0, 0.82, 58, 900)).toBeNull()
  })

  it('CASE 4 variant — FM<0 → null', () => {
    expect(calculateAxialStress(-10, 0.82, 58, 900)).toBeNull()
  })

  // ── CASE 5: As=0 → null ───────────────────────────────────────────────────
  it('CASE 5 — As=0 → null (avoid division by zero)', () => {
    expect(calculateAxialStress(40, 0.82, 0, 900)).toBeNull()
  })

  // ── CASE 6: Rp0.2=0 → null ───────────────────────────────────────────────
  it('CASE 6 — Rp0.2=0 → null', () => {
    expect(calculateAxialStress(40, 0.82, 58, 0)).toBeNull()
  })

  // ── REGRESSION: ΔFb=0 still produces correct axial stress ────────────────
  it('REGRESSION — ΔFb=0: sigma = FM×1000/As', () => {
    const r = calculateAxialStress(40, 0, 58, 900)
    expect(r).not.toBeNull()
    expect(r!.FB_op_kN).toBeCloseTo(40, 9)
    expect(r!.sigma_axial).toBeCloseTo(40000 / 58, 9)
  })

})
