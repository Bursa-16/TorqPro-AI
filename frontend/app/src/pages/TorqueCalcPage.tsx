import { useState, useRef, useMemo } from 'react'
import StatusBadge from '../components/ui/StatusBadge'
import TorqueContextDiagram, { type TorqueVisualFocus } from '../components/engineering/TorqueContextDiagram'
import ModuleGuideDrawer from '../components/guidance/ModuleGuideDrawer'
import { engineeringCheck } from '../services/torque'
import type { EngineeringCheckRequest, EngineeringCheckResult } from '../types/api'
import { torqueGuide } from '../guides/torqueGuide'
import type { ExampleValues } from '../guides/GuideSchema'
import { EV } from '../components/engineering-visuals/engineeringVisualTokens'
import { useLanguage } from '../i18n/LanguageContext'

const DEFAULTS: EngineeringCheckRequest = {
  diameter_mm: 10, pitch_mm: 1.5, stress_area_mm2: 58, rp02_mpa: 900,
  target_yield_ratio: 0.75,
  mu_thread_min: 0.10, mu_thread_nom: 0.12, mu_thread_max: 0.14,
  mu_bearing_min: 0.10, mu_bearing_nom: 0.12, mu_bearing_max: 0.14,
  effective_bearing_diameter_mm: 15, engagement_mm: 10,
  internal_rm_mpa: 500, bolt_rm_mpa: 1000, nut_proof_mpa: 830,
}

// ── Field component ────────────────────────────────────────────────────────────
function F({
  label, field, unit, form, onChange,
  focusKey, onFocusField,
}: {
  label: string
  field: keyof EngineeringCheckRequest
  unit?: string
  form: EngineeringCheckRequest
  onChange: (f: keyof EngineeringCheckRequest, v: string) => void
  focusKey?: TorqueVisualFocus
  onFocusField?: (k: TorqueVisualFocus) => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[12px] text-tp-text-3 leading-none">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number" step="any"
          value={form[field]}
          onChange={e => onChange(field, e.target.value)}
          onFocus={() => { if (focusKey) onFocusField?.(focusKey) }}
          className="w-full bg-tp-workspace border border-tp-border-2 rounded
                     px-2 py-1.5 text-[14px] text-tp-text tabular-nums
                     outline-none focus:border-tp-accent transition-colors"
        />
        {unit && <span className="text-[10px] text-tp-text-3 shrink-0 w-7">{unit}</span>}
      </div>
    </div>
  )
}

// ── Section divider ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-3 first:mt-0">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-tp-text-3 shrink-0 select-none">
        {children}
      </span>
      <div className="flex-1 h-px bg-tp-border" />
    </div>
  )
}

// ── Result row ─────────────────────────────────────────────────────────────────
function ResultRow({ label, value, sub, color = 'text-tp-text' }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5
                    border-b border-tp-border/40 last:border-b-0">
      <span className="text-[11px] text-tp-text-3 shrink-0">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold tabular-nums ${color}`}>{value}</span>
        {sub && <span className="text-[10px] text-tp-text-3 ml-1">{sub}</span>}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function TorqueCalcPage() {
  const { t } = useLanguage()
  const [form, setForm] = useState<EngineeringCheckRequest>(DEFAULTS)
  const [result, setResult] = useState<EngineeringCheckResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  // GEOMETRY-CONTEXT-01: visual focus state (HARD RULE 13)
  const [visualFocus, setVisualFocus] = useState<TorqueVisualFocus>('neutral')

  // Context titles/subs — reactive to language via useMemo (HARD RULE 07)
  const CONTEXT_TITLE = useMemo((): Record<TorqueVisualFocus, string> => ({
    neutral:              t('ctx.neutral'),
    diameter_d:           t('ctx.diameter_d'),
    pitch_p:              t('ctx.pitch_p'),
    stress_area_as:       t('ctx.stress_area_as'),
    bearing_diameter_dw:  t('ctx.bearing_diameter_dw'),
    thread_friction:      t('ctx.thread_friction'),
    bearing_friction:     t('ctx.bearing_friction'),
    yield_utilization:    t('ctx.yield_utilization'),
    rp02:                 t('ctx.rp02'),
  }), [t])

  const CONTEXT_SUB = useMemo((): Record<TorqueVisualFocus, string> => ({
    neutral:              '',
    diameter_d:           t('ctx.sub.diameter_d'),
    pitch_p:              t('ctx.sub.pitch_p'),
    stress_area_as:       t('ctx.sub.stress_area_as'),
    bearing_diameter_dw:  t('ctx.sub.bearing_diameter_dw'),
    thread_friction:      t('ctx.sub.thread_friction'),
    bearing_friction:     t('ctx.sub.bearing_friction'),
    yield_utilization:    t('ctx.sub.yield_utilization'),
    rp02:                 t('ctx.sub.rp02'),
  }), [t])

  // Snapshot for "Değerleri Geri Al"
  const snapshotRef = useRef<EngineeringCheckRequest | null>(null)
  const hasSnapshot = snapshotRef.current !== null

  const update = (key: keyof EngineeringCheckRequest, val: string) =>
    setForm(prev => ({ ...prev, [key]: parseFloat(val) || 0 }))

  const calculate = async () => {
    setError(''); setLoading(true)
    try { setResult(await engineeringCheck(form)) }
    catch (e: any) { setError(e.detail || e.message) }
    finally { setLoading(false) }
  }

  // ── Guide callbacks ───────────────────────────────────────────────────────
  const handleLoadExample = (values: ExampleValues) => {
    // Save current form as snapshot before overwriting
    snapshotRef.current = { ...form }
    setForm(values as unknown as EngineeringCheckRequest)
    // If example uses advanced fields, open that section
    setAdvanced(true)
  }

  const handleRestoreSnapshot = () => {
    if (snapshotRef.current) {
      setForm(snapshotRef.current)
      snapshotRef.current = null
    }
  }

  const handleHighlight = (anchorId: string) => {
    const el = document.getElementById(anchorId)
    if (!el) return
    el.style.scrollMarginTop = '80px'
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    // Brief flash highlight
    el.style.outline = '2px solid #4a7cc9'
    el.style.outlineOffset = '4px'
    el.style.boxShadow = '0 0 0 4px rgba(74,124,201,0.12)'
    setTimeout(() => {
      el.style.outline = ''
      el.style.outlineOffset = ''
      el.style.boxShadow = ''
      el.style.scrollMarginTop = ''
    }, 2000)
  }

  const fp = { form, onChange: update, onFocusField: setVisualFocus } as const

  const nutUtil = result?.nut_proof_util_pct ?? 0
  // NOTE: 75/90 are UNSOURCED UI-only thresholds — not authoritative engineering limits.
  // Display nut utilization as a neutral computed result, not pass/warn/fail.
  const nutColor = 'text-tp-accent'
  const nutBadge = 'info' as const
  const nutLabel = t('torque.computed')
  const sfColor = (sf: number) => sf < 1 ? 'text-tp-error' : 'text-tp-valid'

  return (
    <>
      {/* Guide drawer — rendered outside the page scroll container */}
      <ModuleGuideDrawer
        guide={torqueGuide}
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        onLoadExample={handleLoadExample}
        onRestoreSnapshot={handleRestoreSnapshot}
        hasSnapshot={hasSnapshot}
        onHighlight={handleHighlight}
      />

      {/* Single primary page scroll — wraps both columns */}
      <div className="flex h-full overflow-y-auto bg-tp-bg">

        {/* ── LEFT: Inputs ──────────────────────────────────────────────────── */}
        <div className="flex-1 px-5 py-4 min-w-0 bg-tp-workspace">

          {/* Page title + guide trigger */}
          <div className="flex items-center gap-3 mb-5">
            <h1 className="text-[16px] font-semibold text-tp-text">
              {t('torque.title')}
              <span className="ml-2 text-[11px] font-normal text-tp-text-3">
                — {t('torque.subtitle')}
              </span>
            </h1>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              aria-label={t('torque.guide_open')}
              className="flex items-center gap-1 text-[11px] text-tp-text-3
                         hover:text-tp-accent transition-colors
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-tp-accent
                         rounded px-1 py-0.5"
            >
              <span className="text-[13px] leading-none" aria-hidden="true">ⓘ</span>
              <span>{t('torque.guide')}</span>
            </button>
          </div>

          {/* Primary: Geometry */}
          <div id="guide-anchor-geometri">
            <SectionLabel>{t('torque.geometry')}</SectionLabel>
            <div className="grid grid-cols-4 gap-3">
              <F label={t('torque.diameter')} field="diameter_mm" unit="mm" focusKey="diameter_d" {...fp} />
              <F label={t('torque.pitch')} field="pitch_mm" unit="mm" focusKey="pitch_p" {...fp} />
              <F label={t('torque.stress_area')} field="stress_area_mm2" unit="mm²" focusKey="stress_area_as" {...fp} />
              <F label={t('torque.bearing_diam')} field="effective_bearing_diameter_mm" unit="mm" focusKey="bearing_diameter_dw" {...fp} />
            </div>
          </div>

          {/* Mobile inline context visual (HARD RULE 06) */}
          {visualFocus !== 'neutral' && (
            <div className="block lg:hidden mt-3">
              <div className="text-[10px] text-tp-text-3 mb-1 tracking-wide">
                {CONTEXT_TITLE[visualFocus]}
                {CONTEXT_SUB[visualFocus] && (
                  <span className="ml-1 text-tp-text-3 normal-case">
                    — {CONTEXT_SUB[visualFocus]}
                  </span>
                )}
              </div>
              <TorqueContextDiagram
                focus={visualFocus}
                result={result}
                className="w-full max-h-[180px]"
              />
            </div>
          )}

          {/* Primary: Friction */}
          <div id="guide-anchor-surtunme">
            <SectionLabel>{t('torque.friction')}</SectionLabel>
            <div className="grid grid-cols-3 gap-3 mb-1">
              <F label={t('torque.thread_min')} field="mu_thread_min" focusKey="thread_friction" {...fp} />
              <F label={t('torque.thread_nom')} field="mu_thread_nom" focusKey="thread_friction" {...fp} />
              <F label={t('torque.thread_max')} field="mu_thread_max" focusKey="thread_friction" {...fp} />
              <F label={t('torque.bearing_min')} field="mu_bearing_min" focusKey="bearing_friction" {...fp} />
              <F label={t('torque.bearing_nom')} field="mu_bearing_nom" focusKey="bearing_friction" {...fp} />
              <F label={t('torque.bearing_max')} field="mu_bearing_max" focusKey="bearing_friction" {...fp} />
            </div>
          </div>

          {/* Primary: Target */}
          <div id="guide-anchor-hedef">
            <SectionLabel>{t('torque.target')}</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <F label={t('torque.yield_ratio')} field="target_yield_ratio" focusKey="yield_utilization" {...fp} />
              <F label={t('torque.rp02')} field="rp02_mpa" unit="MPa" focusKey="rp02" {...fp} />
            </div>
          </div>

          {/* Advanced disclosure */}
          <div id="guide-anchor-advanced">
            <button
              onClick={() => setAdvanced(v => !v)}
              className="mt-6 flex items-center gap-2 text-[12px] text-tp-text-3
                         hover:text-tp-text-2 transition-colors group"
            >
              <span
                className="w-3.5 h-3.5 border border-tp-border-strong rounded-sm flex items-center
                           justify-center text-[9px] group-hover:border-tp-text-3 transition-colors"
              >
                {advanced ? '−' : '+'}
              </span>
              {advanced ? t('torque.advanced_hide') : t('torque.advanced_show')}
            </button>

            {advanced && (
              <div className="mt-3 pl-4 border-l-2 border-tp-border-2">
                <SectionLabel>{t('torque.material')}</SectionLabel>
                <div className="grid grid-cols-3 gap-3">
                  <F label={t('torque.bolt_rm')} field="bolt_rm_mpa" unit="MPa" {...fp} />
                  <F label={t('torque.nut_proof')} field="nut_proof_mpa" unit="MPa" {...fp} />
                  <F label={t('torque.internal_rm')} field="internal_rm_mpa" unit="MPa" {...fp} />
                </div>
                <SectionLabel>{t('torque.engagement')}</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <F label={t('torque.engagement_len')} field="engagement_mm" unit="mm" {...fp} />
                </div>
              </div>
            )}
          </div>

          {/* CTA */}
          <div id="guide-anchor-cta" className="mt-6 flex items-center gap-3">
            <button
              onClick={calculate}
              disabled={loading}
              className="px-10 py-3 bg-tp-accent hover:bg-tp-accent-light active:brightness-90
                         text-white text-[14px] font-semibold rounded-md tracking-wide
                         transition-colors shadow-[0_1px_4px_rgba(74,124,201,0.30)]
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-tp-accent
                         disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? t('torque.calculating') : t('torque.calculate')}
            </button>
            {error && <span className="text-tp-error text-xs">{error}</span>}
          </div>
        </div>

        {/* ── DIVIDER ───────────────────────────────────────────────────────── */}
        <div className="w-px bg-tp-border shrink-0 self-stretch" />

        {/* ── RIGHT: Results — sticky rail, no own scroll ───────────────────── */}
        <div
          id="guide-anchor-result"
          className="w-[320px] shrink-0 px-5 py-4 flex flex-col gap-0 self-start sticky top-0 bg-tp-result"
        >

          {/* 1. Primary result: Torque */}
          <div className={`rounded-md p-4 transition-colors
            ${result ? 'bg-tp-accent/8 border border-tp-accent/25' : 'bg-tp-result border border-tp-border-2'}`}>
            <div className="text-[10px] text-tp-text-3 mb-2 tracking-wide">
              {t('torque.result_title')}
            </div>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className={`text-[2.25rem] leading-none font-bold tabular-nums tracking-tight
                ${result ? 'text-tp-accent-light' : 'text-tp-text-3'}`}>
                {result ? result.torque_nom_nm.toFixed(1) : '—'}
              </span>
              {result && <span className="text-base text-tp-text-3 font-normal">Nm</span>}
            </div>
            {result && (
              <div className="flex gap-5 text-[11px]">
                <span className="text-tp-text-3">
                  Min <span className="text-tp-text-2 tabular-nums ml-1">{result.torque_min_nm.toFixed(1)} Nm</span>
                </span>
                <span className="text-tp-text-3">
                  Max <span className="text-tp-text-2 tabular-nums ml-1">{result.torque_max_nm.toFixed(1)} Nm</span>
                </span>
              </div>
            )}
          </div>

          {/* 2. Preload */}
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-[11px] text-tp-text-3">{t('torque.preload')}</span>
            <div className="text-right">
              {result ? (
                <>
                  <span className="text-xl font-bold tabular-nums text-tp-text">
                    {(result.preload_n / 1000).toFixed(1)}
                  </span>
                  <span className="text-sm text-tp-text-3 ml-1">kN</span>
                  <div className="text-[10px] text-tp-text-3">{result.preload_n.toFixed(0)} N</div>
                </>
              ) : <span className="text-tp-text-3">—</span>}
            </div>
          </div>

          <div className="h-px bg-tp-border/60 my-3" />

          {/* 3. Limit state */}
          {result ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-tp-text-3">{t('torque.nut_util')}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold tabular-nums ${nutColor}`}>
                    {nutUtil.toFixed(1)}%
                  </span>
                  <StatusBadge variant={nutBadge}>{nutLabel}</StatusBadge>
                </div>
              </div>
              {/* Utilization bar */}
              <div className="h-1.5 rounded-full bg-tp-surface-3 overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(nutUtil, 100)}%`,
                    // NOTE: 75/90 thresholds are UNSOURCED (UI-only).
                    // Bar uses computedResult (neutral engineering result color).
                    backgroundColor: EV.computedResult,
                  }}
                />
              </div>

              {/* 4. Safety factors */}
              <ResultRow
                label={t('torque.thread_sf_int')}
                value={result.internal_thread_sf.toFixed(2)}
                color={sfColor(result.internal_thread_sf)}
              />
              <ResultRow
                label={t('torque.thread_sf_ext')}
                value={result.external_thread_sf.toFixed(2)}
                color={sfColor(result.external_thread_sf)}
              />
            </div>
          ) : (
            <div className="text-[12px] text-tp-text-3 py-3">
              {t('torque.empty')}
            </div>
          )}

          <div className="h-px bg-tp-border/60 my-3" />

          {/* 5. Contextual joint diagram (GEOMETRY-CONTEXT-01) */}
          <div className="mb-1">
            <div className="text-[10px] text-tp-text-3 tracking-wide">
              {CONTEXT_TITLE[visualFocus]}
            </div>
            {CONTEXT_SUB[visualFocus] && (
              <div className="text-[9px] text-tp-text-3 mt-0.5 leading-none">
                {CONTEXT_SUB[visualFocus]}
              </div>
            )}
          </div>
          <TorqueContextDiagram
            focus={visualFocus}
            result={result}
            className="w-full max-h-[260px]"
          />

          {/* 6. Traceability footer */}
          <div className="mt-auto pt-3 text-[10px] text-tp-text-3 leading-relaxed">
            {t('torque.footer')}
          </div>
        </div>
      </div>
    </>
  )
}
