import { useState, useEffect, type FormEvent } from 'react'
import { useLanguage } from '../i18n/LanguageContext'

const logoSrc = `${import.meta.env.BASE_URL}torqpro-ai-logo.png`
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true'

export default function LoginPage({ onLogin }: { onLogin: (u: string, p: string) => Promise<unknown> }) {
  const { t } = useLanguage()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!IS_DEMO) return
    fetch(`${API_BASE}/demo-config`)
      .then(r => r.json())
      .then((d: { enabled?: boolean; username?: string; password?: string }) => {
        if (d?.enabled) {
          setUsername(d.username ?? '')
          setPassword(d.password ?? '')
        }
      })
      .catch(() => { /* user can type credentials manually if fetch fails */ })
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await onLogin(username, password) }
    catch (err: unknown) {
      const e2 = err as { detail?: string; message?: string }
      setError(e2.detail || e2.message || 'Giriş başarısız')
    }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-tp-bg">
      {IS_DEMO && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-tp-accent text-white text-[10px] font-bold tracking-widest px-4 py-1 rounded-full">
          {t('login.demo_banner')}
        </div>
      )}
      <form onSubmit={submit} className="bg-tp-surface border border-tp-border-strong rounded-lg p-10 w-[360px]">
        <div className="flex justify-center mb-6">
          <img src={logoSrc} alt="TorqPro AI" className="w-56 h-auto object-contain" />
        </div>
        <div className="text-xs text-tp-text-3 text-center mb-8">Fastener Engineering Intelligence</div>
        <div className="mb-4">
          <label className="block text-xs text-tp-text-2 mb-1">{t('login.username')}</label>
          <input value={username} onChange={e => setUsername(e.target.value)}
            className="w-full bg-tp-surface-2 border border-tp-border rounded-md px-3 py-2 text-sm text-tp-text outline-none focus:border-tp-accent transition-colors"
            autoFocus={!IS_DEMO} />
        </div>
        <div className="mb-6">
          <label className="block text-xs text-tp-text-2 mb-1">{t('login.password')}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full bg-tp-surface-2 border border-tp-border rounded-md px-3 py-2 text-sm text-tp-text outline-none focus:border-tp-accent transition-colors" />
        </div>
        <button type="submit" disabled={loading} autoFocus={IS_DEMO}
          className="w-full bg-tp-accent hover:bg-tp-accent-light text-white py-2.5 rounded-md text-sm font-semibold transition-colors disabled:opacity-50">
          {loading ? t('login.signing_in') : t('login.sign_in')}
        </button>
        {error && <div className="text-tp-error text-xs mt-3 text-center">{error}</div>}
        {IS_DEMO && (
          <div className="text-[10px] text-tp-text-3 text-center mt-4">{t('login.demo_hint')}</div>
        )}
        <div className="text-[10px] text-tp-text-3 text-center mt-6">Protype Lab — TorqPro v3.3.4</div>
      </form>
    </div>
  )
}
