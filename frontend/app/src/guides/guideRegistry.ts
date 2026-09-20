// ── guideRegistry.ts ─────────────────────────────────────────────────────────
// Central registry mapping route/module IDs to their ModuleGuide objects.
// Returns null for unimplemented modules — callers must handle null gracefully.
// ─────────────────────────────────────────────────────────────────────────────

import type { ModuleGuide } from './GuideSchema'

// ── Calculation ──────────────────────────────────────────────────────────────
import { torqueGuide }            from './torqueGuide'
import { advancedAnalysisGuide }  from './advancedAnalysisGuide'
import { oemPredictionGuide }     from './oemPredictionGuide'

// ── Validation ───────────────────────────────────────────────────────────────
import { checklistGuide }         from './checklistGuide'
import { yetenekGuide }           from './capabilityGuide'
import { validationGuide }        from './technicalGuide'

// ── Production ───────────────────────────────────────────────────────────────
import { sikiciGuide }            from './toolTrackingGuide'
import { problemGuide }           from './problemGuide'

// ── Knowledge ────────────────────────────────────────────────────────────────
import { oemGuide }               from './oemNormsGuide'
import { normGuide }              from './normGuideGuide'
import { fmeaGuide }              from './fmeaGuide'

// ── Traceability ─────────────────────────────────────────────────────────────
import { raporGuide }             from './reportGuide'
import { arsivGuide }             from './archiveGuide'

// ── Data (admin) ─────────────────────────────────────────────────────────────
import { calibrationGuide }       from './calibrationGuide'
import { qualitygateGuide }       from './qualityGateGuide'
import { goldencasesGuide }       from './goldenCasesGuide'
import { releasecertGuide }       from './releaseCertGuide'
import { versionsGuide }          from './versionsGuide'
import { dataadminGuide }         from './dataAdminGuide'

// ── Registry ──────────────────────────────────────────────────────────────────
// Key: legacyPageId OR route segment that the page uses as its moduleId.
// Value: ModuleGuide | null  (null = guide not yet authored for this module)

const registry: Record<string, ModuleGuide | null> = {
  // ── Calculation ─────────────────────────────────────────────────────────
  'torque':              torqueGuide,
  'advanced-analysis':   advancedAnalysisGuide,
  'oem-prediction':      oemPredictionGuide,

  // ── Validation ──────────────────────────────────────────────────────────
  'checklist':           checklistGuide,
  'yetenek':             yetenekGuide,
  'validation':          validationGuide,

  // ── Production ──────────────────────────────────────────────────────────
  'sikici':              sikiciGuide,
  'problem':             problemGuide,

  // ── Knowledge ───────────────────────────────────────────────────────────
  'oem':                 oemGuide,
  'norm':                normGuide,
  'fmea':                fmeaGuide,

  // ── Traceability ────────────────────────────────────────────────────────
  'rapor':               raporGuide,
  'arsiv':               arsivGuide,

  // ── Data (admin) ────────────────────────────────────────────────────────
  'calibration':         calibrationGuide,
  'qualitygate':         qualitygateGuide,
  'goldencases':         goldencasesGuide,
  'releasecert':         releasecertGuide,
  'versions':            versionsGuide,
  'dataadmin':           dataadminGuide,

  // ── System (admin) — no guide intentionally ──────────────────────────────
  'admin':               null,
}

/**
 * Look up a guide by module/page id.
 * @returns ModuleGuide when a guide exists for this id, null otherwise.
 */
export function guideFor(id: string): ModuleGuide | null {
  return registry[id] ?? null
}
