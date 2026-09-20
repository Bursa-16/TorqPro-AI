// ── GuideSection.tsx ────────────────────────────────────────────────────────
// Accordion section wrapper for ModuleGuideDrawer.
// Each section has a header that toggles its content.
// ────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'

interface GuideSectionProps {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export default function GuideSection({ title, defaultOpen = false, children }: GuideSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-tp-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 text-left
                   hover:bg-tp-workspace/60 transition-colors focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tp-accent"
      >
        <span className="text-[13px] font-semibold text-tp-text">{title}</span>
        <span
          className="ml-2 shrink-0 w-4 h-4 flex items-center justify-center
                     text-tp-text-3 text-[11px] transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1">
          {children}
        </div>
      )}
    </div>
  )
}
