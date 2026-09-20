// ── GuideSchema.ts ──────────────────────────────────────────────────────────
// Shared type contract for all TorqPro module guide data.
// Import from this file in every <module>Guide.ts and in ModuleGuideDrawer.
// ────────────────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  step: number
  title: string
  description: string
  anchorId?: string          // DOM id of the region to highlight during guided demo
}

export interface ParameterEntry {
  label: string
  symbol?: string
  unit?: string
  explanation: string
  caution?: string
  fieldKey?: string          // keyof of the page's form type, for jump-to highlight
  anchorId?: string
}

export interface FAQEntry {
  question: string
  answer: string
}

export interface AcademyLink {
  title: string
  description: string
  available: boolean         // false → render "Yakında"
  href?: string
}

export type ExampleValue = string | number | boolean | null

export type ExampleValues = Record<string, ExampleValue>

export interface GuideExample {
  title: string
  useCase: string
  values: ExampleValues
  notes?: string
}

export interface DemoStep {
  index: number              // 1-based
  total: number
  label: string              // e.g. "1/6 Geometri"
  title: string
  description: string
  anchorId: string
}

export interface ResultGuidanceItem {
  label: string
  description: string
  thresholds?: Array<{
    color: string
    label: string
    meaning: string
  }>
}

export interface ModuleDescription {
  heading: string
  paragraphs: string[]
  note: string
}

export interface ResultGuidance {
  heading: string
  items: ResultGuidanceItem[]
}

// ── Root guide type ───────────────────────────────────────────────────────────
// Each module's guide file exports one object conforming to this interface.
export interface ModuleGuide {
  /** Registry key — matches legacyPageId or page route segment */
  id: string
  /** Human-readable module name */
  title: string
  /** Subtitle shown in the drawer header */
  subtitle: string
  /** Schema version — bump when adding new required fields */
  version: string

  // ── Sections ──────────────────────────────────────────────────────────────
  description: ModuleDescription
  workflow: WorkflowStep[]
  parameters: ParameterEntry[]
  /** null for modules without a worked example */
  example: GuideExample | null
  resultGuidance: ResultGuidance | null
  faq: FAQEntry[]
  academyLinks: AcademyLink[]
  demoSteps: DemoStep[]

  // ── Capability flags ──────────────────────────────────────────────────────
  /** True for TorqueCalcPage / AdvancedAnalysisPage — enables load-example flow */
  supportsExampleLoad: boolean
  /** True for modules with interactive guided demo */
  supportsDemoMode: boolean
}
