import {
  LayoutDashboard, Zap, Wrench, Microscope,
  CheckSquare, TrendingUp, Settings2, AlertTriangle,
  Search, ClipboardList, Puzzle, SearchCode,
  Archive, FileText, Ruler, Award, Scroll,
  Dna, FolderInput, ShieldCheck,
} from 'lucide-react'
import type { NavGroup } from '../types/navigation'

// DASHBOARD — permanent home, outside accordion groups
export const HOME_ITEM = {
  id: 'dashboard',
  path: '/app',
  label: 'Dashboard',
  icon: LayoutDashboard,
}

// 9-domain navigation (Academy + AI Engineering defined but empty — FUTURE)
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'calculation', domainKey: 'calculation', label: 'Hesaplama',
    items: [
      { id: 'torque',    path: '/app/calculation/torque',            label: 'Tork Hesap',          icon: Wrench },
      { id: 'n01391',    path: '/app/calculation/oem-prediction',    label: 'OEM Tork Öngörüsü',   icon: Zap },
      { id: 'vdi',       path: '/app/calculation/advanced-analysis', label: 'Gelişmiş Analiz',     icon: Microscope },
    ],
  },
  {
    id: 'validation', domainKey: 'validation', label: 'Doğrulama',
    items: [
      { id: 'checklist', path: '/app/validation/checklist',  label: 'Check-List',       icon: CheckSquare },
      { id: 'yetenek',   path: '/app/validation/capability', label: 'Cm/Cmk Yetenek',   icon: TrendingUp },
      { id: 'validation',path: '/app/validation/technical',  label: 'Teknik Doğrulama', icon: SearchCode },
    ],
  },
  {
    id: 'production', domainKey: 'production', label: 'Üretim',
    items: [
      { id: 'sikici',  path: '/app/production/tool-tracking', label: 'Sıkıcı Takip',    icon: Settings2 },
      { id: 'problem', path: '/app/production/problems',      label: 'Problem Yönetimi', icon: AlertTriangle },
    ],
  },
  {
    id: 'knowledge', domainKey: 'knowledge', label: 'Bilgi',
    items: [
      { id: 'oem',  path: '/app/knowledge/oem-norms',  label: 'OEM Norm Sorgu', icon: Search },
      { id: 'norm', path: '/app/knowledge/norm-guide',  label: 'Norm Rehberi',   icon: ClipboardList },
      { id: 'fmea', path: '/app/knowledge/fmea',        label: 'FMEA Kataloğu',  icon: Puzzle },
    ],
  },
  {
    id: 'traceability', domainKey: 'traceability', label: 'İzlenebilirlik',
    items: [
      { id: 'rapor', path: '/app/traceability/reports', label: 'Rapor Üret', icon: FileText },
      { id: 'arsiv', path: '/app/traceability/archive', label: 'Arşiv',      icon: Archive },
    ],
  },
  {
    id: 'data', domainKey: 'data', label: 'Veri', adminOnly: true,
    items: [
      { id: 'calibration', path: '/app/data/calibration',        label: 'Kalibrasyon',         icon: Ruler },
      { id: 'qualitygate', path: '/app/data/quality-gate',       label: 'Veri Kalite Kapısı',  icon: ShieldCheck },
      { id: 'goldencases', path: '/app/data/golden-cases',       label: 'Altın Senaryolar',    icon: Award },
      { id: 'releasecert', path: '/app/data/release-certificate',label: 'Sürüm Sertifikası',  icon: Scroll },
      { id: 'versions',    path: '/app/data/versions',           label: 'Veri Sürümleri',      icon: Dna },
      { id: 'dataadmin',   path: '/app/data/upload',             label: 'Veri Yükleme & Onay', icon: FolderInput },
    ],
  },
  {
    id: 'system', domainKey: 'system', label: 'Sistem', adminOnly: true,
    items: [
      { id: 'admin', path: '/app/system/admin', label: 'Yönetici Paneli', icon: ShieldCheck },
    ],
  },
]

// Build a flat path → breadcrumb label map for quick lookup
export type BreadcrumbEntry = { domain: string; page: string }
export const BREADCRUMB_MAP: Record<string, BreadcrumbEntry> = {
  '/app': { domain: '', page: 'Ana Sayfa' },
}
NAV_GROUPS.forEach(g => {
  g.items.forEach(item => {
    BREADCRUMB_MAP[item.path] = { domain: g.label, page: item.label }
  })
})
