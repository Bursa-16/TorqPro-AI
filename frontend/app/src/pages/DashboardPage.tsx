import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Database, Info, Clock, Wrench, Microscope, CheckSquare } from 'lucide-react'
import EngineeringModule from '../components/ui/EngineeringModule'
import type { ModuleStatus } from '../components/ui/EngineeringModule'
import StatusBadge from '../components/ui/StatusBadge'
import Button from '../components/ui/Button'
import { getHealth } from '../services/admin'
import { useLanguage } from '../i18n/LanguageContext'
import EngineeringWorkflow from '../components/engineering/EngineeringWorkflow'

function StatCard({
  icon: Icon, label, value, color = 'text-tp-text',
  badge, badgeVariant, status = 'none',
}: {
  icon: React.ElementType; label: string; value: string; color?: string
  badge?: string; badgeVariant?: 'validated' | 'error' | 'info'; status?: ModuleStatus
}) {
  return (
    <EngineeringModule
      type="input"
      status={status}
      className="shadow-[0_1px_8px_rgba(0,0,0,0.35)]"
    >
      <div className="flex items-center gap-2 mb-2.5">
        <Icon size={13} strokeWidth={1.7} className="text-tp-text-3 shrink-0" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-tp-text-3 truncate leading-none">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-2 min-h-[28px]">
        <span className={`text-xl font-bold tabular-nums ${color}`}>{value}</span>
        {badge && badgeVariant && (
          <StatusBadge variant={badgeVariant}>{badge}</StatusBadge>
        )}
      </div>
    </EngineeringModule>
  )
}

export default function DashboardPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [health, setHealth] = useState<any>(null)
  useEffect(() => { getHealth().then(setHealth).catch(() => {}) }, [])

  const apiOk = health?.status === 'ok'
  const dbOk  = health?.database_ok === true

  return (
    <div className="h-full overflow-y-auto bg-tp-workspace">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 border-b border-tp-border flex items-center justify-between shrink-0">
        <h1 className="text-[15px] font-semibold text-tp-text tracking-tight">
          {t('dash.title')}
        </h1>
        {health && (
          <div className="flex items-center gap-2.5">
            <div className={`w-1.5 h-1.5 rounded-full ${apiOk ? 'bg-tp-valid' : 'bg-tp-error'}`} />
            <span className="text-[11px] text-tp-text-3 tabular-nums">{health.version}</span>
          </div>
        )}
      </div>

      <div className="p-5 space-y-5">

        {/* ── System status cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            icon={Activity}
            label={t('dash.api_status')}
            value={health?.status || '—'}
            color={health ? (apiOk ? 'text-tp-valid' : 'text-tp-error') : 'text-tp-text-3'}
            badge={health ? (apiOk ? 'live' : 'down') : undefined}
            badgeVariant={health ? (apiOk ? 'validated' : 'error') : undefined}
            status={health ? (apiOk ? 'valid' : 'error') : 'none'}
          />
          <StatCard
            icon={Info}
            label={t('dash.version')}
            value={health?.version || '—'}
            color="text-tp-accent-light"
          />
          <StatCard
            icon={Database}
            label={t('dash.database')}
            value={health ? (dbOk ? t('dash.db_connected') : t('dash.db_error')) : '—'}
            color={health ? (dbOk ? 'text-tp-valid' : 'text-tp-error') : 'text-tp-text-3'}
            status={health ? (dbOk ? 'valid' : 'error') : 'none'}
          />
          <StatCard
            icon={Clock}
            label={t('dash.server_time')}
            value={health?.server_time?.split('T')[0] || '—'}
            color="text-tp-text"
          />
        </div>

        {/* ── Section rail ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-tp-text-3 shrink-0">
            {t('dash.quick_access')}
          </span>
          <div className="flex-1 h-px bg-tp-border-strong" />
          <span className="text-[10px] text-tp-text-3 shrink-0">{t('dash.quick_access_sub')}</span>
        </div>

        {/* ── Engineering workflow rail (STAGE-UI-03) ─────────────────────── */}
        <EngineeringWorkflow t={t} />

        {/* ── Engineering action modules ────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">

          <EngineeringModule
            type="input"
            status="none"
            className="shadow-[0_1px_8px_rgba(0,0,0,0.35)] border border-tp-border-2"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-sm bg-tp-accent/15 border border-tp-accent/30
                              flex items-center justify-center shrink-0">
                <Wrench size={15} strokeWidth={1.6} className="text-tp-accent-light" />
              </div>
              <span className="text-[13px] font-semibold text-tp-text leading-snug">
                {t('nav.item.torque')}
              </span>
            </div>
            <p className="text-[11px] text-tp-text-3 leading-relaxed mb-4 font-mono">
              ISO 68-1 · VDI 2230 — deterministic
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/app/calculation/torque')}
            >
              {t('nav.item.torque')}
            </Button>
          </EngineeringModule>

          <EngineeringModule
            type="input"
            status="none"
            className="shadow-[0_1px_8px_rgba(0,0,0,0.35)] border border-tp-border-2"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-sm bg-tp-accent/15 border border-tp-accent/30
                              flex items-center justify-center shrink-0">
                <Microscope size={15} strokeWidth={1.6} className="text-tp-accent-light" />
              </div>
              <span className="text-[13px] font-semibold text-tp-text leading-snug">
                {t('nav.item.vdi')}
              </span>
            </div>
            <p className="text-[11px] text-tp-text-3 leading-relaxed mb-4 font-mono">
              VDI 2230 R1–R13 · δp · δb · Φ
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/app/calculation/advanced-analysis')}
            >
              {t('nav.item.vdi')}
            </Button>
          </EngineeringModule>

          <EngineeringModule
            type="input"
            status="none"
            className="shadow-[0_1px_8px_rgba(0,0,0,0.35)] border border-tp-border-2"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-sm bg-tp-valid-muted border border-tp-valid/25
                              flex items-center justify-center shrink-0">
                <CheckSquare size={15} strokeWidth={1.6} className="text-tp-valid" />
              </div>
              <span className="text-[13px] font-semibold text-tp-text leading-snug">
                {t('nav.item.checklist')}
              </span>
            </div>
            <p className="text-[11px] text-tp-text-3 leading-relaxed mb-4 font-mono">
              VDI 2230 · ISO 4762 — assembly check
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/app/validation/checklist')}
            >
              {t('nav.item.checklist')}
            </Button>
          </EngineeringModule>

        </div>

      </div>
    </div>
  )
}
