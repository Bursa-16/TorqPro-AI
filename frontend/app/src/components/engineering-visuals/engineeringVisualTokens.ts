/**
 * TorqPro Engineering Visual Token System
 *
 * VISUAL-03C.2 — Canonical token architecture for all engineering diagrams
 * and module-control interactive states.
 *
 * OWNERSHIP (HR-06):
 *   Engineering SVG semantic palette  → engineeringVisualTokens.ts  (this file)
 *   CSS global shell / control tokens → index.css  (--tp-module-btn-* vars)
 *
 * HARD RULE: Engineering schematics use a LIGHT canvas against the dark app shell.
 * Do NOT use dark fills for structural geometry.
 *
 * Canonical visual hierarchy:
 *   dark TorqPro shell → light engineering canvas → dark technical outlines
 *   → subtle section fills/hatching → cyan/blue active dimension
 */

// ─────────────────────────────────────────────────────────────────────────────
// PART 1 — Engineering visual palette (SVG / canvas)
// ─────────────────────────────────────────────────────────────────────────────

export const EV = {
  // ── Canvas ─────────────────────────────────────────────────────────────────
  /** SVG background — light engineering drawing surface */
  canvasBackground:    '#F7F9FC',
  /** Canvas border — subtle frame around drawing area */
  canvasBorder:        '#D0D9E4',

  // ── Structural geometry ────────────────────────────────────────────────────
  /** Primary geometry outlines — bolt head, nut, plate edges */
  geometryPrimary:     '#263445',
  /** Secondary geometry — internal lines, secondary edges */
  geometrySecondary:   '#59697A',

  // ── Part fills ─────────────────────────────────────────────────────────────
  /** Bolt head and nut body fill */
  fastenerFill:        '#E4EAF1',
  /** Active / highlighted fastener fill (hover or selected state) */
  fastenerActiveFill:  '#D4DCED',
  /** Upper clamped member / plate fill */
  clampedUpperFill:    '#EDF1F5',
  /** Lower clamped member / plate fill */
  clampedLowerFill:    '#E7ECF2',
  /** Washer fill */
  washerFill:          '#DDE4EB',
  /** Bolt shank fill */
  shankFill:           '#E8EDF4',
  /** Hole / clearance void fill — light negative space (NOT dark) */
  holeVoidFill:        '#F0F4F8',
  /** Hole / clearance void stroke */
  holeStroke:          '#B8C4D0',

  // ── Detail ─────────────────────────────────────────────────────────────────
  /** Section hatch lines */
  sectionHatch:        '#AAB5C2',
  /** Centreline — dashed axis */
  centerline:          '#8291A3',

  // ── Dimension annotations ──────────────────────────────────────────────────
  /** Input dimension stroke — USER_INPUT provenance */
  inputStroke:         '#007F9E',
  /** Input dimension text — USER_INPUT label */
  inputText:           '#006B85',
  /** Computed / FRONTEND_COMPUTED result annotation */
  computedResult:      '#1769AA',
  /** Guidance / reference annotation */
  guidance:            '#667585',
  /** Schematic note — secondary informational annotation */
  schematicNote:       '#8291A3',

  // ── Status ─────────────────────────────────────────────────────────────────
  /** PASS / valid state */
  valid:               '#16835D',
  /** FAIL / error state */
  fail:                '#C83C3C',
  /** WARNING state */
  warn:                '#B87500',
  /** EQ / neutral state */
  neutral:             '#59697A',

  // ── Status zone fills ──────────────────────────────────────────────────────
  validFill:           'rgba(22,131,93,0.12)',
  failFill:            'rgba(200,60,60,0.12)',
  warnFill:            'rgba(184,117,0,0.12)',
  neutralFill:         'rgba(89,105,122,0.10)',

  // ── Contextual overlays ────────────────────────────────────────────────────
  /** Important context highlight — e.g. active engagement zone */
  contextImportant:    'rgba(0,127,158,0.12)',
  /** Background context overlay — very subtle zone marker */
  contextBackground:   'rgba(38,52,69,0.06)',

  // ── Interaction ────────────────────────────────────────────────────────────
  /** Focus ring for keyboard navigation on canvas elements */
  focusRing:           '#4a7cc9',

  // ── Marker / arrowhead fills ───────────────────────────────────────────────
  markerDefault:       '#1769AA',
  markerValid:         '#16835D',
  markerFail:          '#C83C3C',
  markerWarn:          '#B87500',

  // ── Legacy aliases — kept for zero-diff Scene01 compatibility ─────────────
  // These resolve to the canonical tokens above.
  /** @deprecated use computedResult */
  result:              '#1769AA',
  /** @deprecated use holeVoidFill */
  holeFill:            '#F0F4F8',
} as const

export type EvKey = keyof typeof EV

// ─────────────────────────────────────────────────────────────────────────────
// PART 2 — Module-control interactive state tokens
// Used by components that display module selectors / navigation buttons.
// CSS counterparts live in index.css as --tp-module-btn-* custom properties.
// ─────────────────────────────────────────────────────────────────────────────

export const MC = {
  // ── DEFAULT ────────────────────────────────────────────────────────────────
  moduleButtonBg:              'transparent',
  moduleButtonText:            '#b8c4d8',       // tp-text-2
  moduleButtonBorder:          'transparent',

  // ── HOVER ──────────────────────────────────────────────────────────────────
  moduleButtonBgHover:         '#1e2336',       // tp-surface-hover
  moduleButtonTextHover:       '#dce0f0',       // tp-text
  moduleButtonBorderHover:     'transparent',

  // ── ACTIVE (3-signal: bg + text + border) ─────────────────────────────────
  moduleButtonBgActive:        'rgba(74,124,201,0.18)',
  moduleButtonTextActive:      '#ffffff',
  moduleButtonBorderActive:    'rgba(74,124,201,0.55)',
  /** Controlled outer glow — small, engineering-blue, no bloom */
  moduleButtonActiveGlow:      '0 0 0 2px rgba(74,124,201,0.18)',

  // ── FOCUS ──────────────────────────────────────────────────────────────────
  /** Visible keyboard focus ring */
  moduleButtonFocusRing:       '0 0 0 2px #4a7cc9, 0 0 0 4px rgba(74,124,201,0.18)',

  // ── DISABLED ───────────────────────────────────────────────────────────────
  moduleButtonDisabledBg:      'transparent',
  moduleButtonDisabledText:    '#4a5070',
  moduleButtonDisabledBorder:  'transparent',
} as const

export type McKey = keyof typeof MC
