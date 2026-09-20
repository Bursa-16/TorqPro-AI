type Variant = 'validated' | 'calculated' | 'warning' | 'error' | 'draft' | 'review' | 'ai' | 'info' | 'beta' | 'planned'
const styles: Record<Variant, string> = {
  validated: 'bg-tp-valid-muted text-tp-valid border-tp-valid/30',
  calculated: 'bg-tp-accent-muted/40 text-tp-accent-light border-tp-accent/30',
  warning: 'bg-tp-warn-muted text-tp-warn border-tp-warn/30',
  error: 'bg-tp-error-muted text-tp-error border-tp-error/30',
  draft: 'bg-tp-surface-3 text-tp-text-2 border-tp-border',
  review: 'bg-amber-900/20 text-amber-400 border-amber-500/30',
  ai: 'bg-tp-ai-muted text-tp-ai border-tp-ai/30',
  info: 'bg-tp-surface-3 text-tp-text-2 border-tp-border',
  beta: 'bg-orange-900/20 text-orange-400 border-orange-500/30',
  planned: 'bg-tp-surface-3 text-tp-text-3 border-tp-border',
}
export default function StatusBadge({ variant, children }: { variant: Variant; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${styles[variant]}`}>{children}</span>
}
