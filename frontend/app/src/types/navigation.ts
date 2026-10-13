import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  id: string
  path: string
  label: string      // TR fallback (used when i18n not available)
  labelKey: string   // i18n translation key → t(labelKey)
  icon: LucideIcon
  badge?: string | number
}

export interface NavGroup {
  id: string
  domainKey: string
  label: string      // TR fallback
  labelKey: string   // i18n translation key → t(labelKey)
  items: NavItem[]
  adminOnly?: boolean
}
