export default function EngineeringValue({ value, unit, label, variant = 'default' }: {
  value: string | number; unit?: string; label?: string
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error'
}) {
  const colors = {
    default: 'text-tp-text', primary: 'text-tp-accent-light',
    success: 'text-tp-valid', warning: 'text-tp-warn', error: 'text-tp-error'
  }
  return (
    <div>
      {label && <div className="text-xs text-tp-text-3 mb-0.5">{label}</div>}
      <div className="flex items-baseline gap-1">
        <span className={`eng-value ${colors[variant]}`}>{value}</span>
        {unit && <span className="eng-unit">{unit}</span>}
      </div>
    </div>
  )
}
