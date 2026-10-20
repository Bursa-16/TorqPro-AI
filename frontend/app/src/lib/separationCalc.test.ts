import { describe, it, expect } from 'vitest'
import { calculateSeparation } from './separationCalc'

describe('VDI-ENG-04B — calculateSeparation', () => {

  // ── CASE 1: Typical clamped joint ────────────────────────────────────────
  it('CASE 1 — CLAMPED: FM=40 phi=0.20 n=0.50 FA=10 kN', () => {
    const r = calculateSeparation(40, 0.20, 0.50, 10)
    expect(r).not.toBeNull()
    // DeltaFb = 0.50 × 0.20 × 10 = 1.0 kN
    expect(r!.deltaFb).toBeCloseTo(1.0,  9)
    // DeltaFk = 0.50 × 0.80 × 10 = 4.0 kN
    expect(r!.deltaFk).toBeCloseTo(4.0,  9)
    // FK_res  = 40 − 4.0          = 36.0 kN
    expect(r!.FK_res ).toBeCloseTo(36.0, 9)
    expect(r!.status ).toBe('CLAMPED')
  })

  // ── CASE 2: Separation boundary FA = FM / ((1−phi)×n) = 100 kN ──────────
  it('CASE 2 — SEPARATION_BOUNDARY: FA = FA_sep = 100 kN', () => {
    // FA_sep = 40 / ((1−0.20)×0.50) = 40 / 0.40 = 100 kN
    const FA_sep = 40 / ((1 - 0.20) * 0.50)
    expect(FA_sep).toBeCloseTo(100, 9)

    const r = calculateSeparation(40, 0.20, 0.50, FA_sep)
    expect(r).not.toBeNull()
    expect(r!.FA_sep).toBeCloseTo(100.0, 9)
    // FK_res = 40 − 0.5×0.8×100 = 40 − 40 = 0
    expect(r!.FK_res).toBeCloseTo(0.0,   9)
    expect(r!.status).toBe('SEPARATION_BOUNDARY')
  })

  // ── CASE 3: FA > FA_sep → separated ──────────────────────────────────────
  it('CASE 3 — SEPARATED: FA = 101 kN (> FA_sep 100 kN)', () => {
    const r = calculateSeparation(40, 0.20, 0.50, 101)
    expect(r).not.toBeNull()
    // FK_res = 40 − 0.5×0.8×101 = 40 − 40.4 = −0.4
    expect(r!.FK_res).toBeLessThan(0)
    expect(r!.status).toBe('SEPARATED')
  })

  // ── CASE 4: FM missing / zero → no conclusion ────────────────────────────
  it('CASE 4 — FM=0 → null (no conclusion)', () => {
    expect(calculateSeparation(0, 0.20, 0.50, 10)).toBeNull()
  })

  it('CASE 4 variant — FM<0 → null', () => {
    expect(calculateSeparation(-5, 0.20, 0.50, 10)).toBeNull()
  })

  // ── REGRESSION GUARD: DeltaFb ≠ DeltaFk (semantic distinction) ───────────
  it('REGRESSION: deltaFb and deltaFk are semantically distinct', () => {
    const r = calculateSeparation(40, 0.20, 0.50, 10)!
    // DeltaFb = n×phi×FA, DeltaFk = n×(1−phi)×FA — not equal when phi ≠ 0.5
    expect(r.deltaFb).not.toEqual(r.deltaFk)
    expect(r.deltaFb).toBeCloseTo(1.0, 9)
    expect(r.deltaFk).toBeCloseTo(4.0, 9)
  })

  // ── FA_sep denominator guard ──────────────────────────────────────────────
  it('FA_sep is null when denominator ≤ 0 (phi=1, n>0)', () => {
    const r = calculateSeparation(40, 1.0, 0.50, 10)!
    expect(r.FA_sep).toBeNull()
  })

})
