// ── ModuleGuideDrawer.tsx ───────────────────────────────────────────────────
// Professional resizable/dockable guidance panel for TorqPro.
//
// MODES:
//   normal    — right-docked panel, user-resizable
//   minimized — compact right-edge tab, one-click restore
//   maximized — fills available workspace with 3-col layout
//
// RESIZE HANDLES (normal mode only):
//   left edge   → horizontal (ew-resize)
//   bottom edge → vertical   (s-resize)
//   bottom-left → diagonal   (nesw-resize)
//
// PERSISTENCE:
//   localStorage key: torqpro_module_guide_layout
//   stores: { width, height } — UI layout only, no engineering data
//
// ACCESSIBILITY:
//   focus trap, ESC close, aria-labels, visible focus states
// ────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useState, useCallback } from 'react'
import GuideSection from './GuideSection'
import GuideWorkflow from './GuideWorkflow'
import GuideParameterList from './GuideParameterList'
import GuideExample from './GuideExample'
import GuideFAQ from './GuideFAQ'
import GuideAcademyLinks from './GuideAcademyLinks'
import GuidedDemo from './GuidedDemo'
import type { ModuleGuide, ExampleValues } from '../../guides/GuideSchema'

// ── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'torqpro_module_guide_layout'
const DEFAULT_WIDTH = 460
const DEFAULT_HEIGHT_VH = 0.80   // 80% of viewport height
const MIN_WIDTH = 380
const MIN_HEIGHT = 320
const HANDLE_PX = 6              // hit target thickness for resize handles

type PanelMode = 'normal' | 'minimized' | 'maximized'

interface LayoutState {
  width: number
  height: number
}

function loadLayout(): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultLayout()
    const parsed = JSON.parse(raw) as Partial<LayoutState>
    const w = Number(parsed.width)
    const h = Number(parsed.height)
    if (w >= MIN_WIDTH && h >= MIN_HEIGHT) return { width: w, height: h }
  } catch { /* ignore */ }
  return defaultLayout()
}

function defaultLayout(): LayoutState {
  return {
    width: DEFAULT_WIDTH,
    height: Math.max(MIN_HEIGHT, Math.round(window.innerHeight * DEFAULT_HEIGHT_VH)),
  }
}

function saveLayout(l: LayoutState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(l)) } catch { /* ignore */ }
}

function clampWidth(w: number) {
  const maxW = Math.min(Math.round(window.innerWidth * 0.75), 1100)
  return Math.max(MIN_WIDTH, Math.min(w, maxW))
}

function clampHeight(h: number) {
  return Math.max(MIN_HEIGHT, Math.min(h, window.innerHeight))
}

// ── Props ────────────────────────────────────────────────────────────────────
interface ModuleGuideDrawerProps {
  guide: ModuleGuide
  open: boolean
  onClose: () => void
  /** Called when user loads example values into the page form (optional) */
  onLoadExample?: (values: ExampleValues) => void
  /** Called when user restores their pre-example snapshot (optional) */
  onRestoreSnapshot?: () => void
  hasSnapshot?: boolean
  /** Called when a workflow step / parameter anchor is clicked */
  onHighlight?: (anchorId: string) => void
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ModuleGuideDrawer({
  guide,
  open,
  onClose,
  onLoadExample,
  onRestoreSnapshot,
  hasSnapshot = false,
  onHighlight,
}: ModuleGuideDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // ── Panel mode + size ─────────────────────────────────────────────────────
  const [mode, setMode] = useState<PanelMode>('normal')
  const [layout, setLayout] = useState<LayoutState>(loadLayout)
  // Remember size before maximize so we can restore
  const preMaxLayout = useRef<LayoutState | null>(null)

  // ── Guided Demo state ─────────────────────────────────────────────────────
  const [demoActive, setDemoActive] = useState(false)
  const [demoStep, setDemoStep] = useState(0)

  // ── Resize drag state (refs — don't need re-render) ───────────────────────
  const dragType = useRef<'ew' | 'ns' | 'nesw' | null>(null)
  const dragStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  // ── Persist layout whenever it changes ───────────────────────────────────
  useEffect(() => { saveLayout(layout) }, [layout])

  // ── ESC → close (when not resizing/maximized/demo) ────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !demoActive && mode !== 'maximized') {
        e.preventDefault(); onClose()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose, demoActive, mode])

  // ── Focus into drawer on open ─────────────────────────────────────────────
  useEffect(() => {
    if (open && mode !== 'minimized') {
      const t = setTimeout(() => closeButtonRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open, mode])

  // ── Focus trap ────────────────────────────────────────────────────────────
  const handleDrawerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !drawerRef.current) return
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]'
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus() }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus() }
    }
  }

  // ── Window control handlers ───────────────────────────────────────────────
  const minimize = () => setMode('minimized')

  const maximize = () => {
    preMaxLayout.current = { ...layout }
    setMode('maximized')
  }

  const restore = () => {
    if (preMaxLayout.current) {
      setLayout(preMaxLayout.current)
      preMaxLayout.current = null
    }
    setMode('normal')
  }

  const handleMaxToggle = () => mode === 'maximized' ? restore() : maximize()

  // ── Demo helpers ──────────────────────────────────────────────────────────
  const startDemo = () => {
    setDemoStep(0); setDemoActive(true); onClose()
  }

  const exitDemo = () => {
    setDemoActive(false)
    document.querySelectorAll('[data-guide-highlight]').forEach(el => {
      el.removeAttribute('data-guide-highlight')
      const h = el as HTMLElement
      h.style.outline = ''
      h.style.outlineOffset = ''
      h.style.boxShadow = ''
      h.style.scrollMarginTop = ''
    })
  }

  // ── Resize: pointer event handlers ───────────────────────────────────────
  const startResize = useCallback((
    e: React.PointerEvent,
    type: 'ew' | 'ns' | 'nesw',
  ) => {
    e.preventDefault()
    dragType.current = type
    dragStart.current = { x: e.clientX, y: e.clientY, w: layout.width, h: layout.height }
    document.body.style.userSelect = 'none'
    document.body.style.cursor =
      type === 'ew' ? 'ew-resize' : type === 'ns' ? 's-resize' : 'nesw-resize'

    const onMove = (ev: PointerEvent) => {
      const dx = dragStart.current.x - ev.clientX   // left handle: drag left = wider
      const dy = ev.clientY - dragStart.current.y   // bottom handle: drag down = taller
      setLayout(prev => {
        let w = prev.width
        let h = prev.height
        if (type === 'ew' || type === 'nesw') w = clampWidth(dragStart.current.w + dx)
        if (type === 'ns' || type === 'nesw') h = clampHeight(dragStart.current.h + dy)
        return { width: w, height: h }
      })
    }

    const onUp = () => {
      dragType.current = null
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [layout.width, layout.height])

  // ── Not open at all ───────────────────────────────────────────────────────
  if (!open && !demoActive) return null

  const hasDemoSteps = guide.supportsDemoMode && guide.demoSteps.length > 0

  // ── Minimized affordance ──────────────────────────────────────────────────
  if (open && mode === 'minimized') {
    return (
      <>
        {demoActive && hasDemoSteps && (
          <GuidedDemo
            steps={guide.demoSteps} currentStep={demoStep}
            onNext={() => setDemoStep(s => Math.min(s + 1, guide.demoSteps.length - 1))}
            onPrev={() => setDemoStep(s => Math.max(s - 1, 0))}
            onExit={exitDemo}
          />
        )}
        {/* Compact right-edge tab */}
        <button
          type="button"
          onClick={() => setMode('normal')}
          aria-label="Modül Rehberini aç"
          title="Modül Rehberini aç"
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40
                     flex flex-col items-center justify-center gap-1
                     px-1.5 py-4
                     bg-tp-module border border-r-0 border-tp-border
                     rounded-l-lg shadow-lg
                     text-tp-text-2 hover:text-tp-text hover:bg-tp-workspace
                     transition-colors
                     focus-visible:outline focus-visible:outline-2 focus-visible:outline-tp-accent"
          style={{ writingMode: 'vertical-lr', transform: 'translateY(-50%) rotate(180deg)' }}
        >
          <span className="text-[11px] font-semibold tracking-wide select-none"
                style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}>
            ⓘ Modül Rehberi
          </span>
        </button>
      </>
    )
  }

  // ── Demo-only (drawer closed but demo running) ────────────────────────────
  if (!open && demoActive && hasDemoSteps) {
    return (
      <GuidedDemo
        steps={guide.demoSteps} currentStep={demoStep}
        onNext={() => setDemoStep(s => Math.min(s + 1, guide.demoSteps.length - 1))}
        onPrev={() => setDemoStep(s => Math.max(s - 1, 0))}
        onExit={exitDemo}
      />
    )
  }

  // Guard: if drawer closed and no demo, nothing to render
  if (!open) return null

  // ── Main panel ────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Guided Demo ─────────────────────────────────────────────────── */}
      {demoActive && hasDemoSteps && (
        <GuidedDemo
          steps={guide.demoSteps} currentStep={demoStep}
          onNext={() => setDemoStep(s => Math.min(s + 1, guide.demoSteps.length - 1))}
          onPrev={() => setDemoStep(s => Math.max(s - 1, 0))}
          onExit={exitDemo}
        />
      )}

      {/* ── Backdrop (mobile / narrow only) ────────────────────────────── */}
      <div
        className="fixed inset-0 z-30 bg-black/30 lg:hidden"
        aria-hidden="true"
        onClick={onClose}
      />

      {/* ── Panel ───────────────────────────────────────────────────────── */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Modül Rehberi"
        onKeyDown={handleDrawerKeyDown}
        className={`
          fixed z-40
          bg-tp-module border-l border-tp-border
          flex flex-col
          shadow-2xl
          overflow-hidden
          ${mode === 'maximized' ? 'inset-0 border-0 rounded-none' : 'rounded-l-lg top-0 right-0 bottom-0'}
        `}
        style={mode !== 'minimized' ? {
          width: mode === 'maximized' ? '100%' : layout.width,
          height: mode === 'maximized' ? '100%' : layout.height,
        } : {}}
      >

        {/* ── LEFT RESIZE HANDLE (normal mode only) ───────────────────── */}
        {mode === 'normal' && (
          <div
            onPointerDown={e => startResize(e, 'ew')}
            aria-hidden="true"
            className="absolute left-0 top-4 bottom-4 z-10 group"
            style={{ width: HANDLE_PX, cursor: 'ew-resize' }}
          >
            <div className="absolute inset-y-0 left-0 w-1
                            bg-transparent group-hover:bg-tp-accent/30
                            transition-colors rounded-full" />
          </div>
        )}

        {/* ── BOTTOM RESIZE HANDLE (normal mode only) ─────────────────── */}
        {mode === 'normal' && (
          <div
            onPointerDown={e => startResize(e, 'ns')}
            aria-hidden="true"
            className="absolute left-6 right-6 bottom-0 z-10 group"
            style={{ height: HANDLE_PX, cursor: 's-resize' }}
          >
            <div className="absolute inset-x-0 bottom-0 h-1
                            bg-transparent group-hover:bg-tp-accent/30
                            transition-colors rounded-full" />
          </div>
        )}

        {/* ── BOTTOM-LEFT CORNER HANDLE (normal mode only) ────────────── */}
        {mode === 'normal' && (
          <div
            onPointerDown={e => startResize(e, 'nesw')}
            aria-hidden="true"
            className="absolute left-0 bottom-0 z-20 group"
            style={{ width: 16, height: 16, cursor: 'nesw-resize' }}
          >
            <div className="absolute bottom-1 left-1 w-2 h-2
                            rounded-full bg-transparent group-hover:bg-tp-accent/40
                            transition-colors" />
          </div>
        )}

        {/* ── HEADER ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2.5
                        border-b border-tp-border shrink-0 select-none">
          <div>
            <div className="text-[14px] font-semibold text-tp-text leading-tight">
              Modül Rehberi
            </div>
            <div className="text-[11px] text-tp-text-3 mt-0.5">
              {guide.title} · {guide.subtitle}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            {/* Demo trigger — only when module supports it */}
            {guide.supportsDemoMode && guide.demoSteps.length > 0 && (
              <button
                type="button"
                onClick={startDemo}
                className="flex items-center gap-1.5 px-3 py-1.5 mr-1 rounded-md
                           border border-tp-accent/50 text-tp-accent text-[12px] font-semibold
                           hover:bg-tp-accent/10 transition-colors
                           focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1
                           focus-visible:outline-tp-accent"
              >
                ▶ Rehberli Demo
              </button>
            )}

            {/* Minimize */}
            <button
              type="button"
              onClick={minimize}
              aria-label="Küçült"
              title="Küçült"
              className="w-8 h-8 flex items-center justify-center rounded-md
                         text-tp-text-2 hover:text-tp-text hover:bg-tp-workspace/70
                         transition-colors
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1
                         focus-visible:outline-tp-accent"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="2" y="9" width="10" height="1.5" rx="0.75" fill="currentColor"/>
              </svg>
            </button>

            {/* Maximize / Restore */}
            <button
              type="button"
              onClick={handleMaxToggle}
              aria-label={mode === 'maximized' ? 'Yeniden Boyutlandır' : 'Büyüt'}
              title={mode === 'maximized' ? 'Yeniden Boyutlandır' : 'Büyüt'}
              className="w-8 h-8 flex items-center justify-center rounded-md
                         text-tp-text-2 hover:text-tp-text hover:bg-tp-workspace/70
                         transition-colors
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1
                         focus-visible:outline-tp-accent"
            >
              {mode === 'maximized' ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="5" y="2" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                  <path d="M2 5v7h7v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
              )}
            </button>

            {/* Close */}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Rehberi kapat"
              title="Kapat"
              className="w-8 h-8 flex items-center justify-center rounded-md
                         text-tp-text-2 hover:text-tp-text hover:bg-tp-workspace/70
                         transition-colors
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1
                         focus-visible:outline-tp-accent"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── BODY ────────────────────────────────────────────────────── */}
        {mode === 'maximized' ? (
          /* 3-col maximized layout */
          <div className="flex-1 flex overflow-hidden">

            {/* Left: Table of Contents */}
            <nav className="w-44 shrink-0 border-r border-tp-border overflow-y-auto py-4 px-3">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-tp-text-3 mb-3 px-1">
                İçindekiler
              </div>
              {[
                '1 · Bu Modül Nedir?',
                '2 · Nasıl Kullanılır?',
                '3 · Parametreler',
                guide.example ? '4 · Örnek Uygulama' : null,
                guide.resultGuidance ? '5 · Sonuçları Nasıl Okurum?' : null,
                '6 · Sık Sorulan Sorular',
                '7 · Academy / Tutorial',
              ].filter(Boolean).map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`guide-section-${i + 1}`)
                    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  className="w-full text-left px-2 py-1.5 rounded text-[12px] text-tp-text-3
                             hover:text-tp-text hover:bg-tp-workspace/50 transition-colors
                             focus-visible:outline focus-visible:outline-2 focus-visible:outline-tp-accent"
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* Center: Main content */}
            <div className="flex-1 overflow-y-auto" style={{ maxWidth: '72ch', margin: '0 auto' }}>
              <GuideBody
                guide={guide}
                onHighlight={anchor => { onHighlight?.(anchor) }}
                onLoadExample={vals => { onLoadExample?.(vals) }}
                onRestoreSnapshot={() => { onRestoreSnapshot?.() }}
                hasSnapshot={hasSnapshot}
                onClose={onClose}
              />
            </div>

            {/* Right: Demo / controls strip */}
            {guide.supportsDemoMode && guide.demoSteps.length > 0 && (
              <div className="w-36 shrink-0 border-l border-tp-border py-4 px-3 flex flex-col gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-tp-text-3 mb-1 px-1">
                  Araçlar
                </div>
                <button
                  type="button"
                  onClick={startDemo}
                  className="flex items-center gap-2 px-3 py-2 rounded-md
                             border border-tp-accent/50 text-tp-accent text-[12px] font-semibold
                             hover:bg-tp-accent/10 transition-colors text-left
                             focus-visible:outline focus-visible:outline-2 focus-visible:outline-tp-accent"
                >
                  ▶ Rehberli Demo
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Normal scrollable body */
          <div className="flex-1 overflow-y-auto">
            <GuideBody
              guide={guide}
              onHighlight={anchor => { onClose(); onHighlight?.(anchor) }}
              onLoadExample={vals => { onLoadExample?.(vals); onClose() }}
              onRestoreSnapshot={() => { onRestoreSnapshot?.(); onClose() }}
              hasSnapshot={hasSnapshot}
              onClose={onClose}
            />
          </div>
        )}

        {/* ── FOOTER ──────────────────────────────────────────────────── */}
        <div className="shrink-0 px-4 py-2 border-t border-tp-border
                        text-[11px] text-tp-text-3 leading-relaxed flex items-center justify-between">
          <span>Deterministik hesap · VDI 2230 tabanlı · TorqPro AI</span>
          {mode === 'normal' && (
            <span className="text-[10px] text-tp-text-3/60 select-none" aria-hidden="true">
              ↔ kenardan yeniden boyutlandır
            </span>
          )}
        </div>
      </div>
    </>
  )
}

// ── GuideBody — shared between normal and maximized layouts ──────────────────
function GuideBody({
  guide,
  onHighlight,
  onLoadExample,
  onRestoreSnapshot,
  hasSnapshot,
  onClose: _onClose,
}: {
  guide: ModuleGuide
  onHighlight: (anchor: string) => void
  onLoadExample: (vals: ExampleValues) => void
  onRestoreSnapshot: () => void
  hasSnapshot: boolean
  onClose: () => void
}) {
  return (
    <>
      {/* 1 */}
      <div id="guide-section-1">
        <GuideSection title="1 · Bu Modül Nedir?" defaultOpen>
          <div className="space-y-2.5">
            {guide.description.paragraphs.map((p, i) => (
              <p key={i} className="text-[13px] text-tp-text-2 leading-[1.55]">{p}</p>
            ))}
            <div className="mt-2.5 flex gap-2 items-start rounded border border-tp-border-warn
                            bg-tp-warn/5 px-3 py-2.5">
              <span className="text-tp-warn text-[12px] shrink-0 mt-px">ℹ</span>
              <p className="text-[12px] text-tp-warn leading-[1.5]">{guide.description.note}</p>
            </div>
          </div>
        </GuideSection>
      </div>

      {/* 2 */}
      <div id="guide-section-2">
        <GuideSection title="2 · Nasıl Kullanılır?">
          <GuideWorkflow steps={guide.workflow} onHighlight={onHighlight} />
        </GuideSection>
      </div>

      {/* 3 */}
      <div id="guide-section-3">
        <GuideSection title="3 · Parametreler">
          <GuideParameterList parameters={guide.parameters} onHighlight={onHighlight} />
        </GuideSection>
      </div>

      {/* 4 — only when guide has example */}
      {guide.example && guide.supportsExampleLoad && (
        <div id="guide-section-4">
          <GuideSection title="4 · Örnek Uygulama">
            <GuideExample
              example={guide.example}
              onLoadExample={onLoadExample}
              onRestoreSnapshot={onRestoreSnapshot}
              hasSnapshot={hasSnapshot}
            />
          </GuideSection>
        </div>
      )}

      {/* 5 — only when guide has result guidance */}
      {guide.resultGuidance && (
        <div id="guide-section-5">
          <GuideSection title="5 · Sonuçları Nasıl Okurum?">
            <div className="space-y-3">
              {guide.resultGuidance.items.map((item, i) => (
                <div key={i} className="border-b border-tp-border/50 pb-3 last:border-b-0 last:pb-0">
                  <div className="text-[13px] font-semibold text-tp-text mb-1">{item.label}</div>
                  <p className="text-[13px] text-tp-text-2 leading-[1.55]">{item.description}</p>
                  {item.thresholds && (
                    <div className="mt-2 space-y-1.5">
                      {item.thresholds.map((t, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor: t.color === 'green' ? '#1b9e7a'
                                : t.color === 'amber' ? '#c8860e' : '#c04040'
                            }}
                          />
                          <span className="text-[12px] text-tp-text-3">
                            <span className="font-medium text-tp-text-2">{t.label}</span>
                            {' — '}{t.meaning}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </GuideSection>
        </div>
      )}

      {/* 6 */}
      <div id="guide-section-6">
        <GuideSection title="6 · Sık Sorulan Sorular">
          <GuideFAQ items={guide.faq} />
        </GuideSection>
      </div>

      {/* 7 */}
      <div id="guide-section-7">
        <GuideSection title="7 · Academy / Tutorial">
          <GuideAcademyLinks links={guide.academyLinks} />
        </GuideSection>
      </div>
    </>
  )
}
