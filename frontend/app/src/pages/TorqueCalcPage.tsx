import { useState, useRef } from 'react'
import StatusBadge from '../components/ui/StatusBadge'
import JointVisualization from '../components/engineering/JointVisualization'
import ModuleGuideDrawer from '../components/guidance/ModuleGuideDrawer'
import { engineeringCheck } from '../services/torque'
import type { EngineeringCheckRequest, EngineeringCheckResult } from '../types/api'
import { torqueGuide } from '../guides/torqueGuide'
import type { ExampleValues } from '../guides/GuideSchema'

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
}: {
  label: string
  field: keyof EngineeringCheckRequest
  unit?: string
  form: EngineeringCheckRequest
  onChange: (f: keyof EngineeringCheckRequest, v: string) => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[12px] text-tp-text-3 leading-none">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number" step="any"
          value={form[field]}
          onChange={e => onChange(field, e.target.value)}
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
  const [form, setForm] = useState<EngineeringCheckRequest>(DEFAULTS)
  const [result, setResult] = useState<EngineeringCheckResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [advanced, setAdvanced] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

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

  const fp = { form, onChange: update } as const

  const nutUtil = result?.nut_proof_util_pct ?? 0
  const nutColor = nutUtil > 90 ? 'text-tp-error' : nutUtil > 75 ? 'text-tp-warn' : 'text-tp-valid'
  const nutBadge = nutUtil > 90 ? 'error' as const : nutUtil > 75 ? 'warning' as const : 'validated' as const
  const nutLabel = nutUtil > 90 ? 'Riskli' : nutUtil > 75 ? 'Sınırda' : 'Uygun'
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
              Tork Hesap
              <span className="ml-2 text-[11px] font-normal text-tp-text-3">
                — Mühendislik Kontrolü
              </span>
            </h1>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              aria-label="Modül rehberini aç"
              className="flex items-center gap-1 text-[11px] text-tp-text-3
                         hover:text-tp-accent transition-colors
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-tp-accent
                         rounded px-1 py-0.5"
            >
              <span className="text-[13px] leading-none" aria-hidden="true">ⓘ</span>
              <span>Modül Rehberi</span>
            </button>
          </div>

          {/* Primary: Geometry */}
          <div id="guide-anchor-geometri">
            <SectionLabel>Geometri</SectionLabel>
            <div className="grid grid-cols-4 gap-3">
              <F label="Çap (d)" field="diameter_mm" unit="mm" {...fp} />
              <F label="Adım (P)" field="pitch_mm" unit="mm" {...fp} />
              <F label="As" field="stress_area_mm2" unit="mm²" {...fp} />
              <F label="Dw" field="effective_bearing_diameter_mm" unit="mm" {...fp} />
            </div>
          </div>

          {/* Primary: Friction */}
          <div id="guide-anchor-surtunme">
            <SectionLabel>Sürtünme (μ)</SectionLabel>
            <div className="grid grid-cols-3 gap-3 mb-1">
              <F label="Diş min" field="mu_thread_min" {...fp} />
              <F label="Diş nom" field="mu_thread_nom" {...fp} />
              <F label="Diş max" field="mu_thread_max" {...fp} />
              <F label="Oturma Yüzeyi μ min" field="mu_bearing_min" {...fp} />
              <F label="Oturma Yüzeyi μ nom" field="mu_bearing_nom" {...fp} />
              <F label="Oturma Yüzeyi μ max" field="mu_bearing_max" {...fp} />
            </div>
          </div>

          {/* Primary: Target */}
          <div id="guide-anchor-hedef">
            <SectionLabel>Hedef</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <F label="Akma kullanım oranı" field="target_yield_ratio" {...fp} />
              <F label="Rp0.2" field="rp02_mpa" unit="MPa" {...fp} />
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
              {advanced ? 'Gelişmiş parametreleri gizle' : 'Gelişmiş parametreler'}
            </button>

            {advanced && (
              <div className="mt-3 pl-4 border-l-2 border-tp-border-2">
                <SectionLabel>Malzeme Dayanımı</SectionLabel>
                <div className="grid grid-cols-3 gap-3">
                  <F label="Civata Rm" field="bolt_rm_mpa" unit="MPa" {...fp} />
                  <F label="Somun Proof" field="nut_proof_mpa" unit="MPa" {...fp} />
                  <F label="İç Malzeme Rm" field="internal_rm_mpa" unit="MPa" {...fp} />
                </div>
                <SectionLabel>Diş Kavrama</SectionLabel>
                <div className="grid grid-cols-2 gap-3">
                  <F label="Kavrama uzunluğu (le)" field="engagement_mm" unit="mm" {...fp} />
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
              {loading ? 'Hesaplanıyor…' : 'Hesapla'}
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
              Önerilen Sıkma Torku
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
            <span className="text-[11px] text-tp-text-3">Ön Yük (Fv)</span>
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
                <span className="text-[11px] text-tp-text-3">Somun kullanım</span>
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
                    backgroundColor: nutUtil > 90 ? '#c04040' : nutUtil > 75 ? '#c8860e' : '#1b9e7a',
                  }}
                />
              </div>

              {/* 4. Safety factors */}
              <ResultRow
                label="Diş SF (iç)"
                value={result.internal_thread_sf.toFixed(2)}
                color={sfColor(result.internal_thread_sf)}
              />
              <ResultRow
                label="Diş SF (dış)"
                value={result.external_thread_sf.toFixed(2)}
                color={sfColor(result.external_thread_sf)}
              />
            </div>
          ) : (
            <div className="text-[12px] text-tp-text-3 py-3">
              Hesap sonuçları burada görünecek
            </div>
          )}

          <div className="h-px bg-tp-border/60 my-3" />

          {/* 5. Joint visualization */}
          <div className="text-[10px] text-tp-text-3 mb-1 tracking-wide">
            Bağlantı Diyagramı
          </div>
          <JointVisualization result={result} />

          {/* 6. Traceability footer */}
          <div className="mt-auto pt-3 text-[10px] text-tp-text-3 leading-relaxed">
            Deterministik hesap · VDI 2230 tabanlı · Backend yetkili
          </div>
        </div>
      </div>
    </>
  )
}
