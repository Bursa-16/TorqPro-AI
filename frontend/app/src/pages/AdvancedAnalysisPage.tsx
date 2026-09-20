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
 */

import { useState } from 'react'
import { Wrench, AlertTriangle, CheckCircle, Info, BookOpen } from 'lucide-react'
import ModuleGuideDrawer from '../components/guidance/ModuleGuideDrawer'
import { advancedAnalysisGuide } from '../guides/advancedAnalysisGuide'

// ── Types ─────────────────────────────────────────────────────────────────────
interface VdiInputs {
  v_plaka: number      // Plate thickness (mm)
  v_boy: number        // Bolt length (mm)
  v_n: number          // Number of fasteners
  v_FA: number         // Operating load FA (kN)
  v_dT: number         // ΔT temperature delta (°C) — display only, not in calculation
  v_malzeme: string    // Material
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
  v_dT: 0,
  v_malzeme: 'Çelik (E=210 GPa)',
}

// ── Calculation (exact parity with vdiHesapla()) ─────────────────────────────
function calculate(inputs: VdiInputs): VdiResult {
  const Ep = inputs.v_malzeme.includes('Alüm') ? 70000 : 210000
  const t = inputs.v_plaka
  const L = inputs.v_boy
  const n = inputs.v_n
  const FA = inputs.v_FA * 1000 // kN → N

  const dp = t / (Ep * 100)
  const db = L / (210000 * 78.5)
  const phi = dp / (dp + db)
  const FK = n * phi * FA

  return { dp, db, phi, FK, optimal: phi < 0.2 }
}

// ── Compliance diagram ────────────────────────────────────────────────────────
function ComplianceDiagram({ result }: { result: VdiResult | null }) {
  const phi = result?.phi ?? 0
  const x = Math.min(phi * 260 + 10, 268)
  const color = !result ? '#6b7280'
    : result.optimal ? '#16a37a'
    : result.phi < 0.35 ? '#d4870a'
    : '#dc2626'

  return (
    <svg viewBox="0 0 260 130" className="w-full" aria-label="Uyum diyagramı">
      {/* Track */}
      <rect x="10" y="50" width="240" height="12" rx="3" fill="#1e293b" />
      {/* Green zone */}
      <rect x="10" y="50" width="130" height="12" rx="3" fill="#16a37a" opacity="0.25" />
      {/* Yellow zone */}
      <rect x="140" y="50" width="60" height="12" rx="0" fill="#d4870a" opacity="0.25" />
      {/* Red zone */}
      <rect x="200" y="50" width="50" height="12" rx="3" fill="#dc2626" opacity="0.25" />

      {/* Needle */}
      {result && (
        <line x1={x} y1="40" x2={x} y2="74" stroke={color} strokeWidth="2" strokeLinecap="round" />
      )}

      {/* Scale labels */}
      <text x="10" y="85" fill="#94a3b8" fontSize="8" textAnchor="start">0</text>
      <text x="130" y="85" fill="#94a3b8" fontSize="8" textAnchor="middle">0.5</text>
      <text x="250" y="85" fill="#94a3b8" fontSize="8" textAnchor="end">1.0</text>

      {/* Threshold markers */}
      <line x1="64" y1="44" x2="64" y2="56" stroke="#16a37a" strokeWidth="1" strokeDasharray="2,2" />
      <text x="64" y="43" fill="#16a37a" fontSize="7" textAnchor="middle">0.2</text>
      <line x1="97" y1="44" x2="97" y2="56" stroke="#d4870a" strokeWidth="1" strokeDasharray="2,2" />
      <text x="97" y="43" fill="#d4870a" fontSize="7" textAnchor="middle">0.35</text>

      {/* Phi label */}
      <text x="130" y="115" fill={color} fontSize="11" fontWeight="700" textAnchor="middle">
        {result ? `Φ = ${result.phi.toFixed(3)}` : 'Φ = —'}
      </text>
    </svg>
  )
}

// ── Field ────────────────────────────────────────────────────────────────────
function F({
  label, field, unit, type = 'number', inputs, onChange
}: {
  label: string
  field: keyof VdiInputs
  unit?: string
  type?: 'number' | 'text'
  inputs: VdiInputs
  onChange: (f: keyof VdiInputs, v: string) => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[11px] text-tp-text-3 select-none">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type={type} step="any"
          value={inputs[field]}
          onChange={e => onChange(field, e.target.value)}
          className="w-full bg-tp-workspace border border-tp-border-2 rounded
                     px-2 py-1.5 text-[13px] text-tp-text tabular-nums
                     outline-none focus:border-tp-border-accent transition-colors"
        />
        {unit && <span className="text-[10px] text-tp-text-3 shrink-0 w-8">{unit}</span>}
      </div>
    </div>
  )
}

// ── Result row ────────────────────────────────────────────────────────────────
function ResultRow({ label, value, color = 'text-tp-text' }: {
  label: string; value: string; color?: string
}) {
  return (
    <div className="flex items-baseline justify-between py-1.5 border-b border-tp-border/40 last:border-0">
      <span className="text-[11px] text-tp-text-3">{label}</span>
      <span className={`text-[13px] font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdvancedAnalysisPage() {
  const [inputs, setInputs] = useState<VdiInputs>(DEFAULTS)
  const [result, setResult] = useState<VdiResult | null>(null)
  const [calculated, setCalculated] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)

  const update = (field: keyof VdiInputs, val: string) => {
    setInputs(prev => ({
      ...prev,
      [field]: field === 'v_malzeme' ? val : (parseFloat(val) || 0)
    }))
  }

  const run = () => {
    setResult(calculate(inputs))
    setCalculated(true)
  }

  const fp = { inputs, onChange: update } as const

  // Derived status
  const status = !result ? 'idle'
    : result.optimal ? 'optimal'
    : result.phi < 0.35 ? 'warn'
    : 'critical'

  const statusColor = {
    idle: 'text-tp-text-3',
    optimal: 'text-tp-valid',
    warn: 'text-tp-warn',
    critical: 'text-tp-error',
  }[status]

  const statusBg = {
    idle: 'bg-tp-result border-tp-border-2',
    optimal: 'bg-tp-validation border-tp-border-valid',
    warn: 'bg-tp-warn-muted border-tp-border-warn',
    critical: 'bg-tp-error-muted border-tp-border-error',
  }[status]

  return (
    <div className="flex h-full overflow-hidden">

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
          <div>
            <h1 className="text-[16px] font-semibold text-tp-text">
              Gelişmiş Bağlantı Analizi
              <span className="ml-2 text-[12px] font-normal text-tp-text-3">— Mühendislik Kontrolü</span>
            </h1>
            <p className="text-[11px] text-tp-text-3 mt-1 flex items-center gap-1.5">
              <Info size={11} className="shrink-0" />
              VDI 2230 Blatt 1 — flanş esnekliği, yük dağılım faktörü, ek cıvata kuvveti
            </p>
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            aria-label="Modül Rehberini aç"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-tp-border
                       bg-tp-module text-tp-text-2 text-[12px] font-medium
                       hover:border-tp-border-2 hover:text-tp-text transition-colors shrink-0
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-tp-border-accent"
          >
            <BookOpen size={13} />
            Modül Rehberi
          </button>
        </div>

        {/* Workflow step rail */}
        <div className="flex items-center gap-0 mb-6">
          {[
            { n: 1, label: 'Flanş Geometrisi' },
            { n: 2, label: 'Yük & Giriş' },
            { n: 3, label: 'Hesap' },
            { n: 4, label: 'Sonuçlar' },
          ].map((step, i, arr) => {
            const isActive = !calculated ? step.n <= 2 : step.n <= 4
            const isDone = calculated && step.n <= 3
            return (
              <div key={step.n} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border
                    ${isDone ? 'bg-tp-valid border-tp-border-valid text-white'
                      : isActive ? 'bg-tp-module border-tp-border-accent text-tp-accent-light'
                      : 'bg-tp-module border-tp-border text-tp-text-3'}`}>
                    {isDone ? <CheckCircle size={12} /> : step.n}
                  </div>
                  <span className={`text-[9px] mt-1 whitespace-nowrap ${isActive ? 'text-tp-text-2' : 'text-tp-text-3'}`}>
                    {step.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div className={`flex-1 h-px mx-1 mb-4 ${isDone ? 'bg-tp-border-valid' : 'bg-tp-border'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Input module — Flanş Geometrisi */}
        <div className="bg-tp-module border border-tp-border-2 rounded-md overflow-hidden mb-3">
          <div className="tp-module-header px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-tp-text-2">
              Flanş Geometrisi
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <F label="Plaka kalınlığı" field="v_plaka" unit="mm" {...fp} />
            <F label="Cıvata boyu" field="v_boy" unit="mm" {...fp} />
          </div>
        </div>

        {/* Input module — Yük & Malzeme */}
        <div className="bg-tp-module border border-tp-border-2 rounded-md overflow-hidden mb-3">
          <div className="tp-module-header px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-tp-text-2">
              Yük & Malzeme
            </span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <F label="Yük giriş faktörü (n)" field="v_n" {...fp} />
            <F label="İşletme yükü FA" field="v_FA" unit="kN" {...fp} />
            <F label="ΔT" field="v_dT" unit="°C" {...fp} />
            <div className="col-span-2 flex flex-col gap-0.5">
              <label className="text-[11px] text-tp-text-3 select-none">Plaka malzemesi</label>
              <select
                value={inputs.v_malzeme}
                onChange={e => update('v_malzeme', e.target.value)}
                className="bg-tp-workspace border border-tp-border-2 rounded
                           px-2 py-1.5 text-[13px] text-tp-text
                           outline-none focus:border-tp-border-accent transition-colors"
              >
                <option>Çelik (E=210 GPa)</option>
                <option>Alüminyum (E=70 GPa)</option>
                <option>Dökme demir</option>
              </select>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3 mt-5">
          <button
            onClick={run}
            className="flex items-center gap-2 px-10 py-3 bg-tp-accent hover:bg-tp-accent-light
                       active:brightness-90 text-white text-[14px] font-semibold rounded-md
                       tracking-wide transition-colors
                       shadow-[0_1px_4px_rgba(74,124,201,0.30)]
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-tp-border-accent"
          >
            <Wrench size={15} />
            VDI 2230 Çalıştır
          </button>
        </div>

        {/* Methodology note */}
        <div className="mt-6 p-3 bg-tp-module border border-tp-border rounded-md">
          <div className="flex gap-2">
            <Info size={12} className="text-tp-text-3 shrink-0 mt-0.5" />
            <div className="text-[10px] text-tp-text-3 space-y-0.5">
              <div>VDI 2230 R1–R13 tabanlı basitleştirilmiş esneklik modeli.</div>
              <div>δp = t/(Ep·100) · δb = L/(210000·78.5) · Φ = δp/(δp+δb)</div>
              <div>Tam VDI 2230 analizi için malzeme, form faktörleri ve ısıl etkileri dikkate alınmalıdır.</div>
              <div className="text-tp-text-3/70">ΔT alanı gösterim amaçlı — mevcut hesapta ısıl etki dahil edilmemiştir.</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── DIVIDER ───────────────────────────────────────────────────── */}
      <div className="w-px bg-tp-border shrink-0 self-stretch" />

      {/* ── RIGHT: Results ────────────────────────────────────────────── */}
      <div className="w-[320px] shrink-0 px-5 py-4 flex flex-col gap-0 self-start sticky top-0 bg-tp-result">

        {/* Primary result: status + Φ */}
        <div className={`rounded-md p-4 border-l-2 mb-3 ${statusBg}`}>
          <div className="text-[10px] text-tp-text-3 mb-2 tracking-wide uppercase">
            Genel Değerlendirme
          </div>
          {result ? (
            <div className="flex items-center gap-2 mb-1">
              {result.optimal
                ? <CheckCircle size={18} className="text-tp-valid shrink-0" />
                : <AlertTriangle size={18} className={`shrink-0 ${result.phi < 0.35 ? 'text-tp-warn' : 'text-tp-error'}`} />
              }
              <span className={`text-[15px] font-bold ${statusColor}`}>
                {result.optimal ? 'Optimal Bağlantı' : result.phi < 0.35 ? 'Kontrol Edilmeli' : 'Kritik — Yük Fazla'}
              </span>
            </div>
          ) : (
            <span className="text-[13px] text-tp-text-3">Hesap bekleniyor</span>
          )}
        </div>

        {/* Compliance diagram */}
        <div className="bg-tp-bg border border-tp-border rounded-md p-3 mb-3">
          <div className="text-[10px] text-tp-text-3 mb-2 uppercase tracking-wide">
            Yük Dağılım Faktörü Φ
          </div>
          <ComplianceDiagram result={result} />
        </div>

        {/* Scalar results */}
        <div className="bg-tp-module border border-tp-border-2 rounded-md p-3 mb-3">
          <div className="text-[10px] text-tp-text-3 mb-2 uppercase tracking-wide">Analiz Sonuçları</div>
          <ResultRow label="Plaka Esnekliği δp"
            value={result ? `${(result.dp * 1e6).toFixed(2)} ×10⁻⁶ mm/N` : '—'} />
          <ResultRow label="Cıvata Esnekliği δb"
            value={result ? `${(result.db * 1e6).toFixed(2)} ×10⁻⁶ mm/N` : '—'} />
          <ResultRow label="Yük Dağılım Faktörü Φ"
            value={result ? result.phi.toFixed(3) : '—'}
            color={result ? (result.optimal ? 'text-tp-valid' : result.phi < 0.35 ? 'text-tp-warn' : 'text-tp-error') : 'text-tp-text'} />
          <ResultRow label="Ek Cıvata Kuvveti ΔFb"
            value={result ? `${(result.FK / 1000).toFixed(2)} kN` : '—'}
            color={result ? (result.optimal ? 'text-tp-accent-light' : 'text-tp-warn') : 'text-tp-text'} />
        </div>

        {/* Deferred note */}
        <div className="rounded-md p-3 bg-tp-module border border-tp-border">
          <div className="text-[10px] text-tp-text-3 mb-1 uppercase tracking-wide">Ertelenmiş Analizler</div>
          <div className="text-[10px] text-tp-text-3 space-y-0.5">
            <div>• Akma emniyeti — mevcut API'da yok</div>
            <div>• Ayrılma emniyeti — mevcut API'da yok</div>
            <div>• Bağlantı rijitliği grafikleri — skalar veri yok</div>
            <div>• Basınç dağılımı — konumsal veri yok</div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 text-[10px] text-tp-text-3 text-center">
          Deterministik hesap · VDI 2230 tabanlı · Frontend hesap
        </div>
      </div>
    </div>
  )
}
