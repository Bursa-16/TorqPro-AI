import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import AppShell from './layouts/AppShell'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TorqueCalcPage from './pages/TorqueCalcPage'
import AdvancedAnalysisPage from './pages/AdvancedAnalysisPage'
import LegacyIframePage from './pages/LegacyIframePage'

// ── Legacy iframe wrapper ──────────────────────────────────────────────────
// Renders legacy page inside an embedded iframe; React shell remains visible.
// moduleId: when provided and a guide exists for this id, renders ModuleGuideDrawer.
function Legacy({ id, label, moduleId }: { id: string; label: string; moduleId?: string }) {
  return <LegacyIframePage legacyPageId={id} label={label} moduleId={moduleId} />
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
        <Route path="app/calculation/oem-prediction"    element={<Legacy id="n01391"    label="OEM Tork Öngörüsü"  moduleId="oem-prediction" />} />
        <Route path="app/calculation/advanced-analysis" element={<AdvancedAnalysisPage />} />

        {/* ── Validation ────────────────────────────────────────────────── */}
        <Route path="app/validation/checklist"          element={<Legacy id="checklist" label="Check-List"         moduleId="checklist" />} />
        <Route path="app/validation/capability"         element={<Legacy id="yetenek"   label="Cm/Cmk Yetenek"     moduleId="yetenek" />} />
        <Route path="app/validation/technical"          element={<Legacy id="validation"label="Teknik Doğrulama"   moduleId="validation" />} />

        {/* ── Production ────────────────────────────────────────────────── */}
        <Route path="app/production/tool-tracking"      element={<Legacy id="sikici"    label="Sıkıcı Takip"       moduleId="sikici" />} />
        <Route path="app/production/problems"           element={<Legacy id="problem"   label="Problem Yönetimi"   moduleId="problem" />} />

        {/* ── Knowledge ─────────────────────────────────────────────────── */}
        <Route path="app/knowledge/oem-norms"           element={<Legacy id="oem"       label="OEM Norm Sorgu"     moduleId="oem" />} />
        <Route path="app/knowledge/norm-guide"          element={<Legacy id="norm"      label="Norm Rehberi"       moduleId="norm" />} />
        <Route path="app/knowledge/fmea"                element={<Legacy id="fmea"      label="FMEA Kataloğu"      moduleId="fmea" />} />

        {/* ── Traceability ──────────────────────────────────────────────── */}
        <Route path="app/traceability/reports"          element={<Legacy id="rapor"     label="Rapor Üret"         moduleId="rapor" />} />
        <Route path="app/traceability/archive"          element={<Legacy id="arsiv"     label="Arşiv"              moduleId="arsiv" />} />

        {/* ── Data (admin) ──────────────────────────────────────────────── */}
        <Route path="app/data/calibration"              element={<Legacy id="calibration"    label="Kalibrasyon"          moduleId="calibration" />} />
        <Route path="app/data/quality-gate"             element={<Legacy id="qualitygate"    label="Veri Kalite Kapısı"   moduleId="qualitygate" />} />
        <Route path="app/data/golden-cases"             element={<Legacy id="goldencases"    label="Altın Senaryolar"     moduleId="goldencases" />} />
        <Route path="app/data/release-certificate"      element={<Legacy id="releasecert"    label="Sürüm Sertifikası"    moduleId="releasecert" />} />
        <Route path="app/data/versions"                 element={<Legacy id="versions"       label="Veri Sürümleri"       moduleId="versions" />} />
        <Route path="app/data/upload"                   element={<Legacy id="dataadmin"      label="Veri Yükleme & Onay"  moduleId="dataadmin" />} />

        {/* ── System (admin) — no guide intentionally ───────────────────── */}
        <Route path="app/system/admin"                  element={<Legacy id="admin"      label="Yönetici Paneli" />} />

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
