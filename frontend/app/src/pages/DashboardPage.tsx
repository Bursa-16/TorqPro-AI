import { useEffect, useState } from 'react'
import Panel from '../components/ui/Panel'
import { getHealth } from '../services/admin'
import { useLanguage } from '../i18n/LanguageContext'

export default function DashboardPage() {
  const { t } = useLanguage()
  const [health, setHealth] = useState<any>(null)
  useEffect(() => { getHealth().then(setHealth).catch(() => {}) }, [])

  return (
    <div className="p-5 h-full overflow-y-auto bg-tp-workspace">
      <h1 className="text-lg font-semibold mb-4">{t('dash.title')}</h1>
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: t('dash.api_status'), value: health?.status || '—', color: health?.database_ok ? 'text-tp-valid' : 'text-tp-error' },
          { label: t('dash.version'), value: health?.version || '—', color: 'text-tp-accent-light' },
          { label: t('dash.database'), value: health?.database_ok ? t('dash.db_connected') : t('dash.db_error'), color: health?.database_ok ? 'text-tp-valid' : 'text-tp-error' },
          { label: t('dash.server_time'), value: health?.server_time?.split('T')[0] || '—', color: 'text-tp-text' },
        ].map(s => (
          <Panel key={s.label}>
            <div className="text-xs text-tp-text-3 mb-1">{s.label}</div>
            <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
          </Panel>
        ))}
      </div>
      <Panel title={t('dash.quick_access')} subtitle={t('dash.quick_access_sub')}>
        <div className="text-sm text-tp-text-2">{t('dash.quick_access_text')}</div>
      </Panel>
    </div>
  )
}
