import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { tr, en } from './translations'

// ── Types ────────────────────────────────────────────────────────────────────
export type Lang = 'tr' | 'en'

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

// ── Context ───────────────────────────────────────────────────────────────────
const LanguageContext = createContext<LanguageContextValue>({
  lang: 'tr',
  setLang: () => {},
  t: (key) => key,
})

// ── Storage key (shared with legacy torqpro_lang) ─────────────────────────────
const STORAGE_KEY = 'torqpro_lang'

const DICTS: Record<Lang, Record<string, string>> = { tr, en }

// ── Provider ──────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored === 'en' ? 'en' : 'tr'
    } catch {
      return 'tr'
    }
  })

  // Sync document.documentElement.lang on every change (also on first render)
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* ignore */ }
    document.documentElement.lang = l
  }

  // t(): look up in active language, fall back to TR, then return key
  const t = (key: string): string =>
    DICTS[lang][key] ?? DICTS.tr[key] ?? key

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext)
}
