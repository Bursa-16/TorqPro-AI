/**
 * VISUAL-02C-A — Gelişmiş Bağlantı Analizi / VDI 2230
 *
 * Pure frontend calculation — no backend API call.
 * Exact parity with legacy vdiHesapla() function.
 *
 * AUDIT FINDINGS:
 * - 4 inputs + 1 material select = 5 total fields
 * - Pure JS calculation: δp, δb, Φ, ΔFb, evaluation
 * - No /api call in legacy — confirmed
 * - No chart data available (all outputs are scalars)
 * - Visualization: Φ factor as SVG compliance diagram
 *
 * DEFERRED (no data available):
 * - Load Distribution chart (no multi-point data)
 * - Pressure Distribution (no spatial data)
 * - Preload vs External Load chart (no time-series data)
 * - Safety against yielding (not in legacy calculation)
 * - Safety against separation (not in legacy calculation)
 * - Joint stiffness (δp/δb available but no stiffness ratio)
 *
 * ── ENGINEERING IMPLEMENTATION ROADMAP ───────────────────────────────────────
 *
 * VDI-ENG-04A — Yield Safety (Akma Emniyeti)
 *   REQUIRED_INPUTS        = Rp0.2 (MPa), tightening torque Manz, Φ, preload Fv
 *   REQUIRED_FORMULA       = VDI 2230 R11: σred ≤ Rp0.2/SF_y; σred = √(σz²+3τ²)
 *   CURRENT_MISSING_DATA   = σz, τ per bolt from backend; SF_y threshold
 *   BACKEND_CHANGE_REQUIRED= YES — extend /api/engineering-check to return σz, τ
 *   FRONTEND_VISUAL_REQUIRED= Gauge or threshold bar (CALCULATED_RESULT)
 *   VALIDATION_NEEDED      = YES — verify σred formula against VDI 2230 R11 Table A2
 *
 * VDI-ENG-04B — Separation Safety (Ayrılma Emniyeti)
 *   REQUIRED_INPUTS        = Fv (preload), FK (additional bolt force), n, Φ
 *   REQUIRED_FORMULA       = VDI 2230 R12: FKA = Fv – (1–Φ)·FA ≥ 0 (no joint opening)
 *   CURRENT_MISSING_DATA   = Fv from backend (EngineeringCheckResult.preload_n available); FK=n·Φ·FA derivable
 *   BACKEND_CHANGE_REQUIRED= NO — FKA derivable from existing frontend inputs + Fv
 *   FRONTEND_VISUAL_REQUIRED= StatusBadge pass/fail + scalar FKA (kN)
 *   VALIDATION_NEEDED      = YES — confirm FKA formula against VDI 2230 R12
 *
 * VDI-ENG-04C — Joint Stiffness Curves (Bağlantı Rijitlik Eğrisi)
 *   REQUIRED_INPUTS        = δp, δb (already computed), Fv, FA range
 *   REQUIRED_FORMULA       = F_bolt(FA) = Fv + Φ·n·FA; F_clamping(FA) = Fv – (1–Φ)·n·FA
 *   CURRENT_MISSING_DATA   = Fv from backend per joint; multi-load-step data
 *   BACKEND_CHANGE_REQUIRED= NO — both curves derivable from frontend scalars
 *   FRONTEND_VISUAL_REQUIRED= LineChart with two series (CALCULATED_RESULT)
 *   VALIDATION_NEEDED      = YES — confirm Fv magnitude consistent with torque calc
 *
 * VDI-ENG-04D — Contact Pressure Distribution (Temas Basıncı Dağılımı)
 *   REQUIRED_INPUTS        = Fv, bearing area A_bearing (from Dw, hole diameter)
 *   REQUIRED_FORMULA       = p_mean = Fv / A_bearing; cone half-angle ≈ 25–33° per VDI
 *   CURRENT_MISSING_DATA   = A_bearing not yet in EngineeringCheckResult; hole diameter input missing
 *   BACKEND_CHANGE_REQUIRED= YES — expose A_bearing or add hole_diam_mm input
 *   FRONTEND_VISUAL_REQUIRED= Annotated SVG showing pressure magnitude (CALCULATED_RESULT, NOT qualitative)
 *   VALIDATION_NEEDED      = YES — distinguish from current qualitative schematic (qualitative vs. quantitative)
 *
 * RECOMMENDED_ORDER: 04B (no backend change) → 04C (no backend change) → 04A → 04D
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { Wrench, CheckCircle, Info, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '../components/ui/Button'
import StatusBadge from '../components/ui/StatusBadge'
import ModuleGuideDrawer from '../components/guidance/ModuleGuideDrawer'
import { advancedAnalysisGuide } from '../guides/advancedAnalysisGuide'
import { EV } from '../components/engineering-visuals/engineeringVisualTokens'
import { useLanguage } from '../i18n/LanguageContext'
import AdvancedConnectionContextDiagram, {
  type AdvancedContextKey,
} from '../components/engineering/AdvancedConnectionContextDiagram'
import FKvsFA from '../components/charts/FKvsFA'
import JointStiffness from '../components/charts/JointStiffness'
import ContactPressureSchematic from '../components/engineering/ContactPressureSchematic'
import { calculateSeparation, type SeparationResult, type SeparationStatus } from '../lib/separationCalc'
import { calculateStiffness, type StiffnessResult } from '../lib/stiffnessCalc'
import { calculateAxialStress, type AxialStressResult, type AxialStatus } from '../lib/axialStressCalc'
import { calculateContactPressure, type ContactPressureResult } from '../lib/contactPressureCalc'

// ── Types ─────────────────────────────────────────────────────────────────────
interface VdiInputs {
  v_plaka: number      // Plate thickness (mm)
  v_boy: number        // Bolt length (mm)
  v_n: number          // Load introduction factor n
  v_FA: number         // Operating load FA (kN)
  v_FM: number         // Assembly preload FM (kN) — explicit user input, 0 = not provided
  v_dT: number         // ΔT temperature delta (°C) — display only, not in calculation
  v_malzeme: string    // Material (value always in TR to preserve calculation)
  v_AS: number         // Tensile stress area A_s (mm²) — VDI-ENG-04A
  v_rp02: number       // 0.2% proof/yield stress Rp0.2 (MPa) — VDI-ENG-04A
  v_dOuter: number     // Outer bearing diameter D_outer (mm) — VDI-ENG-04D
  v_dH: number         // Clearance-hole diameter d_h (mm) — VDI-ENG-04D
}

interface VdiResult {
  dp: number           // Plate compliance (mm/N)
  db: number           // Bolt compliance (mm/N)
  phi: number          // Load distribution factor Φ
  FK: number           // Additional bolt force ΔFb (N)
  optimal: boolean     // Φ < 0.2
}

// ── Defaults (exact match to legacy) ─────────────────────────────────────────
const DEFAULTS: VdiInputs = {
  v_plaka: 10,
  v_boy: 40,
  v_n: 0.5,
  v_FA: 15,
  v_FM: 0,      // 0 = not provided; no separation result until user enters a value
  v_dT: 0,
  v_malzeme: 'Çelik (E=210 GPa)',
  v_AS: 58,     // mm² — M10 tensile stress area (VDI-ENG-04A default)
  v_rp02: 900,  // MPa — 10.9 bolt class proof stress (VDI-ENG-04A default)
  v_dOuter: 17, // mm — example outer bearing diameter; must be verified by user (VDI-ENG-04D)
  v_dH: 11,     // mm — example clearance-hole diameter; must be verified by user (VDI-ENG-04D)
}

// ── Panel persistence ──────────────────────────────────────────────────────────
const COLLAPSED_KEY = 'torqpro_advanced_context_collapsed'
const WIDTH_KEY     = 'torqpro_advanced_context_width'
const DEFAULT_WIDTH = 400
const MIN_WIDTH     = 300
const MAX_WIDTH     = 540

function clampWidth(w: number): number {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w))
}

// ── Calculation (exact parity with vdiHesapla()) ─────────────────────────────
// HARD RULE: do NOT modify these formulas.
function calculate(inputs: VdiInputs): VdiResult {
  const Ep = inputs.v_malzeme.includes('Alüm') ? 70000 : 210000
  const t  = inputs.v_plaka
  const L  = inputs.v_boy
  const n  = inputs.v_n
  const FA = inputs.v_FA * 1000 // kN → N

  const dp  = t / (Ep * 100)
  const db  = L / (210000 * 78.5)
  const phi = dp / (dp + db)
  const FK  = n * phi * FA

  return { dp, db, phi, FK, optimal: phi < 0.2 }
}

// ── Compliance diagram ────────────────────────────────────────────────────────
function ComplianceDiagram({
  result, ariaLabel,
}: { result: VdiResult | null; ariaLabel: string }) {
  const phi = result?.phi ?? 0
  const x   = Math.min(phi * 260 + 10, 268)
  const needleColor = result ? EV.computedResult : EV.schematicNote

  return (
    <svg viewBox="0 0 260 104" className="w-full" aria-label={ariaLabel} role="img">
      {/* Light engineering canvas background */}
      <rect x="0" y="0" width="260" height="104" rx="4" fill={EV.canvasBackground} />
      {/* Track */}
      <rect x="10" y="38" width="240" height="12" rx="3" fill={EV.holeVoidFill} />
      {/* Guidance-reference zone tints — not authoritative status bands */}
      <rect x="10"  y="38" width="130" height="12" rx="3" fill={EV.guidance} opacity="0.15" />
      <rect x="140" y="38" width="60"  height="12" rx="0" fill={EV.guidance} opacity="0.10" />
      <rect x="200" y="38" width="50"  height="12" rx="3" fill={EV.guidance} opacity="0.08" />
      {/* Needle */}
      {result && (
        <line x1={x} y1="28" x2={x} y2="62"
          stroke={needleColor} strokeWidth="2.5" strokeLinecap="round" />
      )}
      {/* Scale labels */}
      <text x="10"  y="75" fill={EV.schematicNote} fontSize="9" textAnchor="start">0</text>
      <text x="130" y="75" fill={EV.schematicNote} fontSize="9" textAnchor="middle">0.5</text>
      <text x="250" y="75" fill={EV.schematicNote} fontSize="9" textAnchor="end">1.0</text>
      {/* Guidance reference markers (not authoritative thresholds) */}
      <line x1="64" y1="32" x2="64" y2="44"
        stroke={EV.guidance} strokeWidth="1" strokeDasharray="2,2" />
      <text x="64" y="31" fill={EV.guidance} fontSize="8" textAnchor="middle">0.2</text>
      <line x1="97" y1="32" x2="97" y2="44"
        stroke={EV.guidance} strokeWidth="1" strokeDasharray="2,2" />
      <text x="97" y="31" fill={EV.guidance} fontSize="8" textAnchor="middle">0.35</text>
      {/* Φ computed result label */}
      <text x="130" y="98" fill={needleColor}
        fontSize="12" fontWeight="700" textAnchor="middle">
        {result ? `Φ = ${result.phi.toFixed(3)}` : 'Φ = —'}
      </text>
    </svg>
  )
}

// ── Field component ───────────────────────────────────────────────────────────
// onFocus/onClick set context — no calculation triggered.
function F({
  label, field, unit, type = 'number', inputs, onChange, onContextChange,
}: {
  label: string
  field: keyof VdiInputs
  unit?: string
  type?: 'number' | 'text'
  inputs: VdiInputs
  onChange: (f: keyof VdiInputs, v: string) => void
  onContextChange: (key: AdvancedContextKey) => void
}) {
  const FIELD_CTX: Partial<Record<keyof VdiInputs, AdvancedContextKey>> = {
    v_plaka:    'plateThickness',
    v_boy:      'boltLength',
    v_n:        'loadFactor',
    v_FA:       'operatingLoad',
    v_FM:       'assemblyPreload',
    v_dT:       'deltaT',
    v_AS:       'tensileArea',
    v_rp02:     'proofStress',
    v_dOuter:   'dOuter',
    v_dH:       'dH',
  }
  const ctxKey = FIELD_CTX[field] ?? null

  const inputId = `tp-adv-${field}`
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-[11px] font-medium text-tp-text-2 leading-none select-none">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={type}
          step="any"
          value={inputs[field]}
          onChange={e => onChange(field, e.target.value)}
          onFocus={() => onContextChange(ctxKey)}
          onClick={() => onContextChange(ctxKey)}
          className={`w-full bg-tp-workspace border border-tp-border-strong rounded-sm
                     px-2.5 py-2 text-[13px] text-tp-text tabular-nums
                     outline-none focus:border-tp-accent transition-colors
                     ${unit ? 'pr-9' : ''}`}
        />
        {unit && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2
                           text-[10px] text-tp-text-3 pointer-events-none font-mono leading-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Result row ────────────────────────────────────────────────────────────────
function ResultRow({
  label, value, color = 'text-tp-text-2',
}: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-baseline justify-between py-1 border-b border-tp-border-2 last:border-0">
      <span className="text-[11px] text-tp-text-2">{label}</span>
      <span className={`text-[13px] font-bold tabular-nums ${color}`}>{value}</span>
    </div>
  )
}

// ── Separation status badge variant ──────────────────────────────────────────
function sepVariant(s: SeparationStatus): 'validated' | 'warning' | 'error' {
  if (s === 'CLAMPED')              return 'validated'
  if (s === 'SEPARATION_BOUNDARY')  return 'warning'
  return 'error'
}

// ── Axial stress status badge variant (VDI-ENG-04A) ──────────────────────────
function axialVariant(s: AxialStatus): 'validated' | 'warning' | 'error' {
  if (s === 'BELOW_RP02')        return 'validated'
  if (s === 'AT_RP02_BOUNDARY')  return 'warning'
  return 'error'
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdvancedAnalysisPage() {
  const { t, lang } = useLanguage()

  const [inputs, setInputs]           = useState<VdiInputs>(DEFAULTS)
  const [result, setResult]           = useState<VdiResult | null>(null)
  const [sepResult, setSepResult]     = useState<SeparationResult | null>(null)
  const [stiffResult, setStiffResult] = useState<StiffnessResult | null>(null)
  const [axialResult, setAxialResult]       = useState<AxialStressResult | null>(null)
  const [contactResult, setContactResult]   = useState<ContactPressureResult | null>(null)
  const [calculated, setCalculated]         = useState(false)
  const [guideOpen, setGuideOpen]   = useState(false)
  const [activeContext, setActiveContext] = useState<AdvancedContextKey>(null)

  // Panel: collapsed
  const [panelCollapsed, setPanelCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true' } catch { return false }
  })

  // Panel: width
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    try {
      const stored = parseInt(localStorage.getItem(WIDTH_KEY) ?? '', 10)
      return clampWidth(isNaN(stored) ? DEFAULT_WIDTH : stored)
    } catch { return DEFAULT_WIDTH }
  })

  // Persist collapsed state
  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, String(panelCollapsed)) } catch {}
  }, [panelCollapsed])

  // Persist width
  useEffect(() => {
    try { localStorage.setItem(WIDTH_KEY, String(panelWidth)) } catch {}
  }, [panelWidth])

  // ── Drag resize ─────────────────────────────────────────────────────────────
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const onDragPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startWidth: panelWidth }
  }, [panelWidth])

  const onDragPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    // left → wider; right → narrower
    const newW = clampWidth(dragRef.current.startWidth - (e.clientX - dragRef.current.startX))
    setPanelWidth(newW)
  }, [])

  const onDragPointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  const onDragKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); setPanelWidth(w => clampWidth(w + 20)) }
    if (e.key === 'ArrowRight') { e.preventDefault(); setPanelWidth(w => clampWidth(w - 20)) }
  }, [])

  const onDragDoubleClick = useCallback(() => {
    setPanelWidth(DEFAULT_WIDTH)
  }, [])

  // ── Update / run ─────────────────────────────────────────────────────────────
  const update = (field: keyof VdiInputs, val: string) => {
    setInputs(prev => ({
      ...prev,
      [field]: field === 'v_malzeme' ? val : (parseFloat(val) || 0),
    }))
  }

  const run = () => {
    const r   = calculate(inputs)
    const sep = inputs.v_FM > 0
      ? calculateSeparation(inputs.v_FM, r.phi, inputs.v_n, inputs.v_FA)
      : null
    setResult(r)
    setSepResult(sep)
    // c_b / c_p derive from db/dp only — always compute so scalars show after every calc.
    // Displacement values are meaningful only when FM > 0 (sep != null).
    setStiffResult(
      calculateStiffness(
        r.db, r.dp,
        inputs.v_FM,
        sep?.deltaFb ?? 0,
        sep?.FK_res  ?? 0,
      ),
    )
    // VDI-ENG-04A: axial operating stress — null when FM=0 or A_s/Rp0.2 not provided
    setAxialResult(
      calculateAxialStress(inputs.v_FM, sep?.deltaFb ?? 0, inputs.v_AS, inputs.v_rp02),
    )
    // VDI-ENG-04D: average bearing pressure — null when FM=0 or geometry invalid
    setContactResult(
      calculateContactPressure(inputs.v_dOuter, inputs.v_dH, inputs.v_FM),
    )
    setCalculated(true)
  }

  const fp = { inputs, onChange: update, onContextChange: setActiveContext } as const

  // Derive live value + unit for the active context key
  const { liveValue: ctxLiveValue, liveUnit: ctxLiveUnit } = (() => {
    switch (activeContext) {
      case 'plateThickness':  return { liveValue: inputs.v_plaka,   liveUnit: 'mm' }
      case 'boltLength':      return { liveValue: inputs.v_boy,     liveUnit: 'mm' }
      case 'loadFactor':      return { liveValue: inputs.v_n,       liveUnit: '' }
      case 'operatingLoad':   return { liveValue: inputs.v_FA,      liveUnit: 'kN' }
      case 'assemblyPreload': return { liveValue: inputs.v_FM,      liveUnit: 'kN' }
      case 'deltaT':          return { liveValue: inputs.v_dT,      liveUnit: '°C' }
      case 'tensileArea':     return { liveValue: inputs.v_AS,      liveUnit: 'mm²' }
      case 'proofStress':     return { liveValue: inputs.v_rp02,    liveUnit: 'MPa' }
      case 'plateMaterial':   return { liveValue: null,             liveUnit: '' }
      case 'dOuter':          return { liveValue: inputs.v_dOuter,  liveUnit: 'mm' }
      case 'dH':              return { liveValue: inputs.v_dH,      liveUnit: 'mm' }
      default:                return { liveValue: null,             liveUnit: '' }
    }
  })()

  // ── Workflow steps ─────────────────────────────────────────────────────────
  const steps = [
    { n: 1, label: t('adv.workflow.1') },
    { n: 2, label: t('adv.workflow.2') },
    { n: 3, label: t('adv.workflow.3') },
    { n: 4, label: t('adv.workflow.4') },
  ]

  // ── Right panel — desktop (result-first, compact) ─────────────────────────
  const renderRightPanel = () => (
    <>
      {/* 1 — General Assessment */}
      <div className="rounded-md p-2 border-l-2 mb-1.5 bg-tp-result border-tp-border-accent">
        <div className="text-[10px] text-tp-text-2 mb-1 tracking-wide uppercase font-semibold">
          {t('adv.result.general_assessment')}
        </div>
        {result ? (
          <div className="flex items-center gap-2">
            <Info size={14} className="shrink-0 text-tp-accent" />
            <span className="text-[14px] font-bold text-tp-accent">
              Φ = {result.phi.toFixed(3)}
            </span>
          </div>
        ) : (
          <span className="text-[12px] text-tp-text-3">{t('adv.result.idle')}</span>
        )}
      </div>

      {/* 2 — Scalar results */}
      <div className="bg-tp-module border border-tp-border-strong rounded-md p-2 mb-1.5">
        <div className="text-[10px] text-tp-text-2 mb-1 uppercase tracking-wide font-semibold">
          {t('adv.results.title')}
        </div>
        <ResultRow
          label={t('adv.results.dp')}
          value={result ? `${(result.dp * 1e6).toFixed(2)} ×10⁻⁶ mm/N` : '—'} />
        <ResultRow
          label={t('adv.results.db')}
          value={result ? `${(result.db * 1e6).toFixed(2)} ×10⁻⁶ mm/N` : '—'} />
        <ResultRow
          label={t('adv.results.phi')}
          value={result ? result.phi.toFixed(3) : '—'}
          color={result ? 'text-tp-accent-light' : 'text-tp-text-2'} />
        <ResultRow
          label={t('adv.results.fk')}
          value={result ? `${(result.FK / 1000).toFixed(2)} kN` : '—'}
          color={result ? 'text-tp-accent-light' : 'text-tp-text-2'} />
      </div>

      {/* 2b — FK vs FA chart */}
      {result && (
        <div className="bg-tp-module border border-tp-border-strong rounded-md p-2 mb-1.5">
          <FKvsFA
            phi={result.phi}
            n={inputs.v_n}
            faKN={inputs.v_FA}
            fkN={result.FK}
            lang={lang}
          />
        </div>
      )}

      {/* 2c — VDI-ENG-04B: Residual Clamp Force / Separation Check */}
      {calculated && (
        <div className="bg-tp-module border border-tp-border-strong rounded-md p-2 mb-1.5">
          <div className="text-[10px] text-tp-text-2 mb-1 uppercase tracking-wide font-semibold">
            {t('adv.section.separation')}
          </div>
          {sepResult ? (
            <>
              {/* Primary — FK,res */}
              <div className="flex items-baseline justify-between py-1.5 border-b border-tp-border-strong">
                <span className="text-[12px] text-tp-text-2 font-medium">{t('adv.sep.fk_res')}</span>
                <span className="text-[15px] font-bold tabular-nums text-tp-accent-light">
                  {sepResult.FK_res.toFixed(2)} kN
                </span>
              </div>
              {/* Supporting — DeltaFk */}
              <ResultRow
                label={t('adv.sep.clamp_loss')}
                value={`${sepResult.deltaFk.toFixed(2)} kN`}
              />
              {/* Supporting — FA,sep (optional) */}
              {sepResult.FA_sep !== null && (
                <ResultRow
                  label={t('adv.sep.fa_sep')}
                  value={`${sepResult.FA_sep.toFixed(2)} kN`}
                />
              )}
              {/* Status */}
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] text-tp-text-3 font-mono">F_M = {inputs.v_FM.toFixed(1)} kN</span>
                <StatusBadge variant={sepVariant(sepResult.status)}>
                  {t(`adv.sep.status.${sepResult.status === 'CLAMPED' ? 'clamped' : sepResult.status === 'SEPARATION_BOUNDARY' ? 'boundary' : 'separated'}`)}
                </StatusBadge>
              </div>
            </>
          ) : (
            <span className="text-[11px] text-tp-text-2">{t('adv.sep.no_fm')}</span>
          )}
        </div>
      )}

      {/* 2d — VDI-ENG-04A: Operating Axial Stress */}
      {calculated && (
        <div className="bg-tp-module border border-tp-border-strong rounded-md p-2 mb-1.5">
          <div className="text-[10px] text-tp-text-2 mb-1 uppercase tracking-wide font-semibold">
            {t('adv.section.axial')}
          </div>
          {axialResult ? (
            <>
              {/* Primary — σ_axial */}
              <div className="flex items-baseline justify-between py-1.5 border-b border-tp-border-strong">
                <span className="text-[12px] text-tp-text-2 font-medium">{t('adv.axial.sigma')}</span>
                <span className="text-[15px] font-bold tabular-nums text-tp-accent-light">
                  {axialResult.sigma_axial.toFixed(1)} MPa
                </span>
              </div>
              <ResultRow
                label={t('adv.axial.fb_op')}
                value={`${axialResult.FB_op_kN.toFixed(2)} kN`}
              />
              <ResultRow
                label={t('adv.axial.eta')}
                value={axialResult.eta_axial.toFixed(4)}
              />
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[9px] text-tp-text-3 font-mono leading-tight">
                  {t('adv.axial.scope_note')}
                </span>
                <StatusBadge variant={axialVariant(axialResult.status)}>
                  {t(axialResult.status === 'BELOW_RP02' ? 'adv.axial.status.below'
                    : axialResult.status === 'AT_RP02_BOUNDARY' ? 'adv.axial.status.boundary'
                    : 'adv.axial.status.above')}
                </StatusBadge>
              </div>
            </>
          ) : (
            <span className="text-[11px] text-tp-text-2">{t('adv.axial.no_fm')}</span>
          )}
        </div>
      )}

      {/* 2e — VDI-ENG-04D: Average Bearing Pressure */}
      {calculated && (
        <div className="bg-tp-module border border-tp-border-strong rounded-md p-2 mb-1.5">
          <div className="text-[10px] text-tp-text-2 mb-1 uppercase tracking-wide font-semibold">
            {t('adv.section.contact_pressure')}
          </div>
          {inputs.v_dOuter > 0 && inputs.v_dH > 0 && inputs.v_dOuter <= inputs.v_dH ? (
            <span className="text-[11px] text-tp-warn">{t('adv.contact.invalid_geom')}</span>
          ) : contactResult ? (
            <>
              {/* Primary — p_avg */}
              <div className="flex items-baseline justify-between py-1.5 border-b border-tp-border-strong">
                <span className="text-[12px] text-tp-text-2 font-medium">{t('adv.contact.p_avg')}</span>
                <span className="text-[15px] font-bold tabular-nums text-tp-accent-light">
                  {contactResult.p_avg_MPa.toFixed(1)} MPa
                </span>
              </div>
              <ResultRow
                label={t('adv.contact.a_contact')}
                value={`${contactResult.A_contact_mm2.toFixed(2)} mm²`}
              />
              <ResultRow
                label={t('adv.contact.f_contact')}
                value={`${inputs.v_FM.toFixed(1)} kN`}
              />
              <p className="mt-1.5 text-[9px] text-tp-text-3 font-mono leading-tight">
                {t('adv.contact.scope_note')}
              </p>
            </>
          ) : (
            <span className="text-[11px] text-tp-text-2">{t('adv.contact.no_fm')}</span>
          )}
        </div>
      )}

      {/* 2f — VDI-ENG-04C: Joint Stiffness */}
      {calculated && stiffResult && (
        <div className="bg-tp-module border border-tp-border-strong rounded-md p-2 mb-1.5">
          <div className="text-[10px] text-tp-text-2 mb-1 uppercase tracking-wide font-semibold">
            {t('adv.section.stiffness')}
          </div>
          {/* Scalars — always visible after any calculation */}
          <div className="flex gap-4 mb-1.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-tp-text-3">{t('adv.stiff.cb')}</span>
              <span className="text-[13px] font-bold tabular-nums text-tp-accent-light">
                {stiffResult.c_b.toFixed(1)} kN/mm
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] text-tp-text-3">{t('adv.stiff.cp')}</span>
              <span className="text-[13px] font-bold tabular-nums text-tp-accent-light">
                {stiffResult.c_p.toFixed(1)} kN/mm
              </span>
            </div>
          </div>
          {/* Force–Displacement diagram — requires FM > 0 */}
          {sepResult ? (
            <JointStiffness
              FM={inputs.v_FM}
              deltaFb={sepResult.deltaFb}
              FK_res={sepResult.FK_res}
              stiff={stiffResult}
              lang={lang}
            />
          ) : (
            <span className="text-[11px] text-tp-text-2">{t('adv.sep.no_fm')}</span>
          )}
        </div>
      )}

      {/* 3 — Compliance diagram */}
      <div className="border border-tp-border-strong rounded-md overflow-hidden mb-1.5">
        <div className="bg-tp-surface-3 border-b border-tp-border-2 px-2.5 py-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-tp-text-2">
            {t('adv.phi.title')}
          </span>
          <span className="text-[10px] text-tp-text-2 font-mono">VDI 2230</span>
        </div>
        <div className="bg-tp-bg p-1.5">
          <ComplianceDiagram result={result} ariaLabel={t('adv.phi.diagram_label')} />
        </div>
      </div>

      {/* 4 — Active parameter context schematic */}
      <div className="mb-1.5">
        <AdvancedConnectionContextDiagram
          contextKey={activeContext}
          selectedMaterial={inputs.v_malzeme}
          liveValue={ctxLiveValue}
          liveUnit={ctxLiveUnit}
        />
      </div>

      {/* 4b — Contact pressure schematic */}
      <div className="border border-tp-border-strong rounded-md overflow-hidden mb-1.5">
        <div className="bg-tp-surface-3 border-b border-tp-border px-2.5 py-1">
          <span className="text-[9px] font-bold uppercase tracking-widest text-tp-text-3">
            {lang === 'tr' ? 'Şematik · Nitel Model' : 'Schematic · Qualitative Model'}
          </span>
        </div>
        <div className="p-1.5">
          <ContactPressureSchematic lang={lang} />
        </div>
      </div>

      {/* 5 — Deferred analyses — VDI-ENG-04A … 04D roadmap */}
      <div className="rounded-md p-2 bg-tp-module border border-tp-border mb-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-tp-text-2 uppercase tracking-wide font-semibold">
            {t('adv.deferred.title')}
          </span>
          <span className="text-[9px] text-tp-text-3 font-mono opacity-60">
            {t('adv.deferred.roadmap_note')}
          </span>
        </div>
        <div className="space-y-1">
          {([
            { code: '04A', key: 'adv.deferred.04a', done: true  },
            { code: '04B', key: 'adv.deferred.04b', done: true  },
            { code: '04C', key: 'adv.deferred.04c', done: true  },
            { code: '04D', key: 'adv.deferred.04d', done: true  },
          ] as const).map(({ code, key, done }) => (
            <div key={code} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[9px] font-mono text-tp-text-3 shrink-0 opacity-60">
                  {`VDI-ENG-${code}`}
                </span>
                <span className="text-[11px] text-tp-text-3 truncate">
                  {t(key)}
                </span>
              </div>
              {done ? (
                <span className="text-[9px] font-mono shrink-0 px-1 py-0.5 rounded
                                 bg-tp-valid-muted text-tp-valid border border-tp-valid/30">
                  DONE
                </span>
              ) : (
                <span className="text-[9px] font-mono shrink-0 px-1 py-0.5 rounded
                                 bg-tp-surface-3 text-tp-text-3 border border-tp-border">
                  {t('adv.deferred.status')}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-2 text-[11px] text-tp-text-3 text-center">
        {t('adv.footer')}
      </div>
    </>
  )

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">

      {/* ── Guide drawer ────────────────────────────────────────────────── */}
      <ModuleGuideDrawer
        guide={advancedAnalysisGuide}
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      />

      {/* ── LEFT: Inputs ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 min-w-0 bg-tp-workspace">

        {/* Page header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] sm:text-[16px] font-semibold text-tp-text">
              {t('adv.title')}
              <span className="hidden sm:inline ml-2 text-[12px] font-normal text-tp-text-3">
                — {t('adv.subtitle')}
              </span>
            </h1>
            <p className="hidden sm:flex text-[11px] text-tp-text-3 mt-1 items-center gap-1.5">
              <Info size={11} className="shrink-0" />
              VDI 2230 Blatt 1 — flanş esnekliği, yük dağılım faktörü, ek cıvata kuvveti
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            aria-label={t('adv.guide_open')}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md border border-tp-border
                       bg-tp-module text-tp-text-2 text-[11px] sm:text-[12px] font-medium
                       hover:border-tp-border-2 hover:text-tp-text transition-colors shrink-0
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-tp-border-accent"
          >
            <BookOpen size={12} />
            {t('adv.guide')}
          </button>
        </div>

        {/* Workflow step rail — scrollable on narrow viewports */}
        <div className="overflow-x-auto mb-6">
        <div className="flex items-center gap-0 min-w-max">
          {steps.map((step, i, arr) => {
            const isActive = !calculated ? step.n <= 2 : step.n <= 4
            const isDone   = calculated && step.n <= 3
            return (
              <div key={step.n} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border
                    ${isDone
                      ? 'bg-tp-valid border-tp-border-valid text-white'
                      : isActive
                      ? 'bg-tp-module border-tp-border-accent text-tp-accent-light'
                      : 'bg-tp-module border-tp-border text-tp-text-3'}`}>
                    {isDone ? <CheckCircle size={12} /> : step.n}
                  </div>
                  <span className={`text-[9px] mt-1 whitespace-nowrap
                    ${isActive ? 'text-tp-text-2' : 'text-tp-text-3'}`}>
                    {step.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`flex-1 h-px mx-1 mb-4
                    ${isDone ? 'bg-tp-border-valid' : 'bg-tp-border'}`} />
                )}
              </div>
            )
          })}
        </div>
        </div>

        {/* Input module — Flanş Geometrisi */}
        <div className="bg-tp-module border border-tp-border-2 rounded-md overflow-hidden mb-3">
          <div className="tp-module-header px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-tp-text-2">
              {t('adv.section.geometry')}
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <F label={t('adv.label.plate_thickness')} field="v_plaka" unit="mm" {...fp} />
            <F label={t('adv.label.bolt_length')}     field="v_boy"   unit="mm" {...fp} />
          </div>
        </div>

        {/* Input module — Yük & Malzeme */}
        <div className="bg-tp-module border border-tp-border-2 rounded-md overflow-hidden mb-3">
          <div className="tp-module-header px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-tp-text-2">
              {t('adv.section.load')}
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <F label={t('adv.label.load_factor')}    field="v_n"   {...fp} />
            <F label={t('adv.label.operating_load')} field="v_FA"  unit="kN" {...fp} />
            <F label={t('adv.label.preload_fm')}     field="v_FM"  unit="kN" {...fp} />
            <F label={t('adv.label.delta_t')}        field="v_dT"  unit="°C" {...fp} />
            <F label={t('adv.label.as')}             field="v_AS"  unit="mm²" {...fp} />
            <F label={t('adv.label.rp02')}           field="v_rp02" unit="MPa" {...fp} />
            <div className="col-span-2 flex flex-col gap-1">
              <label htmlFor="tp-adv-v_malzeme" className="text-[11px] font-medium text-tp-text-2 leading-none select-none">
                {t('adv.label.plate_material')}
              </label>
              <select
                id="tp-adv-v_malzeme"
                value={inputs.v_malzeme}
                onChange={e => update('v_malzeme', e.target.value)}
                onFocus={() => setActiveContext('plateMaterial')}
                onClick={() => setActiveContext('plateMaterial')}
                className="w-full bg-tp-workspace border border-tp-border-strong rounded-sm
                           px-2.5 py-2 text-[13px] text-tp-text
                           outline-none focus:border-tp-accent transition-colors"
              >
                {/* Values stay in TR so the Ep check works: .includes('Alüm') */}
                <option value="Çelik (E=210 GPa)">{t('adv.material.steel')}</option>
                <option value="Alüminyum (E=70 GPa)">{t('adv.material.aluminium')}</option>
                <option value="Dökme demir">{t('adv.material.cast_iron')}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Input module — Temas Geometrisi / Contact Geometry (VDI-ENG-04D) */}
        <div className="bg-tp-module border border-tp-border-2 rounded-md overflow-hidden mb-3">
          <div className="tp-module-header px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-tp-text-2">
              {t('adv.section.contact_geom')}
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <F label={t('adv.label.d_outer')} field="v_dOuter" unit="mm" {...fp} />
            <F label={t('adv.label.d_h')}     field="v_dH"     unit="mm" {...fp} />
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3 mt-5">
          <Button variant="primary" size="lg" onClick={run} className="min-w-[160px]">
            <Wrench size={14} />
            {t('adv.cta')}
          </Button>
        </div>

        {/* Methodology note */}
        <div className="mt-6 p-3 bg-tp-module border border-tp-border rounded-md">
          <div className="flex gap-2">
            <Info size={12} className="text-tp-text-3 shrink-0 mt-0.5" />
            <div className="text-[10px] text-tp-text-3 space-y-0.5">
              <div>{t('adv.method.line1')}</div>
              <div>{t('adv.method.line2')}</div>
              <div>{t('adv.method.line3')}</div>
              <div className="text-tp-text-3/70">{t('adv.method.delta_t_note')}</div>
            </div>
          </div>
        </div>

        {/* ── MOBILE: stacked results, result-first order (hidden on md+) ── */}
        <div className="md:hidden mt-5 border-t border-tp-border pt-4 space-y-2">
          {/* Result summary */}
          <div className="rounded-md p-3 border-l-2 bg-tp-result border-tp-border-accent">
            <div className="text-[10px] text-tp-text-2 mb-1.5 tracking-wide uppercase font-semibold">
              {t('adv.result.general_assessment')}
            </div>
            {result ? (
              <div className="flex items-center gap-2">
                <Info size={16} className="shrink-0 text-tp-accent-light" />
                <span className="text-[15px] font-bold text-tp-accent-light">
                  Φ = {result.phi.toFixed(3)}
                </span>
              </div>
            ) : (
              <span className="text-[13px] text-tp-text-2">{t('adv.result.idle')}</span>
            )}
          </div>
          {/* Scalar results */}
          <div className="bg-tp-module border border-tp-border-strong rounded-md p-2.5">
            <div className="text-[10px] text-tp-text-2 mb-1.5 uppercase tracking-wide font-semibold">
              {t('adv.results.title')}
            </div>
            <ResultRow label={t('adv.results.dp')} value={result ? `${(result.dp * 1e6).toFixed(2)} ×10⁻⁶ mm/N` : '—'} />
            <ResultRow label={t('adv.results.db')} value={result ? `${(result.db * 1e6).toFixed(2)} ×10⁻⁶ mm/N` : '—'} />
            <ResultRow label={t('adv.results.phi')} value={result ? result.phi.toFixed(3) : '—'} color={result ? 'text-tp-accent-light' : 'text-tp-text-2'} />
            <ResultRow label={t('adv.results.fk')} value={result ? `${(result.FK / 1000).toFixed(2)} kN` : '—'} color={result ? 'text-tp-accent-light' : 'text-tp-text-2'} />
          </div>
          {/* FK vs FA chart */}
          {result && (
            <div className="bg-tp-module border border-tp-border-strong rounded-md p-2.5">
              <FKvsFA
                phi={result.phi}
                n={inputs.v_n}
                faKN={inputs.v_FA}
                fkN={result.FK}
                lang={lang}
              />
            </div>
          )}
          {/* VDI-ENG-04B — Separation Check (mobile) */}
          {calculated && (
            <div className="bg-tp-module border border-tp-border-strong rounded-md p-2.5">
              <div className="text-[10px] text-tp-text-2 mb-1.5 uppercase tracking-wide font-semibold">
                {t('adv.section.separation')}
              </div>
              {sepResult ? (
                <>
                  <ResultRow
                    label={t('adv.sep.fk_res')}
                    value={`${sepResult.FK_res.toFixed(2)} kN`}
                    color="text-tp-accent-light"
                  />
                  <ResultRow
                    label={t('adv.sep.clamp_loss')}
                    value={`${sepResult.deltaFk.toFixed(2)} kN`}
                  />
                  {sepResult.FA_sep !== null && (
                    <ResultRow
                      label={t('adv.sep.fa_sep')}
                      value={`${sepResult.FA_sep.toFixed(2)} kN`}
                    />
                  )}
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[10px] text-tp-text-2 font-mono">F_M = {inputs.v_FM.toFixed(1)} kN</span>
                    <StatusBadge variant={sepVariant(sepResult.status)}>
                      {t(`adv.sep.status.${sepResult.status === 'CLAMPED' ? 'clamped' : sepResult.status === 'SEPARATION_BOUNDARY' ? 'boundary' : 'separated'}`)}
                    </StatusBadge>
                  </div>
                </>
              ) : (
                <span className="text-[11px] text-tp-text-2">{t('adv.sep.no_fm')}</span>
              )}
            </div>
          )}
          {/* VDI-ENG-04A — Operating Axial Stress (mobile) */}
          {calculated && (
            <div className="bg-tp-module border border-tp-border-strong rounded-md p-2.5">
              <div className="text-[10px] text-tp-text-2 mb-1.5 uppercase tracking-wide font-semibold">
                {t('adv.section.axial')}
              </div>
              {axialResult ? (
                <>
                  <ResultRow
                    label={t('adv.axial.sigma')}
                    value={`${axialResult.sigma_axial.toFixed(1)} MPa`}
                    color="text-tp-accent-light"
                  />
                  <ResultRow
                    label={t('adv.axial.fb_op')}
                    value={`${axialResult.FB_op_kN.toFixed(2)} kN`}
                  />
                  <ResultRow
                    label={t('adv.axial.eta')}
                    value={axialResult.eta_axial.toFixed(4)}
                  />
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="text-[9px] text-tp-text-3 font-mono leading-tight">
                      {t('adv.axial.scope_note')}
                    </span>
                    <StatusBadge variant={axialVariant(axialResult.status)}>
                      {t(axialResult.status === 'BELOW_RP02' ? 'adv.axial.status.below'
                        : axialResult.status === 'AT_RP02_BOUNDARY' ? 'adv.axial.status.boundary'
                        : 'adv.axial.status.above')}
                    </StatusBadge>
                  </div>
                </>
              ) : (
                <span className="text-[11px] text-tp-text-2">{t('adv.axial.no_fm')}</span>
              )}
            </div>
          )}
          {/* VDI-ENG-04D — Average Bearing Pressure (mobile) */}
          {calculated && (
            <div className="bg-tp-module border border-tp-border-strong rounded-md p-2.5">
              <div className="text-[10px] text-tp-text-2 mb-1.5 uppercase tracking-wide font-semibold">
                {t('adv.section.contact_pressure')}
              </div>
              {inputs.v_dOuter > 0 && inputs.v_dH > 0 && inputs.v_dOuter <= inputs.v_dH ? (
                <span className="text-[11px] text-tp-warn">{t('adv.contact.invalid_geom')}</span>
              ) : contactResult ? (
                <>
                  <ResultRow
                    label={t('adv.contact.p_avg')}
                    value={`${contactResult.p_avg_MPa.toFixed(1)} MPa`}
                    color="text-tp-accent-light"
                  />
                  <ResultRow
                    label={t('adv.contact.a_contact')}
                    value={`${contactResult.A_contact_mm2.toFixed(2)} mm²`}
                  />
                  <ResultRow
                    label={t('adv.contact.f_contact')}
                    value={`${inputs.v_FM.toFixed(1)} kN`}
                  />
                  <p className="mt-1.5 text-[9px] text-tp-text-3 font-mono leading-tight">
                    {t('adv.contact.scope_note')}
                  </p>
                </>
              ) : (
                <span className="text-[11px] text-tp-text-2">{t('adv.contact.no_fm')}</span>
              )}
            </div>
          )}
          {/* VDI-ENG-04C — Joint Stiffness (mobile) */}
          {calculated && stiffResult && (
            <div className="bg-tp-module border border-tp-border-strong rounded-md p-2.5">
              <div className="text-[10px] text-tp-text-2 mb-1.5 uppercase tracking-wide font-semibold">
                {t('adv.section.stiffness')}
              </div>
              {/* Scalars — always visible after any calculation */}
              <div className="flex gap-4 mb-1.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-tp-text-3">{t('adv.stiff.cb')}</span>
                  <span className="text-[13px] font-bold tabular-nums text-tp-accent-light">
                    {stiffResult.c_b.toFixed(1)} kN/mm
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-tp-text-3">{t('adv.stiff.cp')}</span>
                  <span className="text-[13px] font-bold tabular-nums text-tp-accent-light">
                    {stiffResult.c_p.toFixed(1)} kN/mm
                  </span>
                </div>
              </div>
              {/* Force–Displacement diagram — requires FM > 0 */}
              {sepResult ? (
                <JointStiffness
                  FM={inputs.v_FM}
                  deltaFb={sepResult.deltaFb}
                  FK_res={sepResult.FK_res}
                  stiff={stiffResult}
                  lang={lang}
                />
              ) : (
                <span className="text-[11px] text-tp-text-2">{t('adv.sep.no_fm')}</span>
              )}
            </div>
          )}
          {/* Φ compliance diagram */}
          <div className="border border-tp-border-strong rounded-md overflow-hidden">
            <div className="bg-tp-surface-3 border-b border-tp-border-2 px-3 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-tp-text-2">
                {t('adv.phi.title')}
              </span>
              <span className="text-[10px] text-tp-text-2 font-mono">VDI 2230</span>
            </div>
            <div className="bg-tp-bg p-2">
              <ComplianceDiagram result={result} ariaLabel={t('adv.phi.diagram_label')} />
            </div>
          </div>
          {/* Engineering schematic */}
          <AdvancedConnectionContextDiagram
            contextKey={activeContext}
            selectedMaterial={inputs.v_malzeme}
            liveValue={ctxLiveValue}
            liveUnit={ctxLiveUnit}
          />
          {/* Contact pressure schematic */}
          <div className="border border-tp-border-strong rounded-md overflow-hidden">
            <div className="bg-tp-surface-3 border-b border-tp-border px-3 py-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-tp-text-3">
                {lang === 'tr' ? 'Şematik · Nitel Model' : 'Schematic · Qualitative Model'}
              </span>
            </div>
            <div className="p-2">
              <ContactPressureSchematic lang={lang} />
            </div>
          </div>
        </div>
      </div>

      {/* ── DESKTOP: resize handle (hidden on mobile) ───────────────────── */}
      {!panelCollapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuemin={MIN_WIDTH}
          aria-valuemax={MAX_WIDTH}
          aria-valuenow={panelWidth}
          aria-label={t('adv.panel.resize')}
          tabIndex={0}
          className="hidden md:flex w-px bg-tp-border relative shrink-0 cursor-col-resize
                     items-start justify-center
                     hover:bg-tp-border-accent transition-colors
                     focus-visible:outline focus-visible:outline-2
                     focus-visible:outline-tp-border-accent"
          style={{ touchAction: 'none' }}
          onPointerDown={onDragPointerDown}
          onPointerMove={onDragPointerMove}
          onPointerUp={onDragPointerUp}
          onKeyDown={onDragKeyDown}
          onDoubleClick={onDragDoubleClick}
        >
          {/* Wider invisible hit target */}
          <div className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize" />
          {/* Collapse button */}
          <button
            type="button"
            aria-label={t('adv.panel.collapse')}
            aria-expanded={true}
            onClick={(e) => { e.stopPropagation(); setPanelCollapsed(true) }}
            className="absolute top-4 -right-4 z-20 w-7 h-7 rounded-full
                       bg-tp-module border border-tp-border-2
                       flex items-center justify-center
                       text-tp-text-3 hover:text-tp-text transition-colors shadow-sm"
          >
            <ChevronRight size={12} />
          </button>
        </div>
      )}

      {/* ── DESKTOP: expand strip (collapsed state, hidden on mobile) ───── */}
      {panelCollapsed && (
        <div className="hidden md:flex">
          <button
            type="button"
            aria-label={t('adv.panel.expand')}
            aria-expanded={false}
            onClick={() => setPanelCollapsed(false)}
            className="flex flex-col items-center w-5 bg-tp-module border-l border-tp-border
                       text-tp-text-3 hover:text-tp-text hover:bg-tp-module/80
                       transition-colors pt-4"
          >
            <ChevronLeft size={11} />
          </button>
        </div>
      )}

      {/* ── DESKTOP: right panel (hidden on mobile) ─────────────────────── */}
      {!panelCollapsed && (
        <div
          className="hidden md:flex flex-col overflow-y-auto bg-tp-result shrink-0"
          style={{ width: panelWidth, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH }}
        >
          <div className="tp-module-header px-3 py-2 flex items-center justify-between border-b border-tp-border shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-tp-accent shrink-0" aria-hidden="true" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-tp-text-2">
                {t('adv.results.title')}
              </span>
            </div>
            {calculated && (
              <StatusBadge variant="calculated">Φ ✓</StatusBadge>
            )}
          </div>
          <div className="px-2.5 py-2 flex flex-col">
            {renderRightPanel()}
          </div>
        </div>
      )}
    </div>
  )
}
