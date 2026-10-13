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
  labelKey: 'nav.dashboard',
  icon: LayoutDashboard,
}

// 9-domain navigation
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'calculation', domainKey: 'calculation',
    label: 'Hesaplama', labelKey: 'nav.calculation',
    items: [
      { id: 'torque',    path: '/app/calculation/torque',            label: 'Tork Hesap',          labelKey: 'nav.item.torque',   icon: Wrench },
      { id: 'n01391',    path: '/app/calculation/oem-prediction',    label: 'OEM Tork Öngörüsü',   labelKey: 'nav.item.n01391',   icon: Zap },
      { id: 'vdi',       path: '/app/calculation/advanced-analysis', label: 'Gelişmiş Analiz',     labelKey: 'nav.item.vdi',      icon: Microscope },
    ],
  },
  {
    id: 'validation', domainKey: 'validation',
    label: 'Doğrulama', labelKey: 'nav.validation',
    items: [
      { id: 'checklist',  path: '/app/validation/checklist',  label: 'Check-List',       labelKey: 'nav.item.checklist',  icon: CheckSquare },
      { id: 'yetenek',    path: '/app/validation/capability', label: 'Cm/Cmk Yetenek',   labelKey: 'nav.item.yetenek',    icon: TrendingUp },
      { id: 'validation', path: '/app/validation/technical',  label: 'Teknik Doğrulama', labelKey: 'nav.item.validation', icon: SearchCode },
    ],
  },
  {
    id: 'production', domainKey: 'production',
    label: 'Üretim', labelKey: 'nav.production',
    items: [
      { id: 'sikici',  path: '/app/production/tool-tracking', label: 'Sıkıcı Takip',    labelKey: 'nav.item.sikici',  icon: Settings2 },
      { id: 'problem', path: '/app/production/problems',      label: 'Problem Yönetimi', labelKey: 'nav.item.problem', icon: AlertTriangle },
    ],
  },
  {
    id: 'knowledge', domainKey: 'knowledge',
    label: 'Bilgi', labelKey: 'nav.knowledge',
    items: [
      { id: 'oem',  path: '/app/knowledge/oem-norms',  label: 'OEM Norm Sorgu', labelKey: 'nav.item.oem',  icon: Search },
      { id: 'norm', path: '/app/knowledge/norm-guide',  label: 'Norm Rehberi',   labelKey: 'nav.item.norm', icon: ClipboardList },
      { id: 'fmea', path: '/app/knowledge/fmea',        label: 'FMEA Kataloğu',  labelKey: 'nav.item.fmea', icon: Puzzle },
    ],
  },
  {
    id: 'traceability', domainKey: 'traceability',
    label: 'İzlenebilirlik', labelKey: 'nav.traceability',
    items: [
      { id: 'rapor', path: '/app/traceability/reports', label: 'Rapor Üret', labelKey: 'nav.item.rapor', icon: FileText },
      { id: 'arsiv', path: '/app/traceability/archive', label: 'Arşiv',      labelKey: 'nav.item.arsiv', icon: Archive },
    ],
  },
  {
    id: 'data', domainKey: 'data',
    label: 'Veri', labelKey: 'nav.data',
    adminOnly: true,
    items: [
      { id: 'calibration', path: '/app/data/calibration',         label: 'Kalibrasyon',         labelKey: 'nav.item.calibration', icon: Ruler },
      { id: 'qualitygate', path: '/app/data/quality-gate',        label: 'Veri Kalite Kapısı',  labelKey: 'nav.item.qualitygate', icon: ShieldCheck },
      { id: 'goldencases', path: '/app/data/golden-cases',        label: 'Altın Senaryolar',    labelKey: 'nav.item.goldencases', icon: Award },
      { id: 'releasecert', path: '/app/data/release-certificate', label: 'Sürüm Sertifikası',   labelKey: 'nav.item.releasecert', icon: Scroll },
      { id: 'versions',    path: '/app/data/versions',            label: 'Veri Sürümleri',      labelKey: 'nav.item.versions',    icon: Dna },
      { id: 'dataadmin',   path: '/app/data/upload',              label: 'Veri Yükleme & Onay', labelKey: 'nav.item.dataadmin',   icon: FolderInput },
    ],
  },
  {
    id: 'system', domainKey: 'system',
    label: 'Sistem', labelKey: 'nav.system',
    adminOnly: true,
    items: [
      { id: 'admin', path: '/app/system/admin', label: 'Yönetici Paneli', labelKey: 'nav.item.admin', icon: ShieldCheck },
    ],
  },
]

// Breadcrumb: path → { domainKey, pageKey } for translation
export type BreadcrumbEntry = { domainKey: string; pageKey: string }
export const BREADCRUMB_MAP: Record<string, BreadcrumbEntry> = {
  '/app': { domainKey: '', pageKey: 'nav.home' },
}
NAV_GROUPS.forEach(g => {
  g.items.forEach(item => {
    BREADCRUMB_MAP[item.path] = { domainKey: g.labelKey, pageKey: item.labelKey }
  })
})
