// ── GuidedDemo.tsx ──────────────────────────────────────────────────────────
// Lightweight in-page guided tour for TorqueCalcPage.
// Highlights real DOM regions using anchor IDs.
// Supports next / previous / exit / ESC.
// Does NOT auto-submit or fake clicks.
// ────────────────────────────────────────────────────────────────────────────
import { useEffect, useCallback, useRef } from 'react'
import type { DemoStep } from '../../guides/torqueGuide'

interface GuidedDemoProps {
  steps: DemoStep[]
  currentStep: number        // 0-based index
  onNext: () => void
  onPrev: () => void
  onExit: () => void
}

export default function GuidedDemo({
  steps,
  currentStep,
  onNext,
  onPrev,
  onExit,
}: GuidedDemoProps) {
  const step = steps[currentStep]
  const tooltipRef = useRef<HTMLDivElement>(null)

  // ── Highlight the target DOM region ──────────────────────────────────────
  useEffect(() => {
    // Remove previous highlights
    document.querySelectorAll('[data-guide-highlight]').forEach(el => {
      el.removeAttribute('data-guide-highlight')
      ;(el as HTMLElement).style.outline = ''
      ;(el as HTMLElement).style.outlineOffset = ''
      ;(el as HTMLElement).style.boxShadow = ''
      ;(el as HTMLElement).style.scrollMarginTop = ''
    })

    if (!step?.anchorId) return

    const target = document.getElementById(step.anchorId)
    if (!target) return

    target.setAttribute('data-guide-highlight', 'true')
    target.style.outline = '2px solid #4a7cc9'
    target.style.outlineOffset = '4px'
    target.style.boxShadow = '0 0 0 4px rgba(74,124,201,0.15)'
    target.style.scrollMarginTop = '80px'
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    return () => {
      target.removeAttribute('data-guide-highlight')
      target.style.outline = ''
      target.style.outlineOffset = ''
      target.style.boxShadow = ''
      target.style.scrollMarginTop = ''
    }
  }, [step?.anchorId])

  // ── ESC key exit ──────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onExit() }
    if (e.key === 'ArrowRight' && currentStep < steps.length - 1) onNext()
    if (e.key === 'ArrowLeft' && currentStep > 0) onPrev()
  }, [onExit, onNext, onPrev, currentStep, steps.length])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Focus management: move focus into tooltip on mount / step change
  useEffect(() => {
    tooltipRef.current?.focus()
  }, [currentStep])

  if (!step) return null

  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <>
      {/* Backdrop — semi-transparent, click exits */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        aria-hidden="true"
        onClick={onExit}
      />

      {/* Demo tooltip panel — fixed at bottom-right, above backdrop */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-modal="false"
        aria-label={`Rehberli Demo - ${step.label}`}
        tabIndex={-1}
        className="fixed bottom-6 right-6 z-50 w-[340px] rounded-lg
                   border border-tp-border-accent bg-tp-module shadow-xl
                   outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-tp-border">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-tp-accent">
              Rehberli Demo
            </span>
            <span className="text-[10px] text-tp-text-3">{step.label}</span>
          </div>
          <button
            type="button"
            onClick={onExit}
            aria-label="Demodan çık"
            className="w-5 h-5 flex items-center justify-center text-tp-text-3
                       hover:text-tp-text transition-colors rounded
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-tp-accent"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-tp-border">
          <div
            className="h-full bg-tp-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <div className="text-[13px] font-semibold text-tp-text mb-1">{step.title}</div>
          <p className="text-[11px] text-tp-text-3 leading-relaxed">{step.description}</p>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-4 pb-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentStep === 0}
            className="px-3 py-1.5 text-[12px] font-medium text-tp-text-2
                       border border-tp-border-2 rounded-md hover:border-tp-border-strong
                       disabled:opacity-30 disabled:cursor-not-allowed transition-colors
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-tp-accent"
          >
            ← Geri
          </button>

          <span className="text-[10px] text-tp-text-3 select-none">
            {currentStep + 1} / {steps.length}
          </span>

          {currentStep < steps.length - 1 ? (
            <button
              type="button"
              onClick={onNext}
              className="px-3 py-1.5 text-[12px] font-semibold text-white
                         bg-tp-accent hover:bg-tp-accent-light rounded-md transition-colors
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-tp-accent"
            >
              İleri →
            </button>
          ) : (
            <button
              type="button"
              onClick={onExit}
              className="px-3 py-1.5 text-[12px] font-semibold text-white
                         bg-tp-valid hover:brightness-110 rounded-md transition-colors
                         focus-visible:outline focus-visible:outline-2 focus-visible:outline-tp-accent"
            >
              Bitir ✓
            </button>
          )}
        </div>

        {/* ESC hint */}
        <div className="px-4 pb-2 text-[9px] text-tp-text-3">
          ESC veya arka plana tıklayarak çıkabilirsiniz.
        </div>
      </div>
    </>
  )
}
