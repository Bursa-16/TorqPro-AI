// ── GuideParameterList.tsx ──────────────────────────────────────────────────
// Renders the "Parametreler" section with engineering field explanations.
// ────────────────────────────────────────────────────────────────────────────
import type { ParameterEntry } from '../../guides/GuideSchema'

interface GuideParameterListProps {
  parameters: ParameterEntry[]
  onHighlight?: (anchorId: string) => void
}

export default function GuideParameterList({ parameters, onHighlight }: GuideParameterListProps) {
  return (
    <div className="space-y-3">
      {parameters.map((p, i) => (
        <div
          key={i}
          className="rounded-md border border-tp-border bg-tp-workspace/40 px-3 py-2.5"
        >
          {/* Header row */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[13px] font-semibold text-tp-text">{p.label}</span>
            {p.symbol && (
              <span className="text-[12px] font-mono text-tp-calc italic">{p.symbol}</span>
            )}
            {p.unit && (
              <span className="text-[11px] text-tp-text-3 ml-auto shrink-0">[{p.unit}]</span>
            )}
            {p.anchorId && onHighlight && (
              <button
                type="button"
                onClick={() => onHighlight(p.anchorId!)}
                title="Formdaki alana git"
                className="text-[11px] text-tp-accent hover:text-tp-accent-light transition-colors
                           underline decoration-dotted ml-1 focus-visible:outline-none
                           focus-visible:ring-1 focus-visible:ring-tp-accent rounded"
              >
                ↗
              </button>
            )}
          </div>

          {/* Explanation */}
          <p className="text-[13px] text-tp-text-2 leading-[1.55]">{p.explanation}</p>

          {/* Caution */}
          {p.caution && (
            <div className="mt-2 flex gap-2 items-start">
              <span className="text-tp-warn text-[12px] mt-px shrink-0">⚠</span>
              <p className="text-[12px] text-tp-warn leading-[1.5]">{p.caution}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
