// ── GuideFAQ.tsx ────────────────────────────────────────────────────────────
// Renders the "Sık Sorulan Sorular" section as a compact accordion list.
// ────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import type { FAQEntry } from '../../guides/GuideSchema'

interface GuideFAQProps {
  items: FAQEntry[]
}

export default function GuideFAQ({ items }: GuideFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (i: number) => setOpenIndex(prev => (prev === i ? null : i))

  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="border border-tp-border rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => toggle(i)}
            aria-expanded={openIndex === i}
            className="w-full flex items-start justify-between gap-2 px-3 py-2.5 text-left
                       hover:bg-tp-workspace/60 transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset
                       focus-visible:ring-tp-accent"
          >
            <span className="text-[13px] font-medium text-tp-text leading-snug">{item.question}</span>
            <span
              className="shrink-0 text-[11px] text-tp-text-3 mt-0.5 transition-transform duration-150"
              style={{ transform: openIndex === i ? 'rotate(180deg)' : 'rotate(0deg)' }}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>

          {openIndex === i && (
            <div className="px-3 pb-3 pt-1 bg-tp-workspace/30">
              <p className="text-[13px] text-tp-text-2 leading-[1.55]">{item.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
