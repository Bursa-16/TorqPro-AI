// ── GuideExample.tsx ────────────────────────────────────────────────────────
// Renders Section 4: Örnek Uygulama.
// Provides "Örneği Forma Yükle" and "Değerleri Geri Al" actions.
// Does NOT auto-submit. User must press "Hesapla" manually.
// ────────────────────────────────────────────────────────────────────────────
import type { GuideExample as GuideExampleType, ExampleValues } from '../../guides/GuideSchema'

interface GuideExampleProps {
  example: GuideExampleType
  onLoadExample: (values: ExampleValues) => void
  onRestoreSnapshot: () => void
  hasSnapshot: boolean
}

export default function GuideExample({
  example,
  onLoadExample,
  onRestoreSnapshot,
  hasSnapshot,
}: GuideExampleProps) {
  return (
    <div className="space-y-3">
      {/* Example header */}
      <div className="rounded-md border border-tp-border-calc bg-tp-calc-muted/30 px-3 py-2.5">
        <div className="text-[13px] font-semibold text-tp-calc mb-1">{example.title}</div>
        <p className="text-[13px] text-tp-text-2 leading-[1.55]">{example.useCase}</p>
      </div>

      {/* Input values preview */}
      <div className="rounded-md border border-tp-border bg-tp-workspace/40 px-3 py-2.5">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-tp-text-3 mb-2">
          Girdi Değerleri
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[
            ['d', example.values.diameter_mm, 'mm'],
            ['P', example.values.pitch_mm, 'mm'],
            ['As', example.values.stress_area_mm2, 'mm²'],
            ['Dw', example.values.effective_bearing_diameter_mm, 'mm'],
            ['Rp0.2', example.values.rp02_mpa, 'MPa'],
            ['ν', example.values.target_yield_ratio, ''],
            ['μ diş nom', example.values.mu_thread_nom, ''],
            ['μ oturma nom', example.values.mu_bearing_nom, ''],
            ['le', example.values.engagement_mm, 'mm'],
            ['Rm civata', example.values.bolt_rm_mpa, 'MPa'],
          ].map(([label, value, unit]) => (
            <div key={String(label)} className="flex items-baseline gap-1">
              <span className="text-[11px] text-tp-text-3 font-mono">{label}</span>
              <span className="text-[12px] text-tp-text-2 font-semibold tabular-nums">{String(value)}</span>
              {unit && <span className="text-[11px] text-tp-text-3">{String(unit)}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <p className="text-[12px] text-tp-text-3 leading-[1.5] italic">{example.notes}</p>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap pt-1">
        <button
          type="button"
          onClick={() => onLoadExample(example.values)}
          className="px-4 py-2 bg-tp-accent hover:bg-tp-accent-light transition-colors
                     text-white text-[13px] font-semibold rounded-md
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-tp-accent"
        >
          Örneği Forma Yükle
        </button>

        {hasSnapshot && (
          <button
            type="button"
            onClick={onRestoreSnapshot}
            className="px-4 py-2 border border-tp-border-2 hover:border-tp-border-strong
                       text-tp-text-2 text-[13px] font-semibold rounded-md transition-colors
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-tp-accent"
          >
            Değerleri Geri Al
          </button>
        )}
      </div>

      <p className="text-[12px] text-tp-text-3 leading-snug">
        Değerler forma yüklenir; hesap otomatik başlamaz. "Hesapla" düğmesine manuel olarak tıklayın.
      </p>
    </div>
  )
}
