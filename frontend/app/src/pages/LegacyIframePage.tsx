import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, AlertTriangle, RefreshCw, BookOpen } from 'lucide-react'
import ModuleGuideDrawer from '../components/guidance/ModuleGuideDrawer'
import { guideFor } from '../guides/guideRegistry'

interface Props {
  legacyPageId: string
  label: string
  /** Optional: when provided and a guide exists for this id, renders ModuleGuideDrawer */
  moduleId?: string
}

export default function LegacyIframePage({ legacyPageId, label, moduleId }: Props) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [guideOpen, setGuideOpen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Resolve guide — null when not yet authored for this module
  const guide = moduleId ? guideFor(moduleId) : null

  // Auth polling — detect if legacy doLogout() cleared the token
  const startPoll = useCallback((onLoggedOut: () => void) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => {
      const token = sessionStorage.getItem('torqpro_token')
      if (!token) {
        clearInterval(pollRef.current!)
        onLoggedOut()
      }
    }, 500)
  }, [])

  useEffect(() => {
    // Start auth polling — if legacy clears the token, navigate to login
    startPoll(() => {
      // Token gone — force React logout by dispatching a storage event
      // that useAuth will pick up on next render. Simplest: force reload.
      window.location.href = '/'
    })
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [startPoll])

  // Key the iframe on legacyPageId so it remounts on page change
  const iframeSrc = `/legacy/index.html#${legacyPageId}`

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      {/* Guide drawer — additive, does not change iframe behavior */}
      {guide && (
        <ModuleGuideDrawer
          guide={guide}
          open={guideOpen}
          onClose={() => setGuideOpen(false)}
        />
      )}

      {/* Modül Rehberi floating trigger button — visible only when a guide exists */}
      {guide && !guideOpen && (
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          aria-label="Modül Rehberini Aç"
          className="absolute top-3 right-3 z-20 flex items-center gap-1.5
                     px-3 py-1.5 rounded-full
                     bg-tp-surface-2 border border-tp-border
                     text-tp-text-2 text-[12px] font-medium
                     hover:bg-tp-surface-3 hover:border-tp-border-2 hover:text-tp-text
                     transition-colors shadow-sm
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                     focus-visible:outline-tp-accent"
        >
          <BookOpen size={13} className="text-tp-accent" />
          Modül Rehberi
        </button>
      )}

      {/* Loading state */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-tp-bg z-10">
          <div className="flex items-center gap-3 text-tp-text-2 text-sm">
            <Loader2 size={16} className="animate-spin text-tp-accent" />
            <span>{label} yükleniyor...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-tp-bg z-10">
          <div className="text-center">
            <AlertTriangle size={24} className="text-tp-warn mx-auto mb-3" />
            <p className="text-tp-text-2 text-sm mb-4">{label} sayfası yüklenemedi.</p>
            <button
              onClick={() => { setStatus('loading'); iframeRef.current?.contentWindow?.location.reload() }}
              className="flex items-center gap-2 px-4 py-1.5 rounded bg-tp-surface-2 border border-tp-border
                         text-tp-text-2 text-xs hover:bg-tp-surface-3 transition-colors mx-auto"
            >
              <RefreshCw size={12} /> Tekrar dene
            </button>
          </div>
        </div>
      )}

      {/* The iframe — fills the available workspace */}
      <iframe
        key={legacyPageId}
        ref={iframeRef}
        src={iframeSrc}
        title={label}
        sandbox="allow-same-origin allow-scripts allow-popups allow-downloads allow-forms"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        style={{
          width: '100%',
          flex: 1,
          border: 'none',
          // Visible once loaded; hidden during loading/error (overlay covers it)
          visibility: status === 'loading' ? 'hidden' : 'visible',
        }}
        className="flex-1"
      />
    </div>
  )
}
