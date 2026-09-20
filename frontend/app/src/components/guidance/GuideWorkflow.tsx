// ── GuideWorkflow.tsx ───────────────────────────────────────────────────────
// Renders the "Nasıl Kullanılır?" workflow step list.
// ────────────────────────────────────────────────────────────────────────────
import type { WorkflowStep } from '../../guides/GuideSchema'

interface GuideWorkflowProps {
  steps: WorkflowStep[]
  onHighlight?: (anchorId: string) => void
}

export default function GuideWorkflow({ steps, onHighlight }: GuideWorkflowProps) {
  return (
    <ol className="space-y-3.5">
      {steps.map(s => (
        <li key={s.step} className="flex gap-3">
          {/* Step number bubble */}
          <div className="shrink-0 w-6 h-6 rounded-full bg-tp-accent/15 border border-tp-accent/30
                          flex items-center justify-center mt-0.5">
            <span className="text-[11px] font-bold text-tp-accent">{s.step}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[13px] font-semibold text-tp-text">{s.title}</span>
              {s.anchorId && onHighlight && (
                <button
                  type="button"
                  onClick={() => onHighlight(s.anchorId!)}
                  title="Forma git"
                  className="text-[11px] text-tp-accent hover:text-tp-accent-light transition-colors
                             underline decoration-dotted focus-visible:outline-none
                             focus-visible:ring-1 focus-visible:ring-tp-accent rounded"
                >
                  ↗ göster
                </button>
              )}
            </div>
            <p className="text-[13px] text-tp-text-2 leading-[1.55]">{s.description}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
