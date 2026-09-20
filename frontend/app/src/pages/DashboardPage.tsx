import { useEffect, useState } from 'react'
import Panel from '../components/ui/Panel'
import { getHealth } from '../services/admin'

export default function DashboardPage() {
  const [health, setHealth] = useState<any>(null)
  useEffect(() => { getHealth().then(setHealth).catch(() => {}) }, [])

  return (
    <div className="p-5 h-full overflow-y-auto bg-tp-workspace">
      <h1 className="text-lg font-semibold mb-4">Dashboard</h1>
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'API Durumu', value: health?.status || '—', color: health?.database_ok ? 'text-tp-valid' : 'text-tp-error' },
          { label: 'Sürüm', value: health?.version || '—', color: 'text-tp-accent-light' },
          { label: 'Veritabanı', value: health?.database_ok ? 'Bağlı' : 'Hata', color: health?.database_ok ? 'text-tp-valid' : 'text-tp-error' },
          { label: 'Sunucu Zamanı', value: health?.server_time?.split('T')[0] || '—', color: 'text-tp-text' },
        ].map(s => (
          <Panel key={s.label}>
            <div className="text-xs text-tp-text-3 mb-1">{s.label}</div>
            <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
          </Panel>
        ))}
      </div>
      <Panel title="Hızlı Erişim" subtitle="Sık kullanılan mühendislik araçları">
        <div className="text-sm text-tp-text-2">Tork Hesap, OEM Öngörüsü, Kalibrasyon ve daha fazlası soldaki menüden erişilebilir.</div>
      </Panel>
    </div>
  )
}
