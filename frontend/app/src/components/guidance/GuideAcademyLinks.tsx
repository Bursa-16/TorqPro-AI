// ── GuideAcademyLinks.tsx ───────────────────────────────────────────────────
// Renders the Academy / Tutorial link slots.
// Unavailable links render as "Yakında" disabled entries.
// ────────────────────────────────────────────────────────────────────────────
import type { AcademyLink } from '../../guides/torqueGuide'

interface GuideAcademyLinksProps {
  links: AcademyLink[]
}

export default function GuideAcademyLinks({ links }: GuideAcademyLinksProps) {
  return (
    <div className="space-y-2">
      {/* Future AI affordance — reserved, disabled */}
      <div className="rounded-md border border-tp-border bg-tp-workspace/30 px-3 py-2.5
                      opacity-60 cursor-not-allowed select-none">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[13px] font-semibold text-tp-text">Bu Modül Hakkında AI'ya Sor</div>
            <div className="text-[12px] text-tp-text-3 mt-0.5 leading-snug">
              Tork hesabı hakkında sorularınızı sorun
            </div>
          </div>
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider
                           border border-tp-border-2 rounded px-1.5 py-0.5 text-tp-text-2">
            Yakında
          </span>
        </div>
      </div>

      <div className="h-px bg-tp-border my-1.5" />

      {/* Tutorial links */}
      {links.map((link, i) => (
        link.available && link.href ? (
          <a
            key={i}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md border border-tp-border bg-tp-workspace/30 px-3 py-2.5
                       hover:border-tp-accent/40 hover:bg-tp-accent/5 transition-colors
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1
                       focus-visible:outline-tp-accent"
          >
            <div className="text-[13px] font-semibold text-tp-accent">{link.title}</div>
            <div className="text-[12px] text-tp-text-3 mt-0.5 leading-snug">{link.description}</div>
          </a>
        ) : (
          <div
            key={i}
            className="rounded-md border border-tp-border bg-tp-workspace/20 px-3 py-2.5
                       opacity-60 cursor-not-allowed select-none"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-semibold text-tp-text">{link.title}</div>
                <div className="text-[12px] text-tp-text-3 mt-0.5 leading-snug">{link.description}</div>
              </div>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider
                               border border-tp-border-2 rounded px-1.5 py-0.5 text-tp-text-2">
                Yakında
              </span>
            </div>
          </div>
        )
      ))}
    </div>
  )
}
