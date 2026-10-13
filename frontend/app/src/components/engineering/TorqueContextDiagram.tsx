/**
 * TorqueContextDiagram — Contextual parameter visual guidance
 * GEOMETRY-CONTEXT-01: Field-to-diagram interaction for Torque Calculation page.
 *
 * Reuses JointVisualization SVG coordinate system (viewBox 0 0 300 295).
 * Active parameter highlighted with EV.inputStroke (cyan-blue engineering token).
 * Non-geometry states (yield_utilization, rp02) show contextual annotation only.
 * Result state shows force arrows (M_A, F_M, Fc) per HARD RULE 17.
 */

import type { EngineeringCheckResult } from '../../types/api'
import { EV } from '../engineering-visuals/engineeringVisualTokens'

// ── Visual focus state type (HARD RULE 13) ──────────────────────────────────
export type TorqueVisualFocus =
  | 'neutral'
  | 'diameter_d'
  | 'pitch_p'
  | 'stress_area_as'
  | 'bearing_diameter_dw'
  | 'thread_friction'
  | 'bearing_friction'
  | 'yield_utilization'
  | 'rp02'

interface Props {
  focus: TorqueVisualFocus
  result: EngineeringCheckResult | null
  lang?: 'tr' | 'en'
  className?: string
}

// ── Active highlight tokens ──────────────────────────────────────────────────
const ACT_FILL   = 'rgba(0,127,158,0.13)'
const ACT_STROKE = EV.inputStroke  // '#007F9E'
const DIM_COLOR  = EV.inputText    // '#006B85'
const NOTE_COLOR = EV.guidance     // '#667585'

// ── SVG coordinate constants (mirror JointVisualization exactly) ─────────────
// Bolt head:    x=120 y=34  w=42 h=20   → center x=141
// Washer-head:  x=113 y=54  w=56 h=6    → x=113..169, y=54..60
// Shank:        x=132 y=52  w=18 h=158  → center x=141, right x=150
// Upper plate:  x=74  y=124 w=152 h=34
// Lower plate:  x=74  y=158 w=152 h=34
// Washer-nut:   x=113 y=184 w=56  h=6   → y=184..190
// Nut:          x=120 y=190 w=42  h=20
// Thread lines: x1=132 x2=150, y1=96+dy y2=101+dy, dy=0,11,...,143 (14 lines)

// ── Arrow marker definitions ─────────────────────────────────────────────────
function Markers() {
  return (
    <defs>
      <marker id="tcd-blue" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0,8 3,0 6" fill={EV.computedResult} />
      </marker>
      <marker id="tcd-clamp" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0,8 3,0 6" fill={EV.guidance} />
      </marker>
      <marker id="tcd-act-r" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
        <polygon points="0 0,8 3,0 6" fill={ACT_STROKE} />
      </marker>
      <marker id="tcd-act-l" markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto">
        <polygon points="8 0,0 3,8 6" fill={ACT_STROKE} />
      </marker>
      <marker id="tcd-act-u" markerWidth="6" markerHeight="8" refX="3" refY="1" orient="auto">
        <polygon points="0 8,3 0,6 8" fill={ACT_STROKE} />
      </marker>
      <marker id="tcd-act-d" markerWidth="6" markerHeight="8" refX="3" refY="7" orient="auto">
        <polygon points="0 0,3 8,6 0" fill={ACT_STROKE} />
      </marker>
    </defs>
  )
}

// ── Base assembly (always rendered) ─────────────────────────────────────────
function BaseAssembly() {
  return (
    <g>
      {/* Clamped members */}
      <rect x="74" y="124" width="152" height="34" rx="2"
        fill={EV.clampedUpperFill} stroke={EV.geometryPrimary} strokeWidth="1.2" />
      <rect x="74" y="158" width="152" height="34" rx="2"
        fill={EV.clampedLowerFill} stroke={EV.geometryPrimary} strokeWidth="1.2" />

      {/* Engineering hatching — top plate */}
      {Array.from({ length: 13 }, (_, i) => i * 12).map(x => (
        <line key={`th-${x}`} x1={74 + x} y1="124" x2={82 + x} y2="114"
          stroke={EV.sectionHatch} strokeWidth="0.8" />
      ))}
      {/* Engineering hatching — bottom plate */}
      {Array.from({ length: 13 }, (_, i) => i * 12).map(x => (
        <line key={`bh-${x}`} x1={74 + x} y1="192" x2={82 + x} y2="202"
          stroke={EV.sectionHatch} strokeWidth="0.8" />
      ))}

      {/* Bolt shaft */}
      <rect x="132" y="52" width="18" height="158" rx="2"
        fill={EV.shankFill} stroke={EV.geometryPrimary} strokeWidth="0.9" />

      {/* Thread indication */}
      {Array.from({ length: 14 }, (_, i) => i * 11).map(dy => (
        <line key={dy} x1="132" y1={96 + dy} x2="150" y2={101 + dy}
          stroke={EV.sectionHatch} strokeWidth="0.7" />
      ))}

      {/* Bolt head */}
      <rect x="120" y="34" width="42" height="20" rx="2.5"
        fill={EV.fastenerFill} stroke={EV.geometryPrimary} strokeWidth="1" />
      <line x1="132" y1="34" x2="132" y2="54" stroke={EV.geometrySecondary} strokeWidth="0.7" />
      <line x1="150" y1="34" x2="150" y2="54" stroke={EV.geometrySecondary} strokeWidth="0.7" />
      <rect x="120" y="34" width="42" height="5" rx="1.5" fill={EV.geometrySecondary} opacity="0.15" />

      {/* Washer under head */}
      <rect x="113" y="54" width="56" height="6" rx="1.5"
        fill={EV.washerFill} stroke={EV.geometrySecondary} strokeWidth="0.7" />

      {/* Nut */}
      <rect x="120" y="190" width="42" height="20" rx="2.5"
        fill={EV.fastenerFill} stroke={EV.geometryPrimary} strokeWidth="1" />
      <line x1="132" y1="190" x2="132" y2="210" stroke={EV.geometrySecondary} strokeWidth="0.7" />
      <line x1="150" y1="190" x2="150" y2="210" stroke={EV.geometrySecondary} strokeWidth="0.7" />
      <rect x="120" y="205" width="42" height="5" rx="1.5" fill={EV.geometrySecondary} opacity="0.20" />

      {/* Washer under nut */}
      <rect x="113" y="184" width="56" height="6" rx="1.5"
        fill={EV.washerFill} stroke={EV.geometrySecondary} strokeWidth="0.7" />
    </g>
  )
}

// ── Result force arrows (HARD RULE 17) ───────────────────────────────────────
function ResultArrows({ result }: { result: EngineeringCheckResult }) {
  const preload = result.preload_n
  const torque  = result.torque_nom_nm
  return (
    <g>
      {/* Torque arc */}
      <path d="M 166 46 A 26 26 0 0 1 190 58"
        fill="none" stroke={EV.computedResult} strokeWidth="2.2"
        markerEnd="url(#tcd-blue)" />
      <text x="196" y="50" fill={EV.computedResult} fontSize="11" fontWeight="700">M_A</text>
      <text x="196" y="63" fill={EV.inputText} fontSize="9.5" fontWeight="500">
        {torque.toFixed(1)} Nm
      </text>

      {/* Preload arrows */}
      <line x1="100" y1="118" x2="100" y2="74"
        stroke={EV.computedResult} strokeWidth="2.2" markerEnd="url(#tcd-blue)" />
      <line x1="100" y1="190" x2="100" y2="230"
        stroke={EV.computedResult} strokeWidth="2.2" markerEnd="url(#tcd-blue)" />
      <text x="100" y="93" fill={EV.computedResult} fontSize="10" fontWeight="700" textAnchor="middle">
        F_M
      </text>
      <text x="100" y="106" fill={EV.inputText} fontSize="9" textAnchor="middle">
        {(preload / 1000).toFixed(1)} kN
      </text>

      {/* Clamp force arrows */}
      <line x1="198" y1="118" x2="198" y2="140"
        stroke={EV.guidance} strokeWidth="2.2" markerEnd="url(#tcd-clamp)" />
      <line x1="198" y1="190" x2="198" y2="168"
        stroke={EV.guidance} strokeWidth="2.2" markerEnd="url(#tcd-clamp)" />
      <text x="240" y="154" fill={EV.guidance} fontSize="10" fontWeight="700" textAnchor="middle">Fc</text>
      <text x="240" y="166" fill={EV.guidance} fontSize="9" textAnchor="middle">Clamp</text>
    </g>
  )
}

// ── Overlay: diameter_d ───────────────────────────────────────────────────────
// Highlight: shank (x=132..150), dimension from washer face downward
function OverlayDiameter({ lang }: { lang: 'tr' | 'en' }) {
  const dimY = 240
  return (
    <g>
      {/* Shank highlight */}
      <rect x="132" y="52" width="18" height="158" rx="2"
        fill={ACT_FILL} stroke={ACT_STROKE} strokeWidth="1.4" />

      {/* Extension lines from shank sides down to dim line */}
      <line x1="132" y1="213" x2="132" y2={dimY + 4}
        stroke={ACT_STROKE} strokeWidth="0.8" strokeDasharray="3,2" />
      <line x1="150" y1="213" x2="150" y2={dimY + 4}
        stroke={ACT_STROKE} strokeWidth="0.8" strokeDasharray="3,2" />

      {/* Dimension line with arrowheads */}
      <line x1="132" y1={dimY} x2="150" y2={dimY}
        stroke={ACT_STROKE} strokeWidth="1.1"
        markerStart="url(#tcd-act-l)" markerEnd="url(#tcd-act-r)" />

      {/* Tick marks at extension line ends */}
      <line x1="129" y1={dimY} x2="135" y2={dimY} stroke={ACT_STROKE} strokeWidth="1.1" />
      <line x1="147" y1={dimY} x2="153" y2={dimY} stroke={ACT_STROKE} strokeWidth="1.1" />

      {/* Label */}
      <text x="141" y={dimY + 14} fill={DIM_COLOR} fontSize="11.5" fontWeight="700"
        textAnchor="middle" fontStyle="italic">d</text>
      <text x="141" y={dimY + 26} fill={NOTE_COLOR} fontSize="8.5" textAnchor="middle">
        {lang === 'tr' ? 'nominal çap' : 'nominal diameter'}
      </text>
    </g>
  )
}

// ── Overlay: pitch_p ──────────────────────────────────────────────────────────
// Highlight thread zone, show pitch bracket on left side
function OverlayPitch({ lang }: { lang: 'tr' | 'en' }) {
  const x1 = 110  // left bracket x
  return (
    <g>
      {/* Thread zone highlight (one pitch interval) */}
      <rect x="130" y="94" width="22" height="22" rx="1"
        fill={ACT_FILL} stroke={ACT_STROKE} strokeWidth="1.2" />

      {/* Horizontal extension lines from thread zone to bracket */}
      <line x1="132" y1="96" x2={x1 + 2} y2="96"
        stroke={ACT_STROKE} strokeWidth="0.8" strokeDasharray="3,2" />
      <line x1="132" y1="107" x2={x1 + 2} y2="107"
        stroke={ACT_STROKE} strokeWidth="0.8" strokeDasharray="3,2" />

      {/* Bracket lines */}
      <line x1={x1 + 2} y1="96" x2={x1} y2="96"
        stroke={ACT_STROKE} strokeWidth="1.1" />
      <line x1={x1} y1="96" x2={x1} y2="107"
        stroke={ACT_STROKE} strokeWidth="1.1" />
      <line x1={x1} y1="107" x2={x1 + 2} y2="107"
        stroke={ACT_STROKE} strokeWidth="1.1" />

      {/* Arrowhead up/down */}
      <line x1={x1} y1="96" x2={x1} y2="107"
        stroke={ACT_STROKE} strokeWidth="1.1"
        markerStart="url(#tcd-act-u)" markerEnd="url(#tcd-act-d)" />

      {/* Label */}
      <text x={x1 - 4} y="103" fill={DIM_COLOR} fontSize="11.5" fontWeight="700"
        textAnchor="end" fontStyle="italic">P</text>
      <text x="141" y="128" fill={NOTE_COLOR} fontSize="8.5" textAnchor="middle">
        {lang === 'tr' ? 'diş adımı' : 'thread pitch'}
      </text>
    </g>
  )
}

// ── Overlay: stress_area_as ───────────────────────────────────────────────────
// HARD RULE 12: As is an AREA — not a visible physical diameter
// Show thread zone highlight + leader with area annotation
function OverlayStressArea({ lang }: { lang: 'tr' | 'en' }) {
  const noteL1 = lang === 'tr' ? 'As — çekme gerilme' : 'As — tensile stress'
  const noteL2 = lang === 'tr' ? 'alanı (mm²)' : 'area (mm²)'
  const noteL3 = lang === 'tr' ? '≠ fiziksel çap' : '≠ physical diameter'
  return (
    <g>
      {/* Thread/shank zone highlight */}
      <rect x="130" y="94" width="22" height="116" rx="1"
        fill={ACT_FILL} stroke={ACT_STROKE} strokeWidth="1.2" strokeDasharray="4,2" />

      {/* Leader line */}
      <line x1="152" y1="152" x2="175" y2="152"
        stroke={ACT_STROKE} strokeWidth="0.9" />
      <line x1="175" y1="152" x2="175" y2="162"
        stroke={ACT_STROKE} strokeWidth="0.9" />

      {/* Annotation box */}
      <rect x="159" y="162" width="90" height="50" rx="3"
        fill={EV.canvasBackground} stroke={ACT_STROKE} strokeWidth="0.9" opacity="0.97" />
      <text x="204" y="177" fill={DIM_COLOR} fontSize="11" fontWeight="700" textAnchor="middle"
        fontStyle="italic">As</text>
      <text x="204" y="191" fill={NOTE_COLOR} fontSize="8" textAnchor="middle">{noteL1}</text>
      <text x="204" y="202" fill={NOTE_COLOR} fontSize="8" textAnchor="middle">{noteL2}</text>
      <text x="204" y="214" fill={EV.schematicNote} fontSize="7.5" textAnchor="middle"
        fontStyle="italic">{noteL3}</text>
    </g>
  )
}

// ── Overlay: bearing_diameter_dw ─────────────────────────────────────────────
// Highlight washer-under-head bearing surface, dimension line below assembly
function OverlayBearingDiameter({ lang }: { lang: 'tr' | 'en' }) {
  const dimY = 240
  return (
    <g>
      {/* Washer bearing surface highlight */}
      <rect x="113" y="54" width="56" height="6" rx="1.5"
        fill={ACT_FILL} stroke={ACT_STROKE} strokeWidth="1.4" />

      {/* Extension lines from washer edges down to dim line */}
      <line x1="113" y1="62" x2="113" y2={dimY + 4}
        stroke={ACT_STROKE} strokeWidth="0.8" strokeDasharray="3,2" />
      <line x1="169" y1="62" x2="169" y2={dimY + 4}
        stroke={ACT_STROKE} strokeWidth="0.8" strokeDasharray="3,2" />

      {/* Dimension line */}
      <line x1="113" y1={dimY} x2="169" y2={dimY}
        stroke={ACT_STROKE} strokeWidth="1.1"
        markerStart="url(#tcd-act-l)" markerEnd="url(#tcd-act-r)" />

      {/* Tick marks */}
      <line x1="110" y1={dimY} x2="116" y2={dimY} stroke={ACT_STROKE} strokeWidth="1.1" />
      <line x1="166" y1={dimY} x2="172" y2={dimY} stroke={ACT_STROKE} strokeWidth="1.1" />

      {/* Label */}
      <text x="141" y={dimY + 14} fill={DIM_COLOR} fontSize="11.5" fontWeight="700"
        textAnchor="middle" fontStyle="italic">Dw</text>
      <text x="141" y={dimY + 26} fill={NOTE_COLOR} fontSize="8.5" textAnchor="middle">
        {lang === 'tr' ? 'etkin oturma çapı' : 'effective bearing dia.'}
      </text>
    </g>
  )
}

// ── Overlay: thread_friction ──────────────────────────────────────────────────
// Highlight thread engagement zone (nut area), annotate μG
function OverlayThreadFriction({ lang }: { lang: 'tr' | 'en' }) {
  const label = lang === 'tr' ? 'Diş temas yüzeyi' : 'Thread contact surface'
  return (
    <g>
      {/* Thread zone in nut region */}
      <rect x="120" y="190" width="42" height="20" rx="2.5"
        fill={ACT_FILL} stroke={ACT_STROKE} strokeWidth="1.4" />
      {/* Thread highlight on shank in nut zone */}
      <rect x="130" y="190" width="22" height="20" rx="1"
        fill={ACT_FILL} stroke={ACT_STROKE} strokeWidth="0.9" strokeDasharray="3,2" />

      {/* Leader line */}
      <line x1="162" y1="200" x2="185" y2="200"
        stroke={ACT_STROKE} strokeWidth="0.9" />
      <line x1="185" y1="200" x2="185" y2="215"
        stroke={ACT_STROKE} strokeWidth="0.9" />

      {/* Annotation */}
      <text x="186" y="228" fill={DIM_COLOR} fontSize="10.5" fontWeight="700">μG</text>
      <text x="186" y="241" fill={NOTE_COLOR} fontSize="7.5">{label}</text>
    </g>
  )
}

// ── Overlay: bearing_friction ─────────────────────────────────────────────────
// Highlight both bearing surfaces (washer-head and washer-nut), annotate μK
function OverlayBearingFriction({ lang }: { lang: 'tr' | 'en' }) {
  const label = lang === 'tr' ? 'Oturma yüzeyi' : 'Bearing surface'
  return (
    <g>
      {/* Washer under head highlight */}
      <rect x="113" y="54" width="56" height="6" rx="1.5"
        fill={ACT_FILL} stroke={ACT_STROKE} strokeWidth="1.4" />

      {/* Washer under nut highlight */}
      <rect x="113" y="184" width="56" height="6" rx="1.5"
        fill={ACT_FILL} stroke={ACT_STROKE} strokeWidth="1.4" />

      {/* μK label — head side */}
      <line x1="169" y1="57" x2="195" y2="57" stroke={ACT_STROKE} strokeWidth="0.9" />
      <text x="197" y="61" fill={DIM_COLOR} fontSize="10.5" fontWeight="700">μK</text>

      {/* μK label — nut side */}
      <line x1="169" y1="187" x2="195" y2="187" stroke={ACT_STROKE} strokeWidth="0.9" />
      <text x="197" y="191" fill={DIM_COLOR} fontSize="10.5" fontWeight="700">μK</text>

      {/* Shared annotation */}
      <text x="141" y="255" fill={NOTE_COLOR} fontSize="8.5" textAnchor="middle">{label}</text>
    </g>
  )
}

// ── Overlay: yield_utilization ────────────────────────────────────────────────
// HARD RULE 12: NOT a geometry dimension — show target/utilization guidance state
function OverlayYieldUtilization({ lang }: { lang: 'tr' | 'en' }) {
  const line1 = lang === 'tr' ? 'Hedef akma oranı' : 'Target yield ratio'
  const line2 = lang === 'tr' ? 'Geometrik boyut değil' : 'Not a geometry dimension'
  const line3 = lang === 'tr' ? 'Malzeme kullanım hedefi' : 'Material utilization target'
  return (
    <g>
      {/* Subtle utilization bar on left (like JointVisualization util bar) */}
      <rect x="36" y="124" width="9" height="68" rx="2.5"
        fill={EV.holeVoidFill} stroke={EV.geometrySecondary} strokeWidth="0.8" />
      {/* Target indicator line at 75% */}
      <rect x="36" y={124 + 17} width="9" height="51" rx="2.5"
        fill={ACT_FILL} stroke={ACT_STROKE} strokeWidth="0.9" />
      <line x1="33" y1={124 + 17} x2="48" y2={124 + 17}
        stroke={ACT_STROKE} strokeWidth="1.1" strokeDasharray="3,1.5" />
      <text x="52" y={124 + 21} fill={DIM_COLOR} fontSize="8.5">75%</text>

      {/* Annotation */}
      <rect x="60" y="238" width="180" height="44" rx="3"
        fill={EV.canvasBackground} stroke={EV.geometrySecondary} strokeWidth="0.8" opacity="0.96" />
      <text x="150" y="253" fill={NOTE_COLOR} fontSize="9" textAnchor="middle">{line1}</text>
      <text x="150" y="266" fill={EV.schematicNote} fontSize="8" textAnchor="middle"
        fontStyle="italic">{line2}</text>
      <text x="150" y="278" fill={NOTE_COLOR} fontSize="8" textAnchor="middle">{line3}</text>
    </g>
  )
}

// ── Overlay: rp02 ─────────────────────────────────────────────────────────────
// HARD RULE 12: Rp0.2 is a material property — bolt head highlight + annotation
function OverlayRp02({ lang }: { lang: 'tr' | 'en' }) {
  const line1 = lang === 'tr' ? 'Rp0.2 — Akma dayanımı' : 'Rp0.2 — Yield strength'
  const line2 = lang === 'tr' ? 'Malzeme özelliği (MPa)' : 'Material property (MPa)'
  const line3 = lang === 'tr' ? 'Geometrik boyut değil' : 'Not a geometry dimension'
  return (
    <g>
      {/* Bolt head highlight — material context */}
      <rect x="120" y="34" width="42" height="20" rx="2.5"
        fill={ACT_FILL} stroke={ACT_STROKE} strokeWidth="1.4" />

      {/* Leader */}
      <line x1="162" y1="44" x2="188" y2="44" stroke={ACT_STROKE} strokeWidth="0.9" />
      <line x1="188" y1="44" x2="188" y2="58" stroke={ACT_STROKE} strokeWidth="0.9" />

      {/* Annotation box */}
      <rect x="159" y="58" width="96" height="50" rx="3"
        fill={EV.canvasBackground} stroke={ACT_STROKE} strokeWidth="0.9" opacity="0.97" />
      <text x="207" y="73" fill={DIM_COLOR} fontSize="10.5" fontWeight="700"
        textAnchor="middle" fontStyle="italic">Rp0.2</text>
      <text x="207" y="87" fill={NOTE_COLOR} fontSize="7.5" textAnchor="middle">{line1}</text>
      <text x="207" y="98" fill={NOTE_COLOR} fontSize="7.5" textAnchor="middle">{line2}</text>
      <text x="207" y="109" fill={EV.schematicNote} fontSize="7" textAnchor="middle"
        fontStyle="italic">{line3}</text>
    </g>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TorqueContextDiagram({ focus, result, lang = 'tr', className }: Props) {
  const noResult = result === null
  const showResultArrows = noResult === false && focus === 'neutral'

  const neutralMsg = lang === 'tr' ? 'Bir parametre seçin' : 'Select a parameter'
  const noCalcMsg  = lang === 'tr' ? 'Hesap yapılmadı' : 'No calculation yet'

  return (
    <svg
      viewBox="0 0 300 295"
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'w-full max-h-[260px]'}
      role="img"
      aria-label={
        focus === 'neutral'
          ? (lang === 'tr' ? 'Cıvata bağlantı düzeneği diyagramı' : 'Bolted joint assembly diagram')
          : (lang === 'tr' ? `Aktif parametre: ${focus}` : `Active parameter: ${focus}`)
      }
    >
      <title>
        {focus === 'neutral'
          ? (lang === 'tr' ? 'Bağlantı diyagramı' : 'Joint diagram')
          : `${focus} — ${lang === 'tr' ? 'parametre görseli' : 'parameter visual'}`}
      </title>
      <desc>
        {lang === 'tr'
          ? 'Cıvata bağlantı geometrisi teknik çizimi. Seçilen parametreye göre ilgili boyut veya yüzey vurgulanır.'
          : 'Technical drawing of bolted joint geometry. Highlights the relevant dimension or surface for the selected parameter.'}
      </desc>

      <Markers />

      {/* Canvas background */}
      <rect x="0" y="0" width="300" height="295"
        fill={EV.canvasBackground} rx="4" />

      {/* Base assembly (always visible) */}
      <BaseAssembly />

      {/* Per-focus overlays */}
      {focus === 'diameter_d'          && <OverlayDiameter lang={lang} />}
      {focus === 'pitch_p'             && <OverlayPitch lang={lang} />}
      {focus === 'stress_area_as'      && <OverlayStressArea lang={lang} />}
      {focus === 'bearing_diameter_dw' && <OverlayBearingDiameter lang={lang} />}
      {focus === 'thread_friction'     && <OverlayThreadFriction lang={lang} />}
      {focus === 'bearing_friction'    && <OverlayBearingFriction lang={lang} />}
      {focus === 'yield_utilization'   && <OverlayYieldUtilization lang={lang} />}
      {focus === 'rp02'                && <OverlayRp02 lang={lang} />}

      {/* Result force arrows (neutral + has result → HARD RULE 17) */}
      {showResultArrows && <ResultArrows result={result!} />}

      {/* Neutral / idle state messages */}
      {focus === 'neutral' && noResult && (
        <text x="150" y="258" fill={NOTE_COLOR} fontSize="10.5" textAnchor="middle">
          {neutralMsg}
        </text>
      )}
      {focus === 'neutral' && noResult && (
        <text x="150" y="273" fill={EV.schematicNote} fontSize="9" textAnchor="middle">
          {noCalcMsg}
        </text>
      )}
    </svg>
  )
}
