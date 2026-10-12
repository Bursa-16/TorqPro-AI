/**
 * TorqPro Engineering Visual System — Scene Type Contracts
 *
 * VISUAL-03B.3 — SCENE_01 type definitions.
 * Provenance authority: VISUAL-03B.2-R1 (corrected contract).
 *
 * All provenance classifications are enforced here as doc-comments so
 * future consumers cannot accidentally mislabel a field.
 */

// ── State identifiers ──────────────────────────────────────────────────────

export type Scene01State =
  | 'S01-DIAMETER'
  | 'S01-BEARING-DIAMETER'
  | 'S01-ENGAGEMENT'
  | 'S01-GRIP'
  | 'S01-BEARING-PRESSURE'
  | 'S01-THREAD-SAFETY'

// ── Provenance classes (doc-comment only; not runtime-enforced) ────────────

/**
 * USER_INPUT — value originates from a user-entered form field.
 * Annotated in cyan (#22b8cf / --color-tp-calc) in the visual.
 */
export type UserInput = number

/**
 * FRONTEND_COMPUTED — value is computed by the browser-side calculation,
 * NOT returned by the API/backend. Must never be labelled as an API result.
 */
export type FrontendComputed = number

/**
 * COMPUTED_RESULT — value is returned by the backend calculation engine
 * (EngineeringCheck or JointAnalysis). Annotated in engineering-blue.
 */
export type ComputedResult = number

// ── Values contract ────────────────────────────────────────────────────────

export interface Scene01Values {
  /**
   * USER_INPUT — nominal bolt diameter d, in mm.
   * Source: user form field.
   */
  diameter_mm?: UserInput

  /**
   * USER_INPUT — effective mean bearing diameter D_Km = 2 × r_mean, in mm.
   * Source: user form field (EngineeringCheck: effective_bearing_diameter_mm).
   * Geometry: full horizontal diameter through bolt centerline, NOT annulus width.
   */
  effective_bearing_diameter_mm?: UserInput

  /**
   * USER_INPUT — thread engagement length L_e, in mm.
   * Module: EngineeringCheck ONLY.
   * NOT bound to JointAnalysis (analyze_joint has no engagement_mm parameter).
   */
  engagement_mm?: UserInput

  /**
   * L_grip is VISUAL_CONTEXT_ONLY.
   * There is NO actual TorqPro grip_length field.
   * This field intentionally omitted — no value binding, no annotation.
   */
  // grip_length_mm: intentionally absent

  /**
   * FRONTEND_COMPUTED — bearing pressure p_B, in MPa.
   * p_B = F_M / A_bearing (computed in browser, NOT an API-returned value).
   */
  bearing_pressure_mpa?: FrontendComputed

  /**
   * USER_INPUT + LIMIT — allowable bearing pressure p_B,allow, in MPa.
   * Source: user form field (bearing_limit_mpa).
   * Displayed with dashed border (LIMIT styling).
   */
  bearing_limit_mpa?: UserInput

  /**
   * COMPUTED_RESULT — internal thread safety factor.
   * Source: evaluate_joint() return value (internal_thread_sf).
   * PASS if SF >= 1.0; FAIL if SF < 1.0; equality = PASS.
   */
  internal_thread_sf?: ComputedResult

  /**
   * COMPUTED_RESULT — external thread safety factor.
   * Source: evaluate_joint() return value (external_thread_sf).
   * PASS if SF >= 1.0; FAIL if SF < 1.0; equality = PASS.
   */
  external_thread_sf?: ComputedResult
}

// ── Status contract ────────────────────────────────────────────────────────

export type SceneStatus = 'pass' | 'fail' | 'not_evaluable'

export interface Scene01StatusFlags {
  /**
   * Bearing pressure status.
   * PASS: p_B <= p_B,allow (equality = PASS).
   * FAIL: p_B > p_B,allow.
   * NO amber, NO warn zone (PROHIBITED per B.0-R1 C-04).
   */
  bearingPressure?: SceneStatus

  /**
   * Internal thread safety factor status.
   * PASS: internal_thread_sf >= 1.0 (equality = PASS).
   * FAIL: internal_thread_sf < 1.0.
   * NO amber, NO 1.5 threshold.
   */
  internalThreadSf?: SceneStatus

  /**
   * External thread safety factor status.
   * PASS: external_thread_sf >= 1.0 (equality = PASS).
   * FAIL: external_thread_sf < 1.0.
   * NO amber, NO merged SF.
   */
  externalThreadSf?: SceneStatus
}

// ── Language ───────────────────────────────────────────────────────────────

/** Supported UI languages matching TorqPro TR/EN convention. */
export type SceneLang = 'tr' | 'en'

// ── Component props ────────────────────────────────────────────────────────

export interface Scene01Props {
  /** Which of the six engineering states is currently active. */
  activeState: Scene01State

  /** Optional numeric values for annotations (all provenance-typed above). */
  values?: Scene01Values

  /** Optional pass/fail status flags computed by the caller. */
  status?: Scene01StatusFlags

  /** UI language; defaults to 'tr' matching TorqPro convention. */
  lang?: SceneLang

  /** Additional CSS class(es) for the wrapper element. */
  className?: string
}
