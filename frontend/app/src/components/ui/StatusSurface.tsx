/**
 * StatusSurface — VISUAL-02C reusable status-aware surface.
 *
 * Renders a surface+border+icon+badge treatment for any engineering
 * status state. Uses the VISUAL-02C-0C status surface plan:
 *   VALIDATED / WITHIN_LIMIT / WARNING / OUT_OF_LIMIT / REVIEW / AI_ADVISORY
 *
 * Never relies on color alone — always icon + color + label.
 */

import type { ReactNode } from 'react'
import {
  CheckCircle, CheckSquare, AlertTriangle,
  AlertOctagon, ClipboardCheck, Sparkles,
} from 'lucide-react'

export type StatusKind =
  | 'validated'
  | 'within_limit'
  | 'warning'
  | 'out_of_limit'
  | 'review'
  | 'ai_advisory'

interface StatusConfig {
  surface: string
  border: string
  icon: typeof CheckCircle
  iconColor: string
  badgeLabel: string
  bleed: string
}

const CONFIG: Record<StatusKind, StatusConfig> = {
  validated: {
    surface:    'bg-tp-validation',
    border:     'border-l-2 border-tp-border-valid',
    icon:       CheckCircle,
    iconColor:  'text-tp-valid',
    badgeLabel: 'Onaylı',
    bleed:      'tp-status-bleed-valid',
  },
  within_limit: {
    surface:    'bg-tp-result',
    border:     'border-l-2 border-tp-border-accent',
    icon:       CheckSquare,
    iconColor:  'text-tp-accent-light',
    badgeLabel: 'Uygun',
    bleed:      '',
  },
  warning: {
    surface:    'bg-tp-warn-muted',
    border:     'border-l-2 border-tp-border-warn',
    icon:       AlertTriangle,
    iconColor:  'text-tp-warn',
    badgeLabel: 'Sınırda',
    bleed:      'tp-status-bleed-warn',
  },
  out_of_limit: {
    surface:    'bg-tp-error-muted',
    border:     'border-l-[3px] border-tp-border-error',
    icon:       AlertOctagon,
    iconColor:  'text-tp-error',
    badgeLabel: 'Riskli',
    bleed:      'tp-status-bleed-error',
  },
  review: {
    surface:    'bg-tp-workspace',
    border:     'border-l-2 border-dashed border-tp-border-warn',
    icon:       ClipboardCheck,
    iconColor:  'text-tp-warn',
    badgeLabel: 'İnceleme Gerekli',
    bleed:      '',
  },
  ai_advisory: {
    surface:    'bg-tp-ai-surface',
    border:     'border-l-2 border-tp-border-ai',
    icon:       Sparkles,
    iconColor:  'text-tp-ai',
    badgeLabel: 'AI Yorumu',
    bleed:      'tp-status-bleed-ai',
  },
}

interface StatusSurfaceProps {
  kind: StatusKind
  label?: string
  /** Main engineering value — always larger than any AI-generated text */
  value?: ReactNode
  unit?: string
  /** Additional content rendered below label+value */
  children?: ReactNode
  className?: string
}

export default function StatusSurface({
  kind,
  label,
  value,
  unit,
  children,
  className = '',
}: StatusSurfaceProps) {
  const cfg = CONFIG[kind]
  const Icon = cfg.icon

  return (
    <div
      className={`
        rounded-md overflow-hidden
        ${cfg.surface} ${cfg.border} ${cfg.bleed}
        ${className}
      `}
    >
      <div className="p-3">
        {/* Header row: icon + label + badge */}
        <div className="flex items-center gap-2 mb-2">
          <Icon size={14} className={`shrink-0 ${cfg.iconColor}`} strokeWidth={1.8} />
          {label && (
            <span className={`text-[11px] font-medium ${cfg.iconColor}`}>{label}</span>
          )}
          <span className={`
            ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded
            ${cfg.iconColor} border border-current opacity-80
          `}>
            {cfg.badgeLabel}
          </span>
        </div>

        {/* Primary value */}
        {value != null && (
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl font-bold tabular-nums ${cfg.iconColor}`}>
              {value}
            </span>
            {unit && (
              <span className="text-[11px] text-tp-text-3">{unit}</span>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  )
}
