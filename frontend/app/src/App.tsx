import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useLanguage } from './i18n/LanguageContext'
import AppShell from './layouts/AppShell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TorqueCalcPage from './pages/TorqueCalcPage'
import AdvancedAnalysisPage from './pages/AdvancedAnalysisPage'
import LegacyIframePage from './pages/LegacyIframePage'

// ── Legacy iframe wrapper ──────────────────────────────────────────────────
// Renders legacy page inside an embedded iframe; React shell remains visible.
// moduleId: when provided and a guide exists for this id, renders ModuleGuideDrawer.
function Legacy({ id, labelKey, moduleId }: { id: string; labelKey: string; moduleId?: string }) {
  const { t } = useLanguage()
  return <LegacyIframePage legacyPageId={id} label={t(labelKey)} moduleId={moduleId} />
}

function ProtectedRoutes() {
  const { isAuthenticated, user, role, login, logout } = useAuth()
  if (!isAuthenticated) return <LoginPage onLogin={login} />

  return (
    <Routes>
      <Route element={<AppShell user={user} role={role} onLogout={logout} />}>

        {/* ── Dashboard ─────────────────────────────────────────────────── */}
        <Route path="app" element={<DashboardPage />} />

        {/* ── Calculation ───────────────────────────────────────────────── */}
        <Route path="app/calculation/torque"            element={<TorqueCalcPage />} />
        <Route path="app/calculation/oem-prediction"    element={<Legacy id="n01391"    labelKey="nav.item.n01391"      moduleId="oem-prediction" />} />
        <Route path="app/calculation/advanced-analysis" element={<AdvancedAnalysisPage />} />

        {/* ── Validation ────────────────────────────────────────────────── */}
        <Route path="app/validation/checklist"          element={<Legacy id="checklist" labelKey="nav.item.checklist"    moduleId="checklist" />} />
        <Route path="app/validation/capability"         element={<Legacy id="yetenek"   labelKey="nav.item.yetenek"      moduleId="yetenek" />} />
        <Route path="app/validation/technical"          element={<Legacy id="validation"labelKey="nav.item.validation"   moduleId="validation" />} />

        {/* ── Production ────────────────────────────────────────────────── */}
        <Route path="app/production/tool-tracking"      element={<Legacy id="sikici"    labelKey="nav.item.sikici"       moduleId="sikici" />} />
        <Route path="app/production/problems"           element={<Legacy id="problem"   labelKey="nav.item.problem"      moduleId="problem" />} />

        {/* ── Knowledge ─────────────────────────────────────────────────── */}
        <Route path="app/knowledge/oem-norms"           element={<Legacy id="oem"       labelKey="nav.item.oem"          moduleId="oem" />} />
        <Route path="app/knowledge/norm-guide"          element={<Legacy id="norm"      labelKey="nav.item.norm"         moduleId="norm" />} />
        <Route path="app/knowledge/fmea"                element={<Legacy id="fmea"      labelKey="nav.item.fmea"         moduleId="fmea" />} />

        {/* ── Traceability ──────────────────────────────────────────────── */}
        <Route path="app/traceability/reports"          element={<Legacy id="rapor"     labelKey="nav.item.rapor"        moduleId="rapor" />} />
        <Route path="app/traceability/archive"          element={<Legacy id="arsiv"     labelKey="nav.item.arsiv"        moduleId="arsiv" />} />

        {/* ── Data (admin) ──────────────────────────────────────────────── */}
        <Route path="app/data/calibration"              element={<Legacy id="calibration"    labelKey="nav.item.calibration"   moduleId="calibration" />} />
        <Route path="app/data/quality-gate"             element={<Legacy id="qualitygate"    labelKey="nav.item.qualitygate"   moduleId="qualitygate" />} />
        <Route path="app/data/golden-cases"             element={<Legacy id="goldencases"    labelKey="nav.item.goldencases"   moduleId="goldencases" />} />
        <Route path="app/data/release-certificate"      element={<Legacy id="releasecert"    labelKey="nav.item.releasecert"   moduleId="releasecert" />} />
        <Route path="app/data/versions"                 element={<Legacy id="versions"       labelKey="nav.item.versions"      moduleId="versions" />} />
        <Route path="app/data/upload"                   element={<Legacy id="dataadmin"      labelKey="nav.item.dataadmin"     moduleId="dataadmin" />} />

        {/* ── System (admin) — no guide intentionally ───────────────────── */}
        <Route path="app/system/admin"                  element={<Legacy id="admin"      labelKey="nav.item.admin" />} />

        {/* ── Legacy redirects — old flat routes preserved ───────────────── */}
        <Route path="torque"         element={<Navigate to="/app/calculation/torque"            replace />} />
        <Route path="oem-prediction" element={<Navigate to="/app/calculation/oem-prediction"    replace />} />
        <Route path="vdi-analysis"   element={<Navigate to="/app/calculation/advanced-analysis" replace />} />
        <Route path="checklist"      element={<Navigate to="/app/validation/checklist"          replace />} />
        <Route path="capability"     element={<Navigate to="/app/validation/capability"         replace />} />
        <Route path="validation"     element={<Navigate to="/app/validation/technical"          replace />} />
        <Route path="tool-tracking"  element={<Navigate to="/app/production/tool-tracking"      replace />} />
        <Route path="problems"       element={<Navigate to="/app/production/problems"           replace />} />
        <Route path="oem-norms"      element={<Navigate to="/app/knowledge/oem-norms"           replace />} />
        <Route path="norm-guide"     element={<Navigate to="/app/knowledge/norm-guide"          replace />} />
        <Route path="fmea"           element={<Navigate to="/app/knowledge/fmea"                replace />} />
        <Route path="reports"        element={<Navigate to="/app/traceability/reports"          replace />} />
        <Route path="archive"        element={<Navigate to="/app/traceability/archive"          replace />} />
        <Route path="calibration"    element={<Navigate to="/app/data/calibration"              replace />} />
        <Route path="quality-gate"   element={<Navigate to="/app/data/quality-gate"             replace />} />
        <Route path="golden-cases"   element={<Navigate to="/app/data/golden-cases"             replace />} />
        <Route path="release-cert"   element={<Navigate to="/app/data/release-certificate"      replace />} />
        <Route path="data-versions"  element={<Navigate to="/app/data/versions"                 replace />} />
        <Route path="data-admin"     element={<Navigate to="/app/data/upload"                   replace />} />
        <Route path="admin"          element={<Navigate to="/app/system/admin"                  replace />} />

        {/* Root / → /app */}
        <Route index element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<ProtectedRoutes />} />
      </Routes>
    </BrowserRouter>
  )
}
