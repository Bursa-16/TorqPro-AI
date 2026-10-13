import { useMemo } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import Sidebar from './Sidebar'
import { BREADCRUMB_MAP } from '../lib/navigation'
import { useLanguage, type Lang } from '../i18n/LanguageContext'

const logoSrc = `${import.meta.env.BASE_URL}torqpro-ai-logo.png`

// AI provider status — hidden until AI-VERIFY-01 establishes a real runtime source.
function AiStatusBadge() {
  return null
}

// ── Language Switcher ─────────────────────────────────────────────────────────
// Compact TR | EN toggle — visible on all viewport sizes.
// Meets HARD RULE 04: button semantics, aria-pressed, visible focus, no reload.
function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage()

  return (
    <div
      role="group"
      aria-label={t('shell.language_label')}
      className="flex items-center rounded overflow-hidden border border-tp-border shrink-0"
    >
      {(['tr', 'en'] as Lang[]).map((l, i) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={[
            'px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
            'transition-colors focus-visible:outline focus-visible:outline-2',
            'focus-visible:outline-offset-1 focus-visible:outline-tp-accent',
            i === 0 ? '' : 'border-l border-tp-border',
            lang === l
              ? 'bg-tp-accent text-white'
              : 'bg-transparent text-tp-text-3 hover:text-tp-text-2 hover:bg-tp-surface-2',
          ].join(' ')}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

// ── Breadcrumb derived from route ─────────────────────────────────────────────
function Breadcrumb({ pathname }: { pathname: string }) {
  const { t } = useLanguage()
  const entry = useMemo(() => BREADCRUMB_MAP[pathname] ?? null, [pathname])

  if (!entry) return <span className="text-xs text-tp-text-3">TorqPro</span>

  return (
    <nav className="flex items-center gap-1.5 text-xs">
      {entry.domainKey ? (
        <>
          <span className="text-tp-text-3">{t(entry.domainKey)}</span>
          <ChevronRight size={11} className="text-tp-text-3 shrink-0" />
          <span className="text-tp-text-2 font-medium">{t(entry.pageKey)}</span>
        </>
      ) : (
        <span className="text-tp-text-2 font-medium">{t(entry.pageKey)}</span>
      )}
    </nav>
  )
}

export default function AppShell({ user, role, onLogout }: {
  user: string | null; role: string | null; onLogout: () => void
}) {
  const location = useLocation()
  const { t } = useLanguage()

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="h-12 shrink-0 bg-tp-nav border-b border-tp-border
                         flex items-center px-4 gap-4">
        {/* Logo — always navigates home */}
        <Link
          to="/app"
          className="flex items-center gap-2 shrink-0 hover:opacity-90 transition-opacity"
        >
          <img src={logoSrc} alt="TorqPro AI" className="h-8 w-auto object-contain" />
          <span className="text-tp-text-3 font-normal text-[10px]">v3.3.4</span>
        </Link>

        {/* Breadcrumb */}
        <div className="flex-1 min-w-0">
          <Breadcrumb pathname={location.pathname} />
        </div>

        {/* Right controls */}
        <div className="shrink-0 flex items-center gap-3">
          <AiStatusBadge />
          <LanguageSwitcher />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-tp-text-2">{user}</span>
            <span className="text-tp-text-3 text-[10px]">({role})</span>
          </div>
          <button
            onClick={onLogout}
            className="text-xs text-tp-text-3 hover:text-tp-error transition-colors px-2 py-1
                       rounded hover:bg-tp-error-muted"
          >
            {t('shell.logout')}
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar role={role} />
        <main className="flex-1 overflow-hidden flex flex-col bg-tp-workspace">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
