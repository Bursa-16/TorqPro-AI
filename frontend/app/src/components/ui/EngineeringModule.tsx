/**
 * EngineeringModule — VISUAL-02C reusable module primitive.
 *
 * Wraps any engineering workspace section with the correct surface,
 * 2px left-border status signal, optional gradient header band,
 * and section label. No layout decisions — callers control contents.
 *
 * Left border is the PRIMARY status signal.
 * Background tint is SECONDARY.
 * Icon + text color is TERTIARY.
 * Never rely on any single signal alone.
 */

import type { ReactNode } from 'react'

export type ModuleType = 'input' | 'result' | 'validation' | 'ai' | 'chart' | 'traceability' | 'neutral'
export type ModuleStatus = 'none' | 'valid' | 'warn' | 'error' | 'ai' | 'calc'

const SURFACE: Record<ModuleType, string> = {
  input:       'bg-tp-module',
  result:      'bg-tp-result',
  validation:  'bg-tp-validation',
  ai:          'bg-tp-ai-surface',
  chart:       'bg-tp-bg',
  traceability:'bg-tp-workspace',
  neutral:     'bg-tp-workspace',
}

const LEFT_BORDER: Record<ModuleStatus, string> = {
  none:  'border-l-2 border-tp-border',
  valid: 'border-l-2 border-tp-border-valid',
  warn:  'border-l-2 border-tp-border-warn',
  error: 'border-l-[3px] border-tp-border-error',
  ai:    'border-l-2 border-tp-border-ai',
  calc:  'border-l-2 border-tp-border-calc',
}

const BLEED: Record<ModuleStatus, string> = {
  none:  '',
  valid: 'tp-status-bleed-valid',
  warn:  'tp-status-bleed-warn',
  error: 'tp-status-bleed-error',
  ai:    'tp-status-bleed-ai',
  calc:  '',
}

interface EngineeringModuleProps {
  type?: ModuleType
  status?: ModuleStatus
  /** Short uppercase section label — displayed in the gradient header band */
  label?: string
  /** Gradient header band (24px top highlight). Default true for input/result types. */
  headerBand?: boolean
  className?: string
  children: ReactNode
}

export default function EngineeringModule({
  type = 'neutral',
  status = 'none',
  label,
  headerBand,
  className = '',
  children,
}: EngineeringModuleProps) {
  const showBand = headerBand ?? (type === 'input' || type === 'result')

  return (
    <div
      className={`
        relative rounded-md overflow-hidden
        ${SURFACE[type]}
        ${LEFT_BORDER[status]}
        ${BLEED[status] ? BLEED[status] : ''}
        ${className}
      `}
    >
      {/* Gradient header band */}
      {showBand && label && (
        <div className="tp-module-header px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-tp-text-2 select-none">
            {label}
          </span>
        </div>
      )}

      {/* Label without header band */}
      {!showBand && label && (
        <div className="px-4 pt-3 pb-0">
          <span className="text-[10px] font-bold uppercase tracking-widest text-tp-text-3 select-none">
            {label}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
