/**
 * TorqPro Engineering — Advanced Connection Context Diagrams
 * VDI-CONTEXT-PANEL-UX-02
 *
 * Six schematic visuals for Advanced Analysis parameter context.
 * Scale mode: SCHEMATIC — geometry is illustrative, not to scale.
 * No engineering values are fabricated or invented.
 */

import { useLanguage } from '../../i18n/LanguageContext'
import { EV } from '../engineering-visuals/engineeringVisualTokens'

export type AdvancedContextKey =
  | 'plateThickness'
  | 'boltLength'
  | 'loadFactor'
  | 'operatingLoad'
  | 'deltaT'
  | 'plateMaterial'
  | null

interface Props {
  contextKey: AdvancedContextKey
  selectedMaterial?: string
}

const CTX_KEY_MAP: Record<Exclude<AdvancedContextKey, null>, string> = {
  plateThickness:  'plate_thickness',
  boltLength:      'bolt_length',
  loadFactor:      'load_factor',
  operatingLoad:   'operating_load',
  deltaT:          'delta_t',
  plateMaterial:   'plate_material',
}

// ── Arrowhead primitive ───────────────────────────────────────────────────────
function Tip({
  x, y, dir, color = EV.inputText,
}: {
  x: number; y: number
  dir: 'up' | 'down' | 'left' | 'right'
  color?: string
}) {
  const s = 5; const h = 8
  let pts = ''
  if (dir === 'up')    pts = `${x},${y} ${x - s},${y + h} ${x + s},${y + h}`
  if (dir === 'down')  pts = `${x},${y} ${x - s},${y - h} ${x + s},${y - h}`
  if (dir === 'left')  pts = `${x},${y} ${x + h},${y - s} ${x + h},${y + s}`
  if (dir === 'right') pts = `${x},${y} ${x - h},${y - s} ${x - h},${y + s}`
  return <polygon points={pts} fill={color} stroke="none" />
}

// ── A: Plate Thickness ────────────────────────────────────────────────────────
// Bolted-joint cross section. t_plate highlighted. Dimension arrow perpendicular.
function PlateThicknessDiagram() {
  return (
    <svg viewBox="0 0 220 88" className="w-full" aria-hidden="true">
      <rect width="220" height="88" rx="3" fill={EV.canvasBackground} />
      {/* Centreline */}
      <line x1="110" y1="0" x2="110" y2="88"
        stroke={EV.centerline} strokeWidth="0.8" strokeDasharray="4,3" />
      {/* Bolt head */}
      <rect x="92" y="5" width="36" height="19" rx="1"
        fill={EV.fastenerFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      {/* Bolt shank (drawn behind plate, then re-layered) */}
      <rect x="103" y="5" width="14" height="83"
        fill={EV.shankFill} stroke={EV.geometrySecondary} strokeWidth="0.8" />
      {/* Plate — highlighted */}
      <rect x="40" y="24" width="140" height="36"
        fill={EV.clampedUpperFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      <rect x="40" y="24" width="140" height="36" fill={EV.contextImportant} />
      {/* Clearance hole */}
      <rect x="103" y="24" width="14" height="36"
        fill={EV.holeVoidFill} stroke={EV.holeStroke} strokeWidth="0.8" />
      {/* Dimension arrow — right side, showing t */}
      <line x1="191" y1="24" x2="191" y2="60"
        stroke={EV.inputStroke} strokeWidth="1.5" />
      <line x1="184" y1="24" x2="198" y2="24"
        stroke={EV.inputStroke} strokeWidth="1" />
      <line x1="184" y1="60" x2="198" y2="60"
        stroke={EV.inputStroke} strokeWidth="1" />
      <Tip x={191} y={24} dir="up" />
      <Tip x={191} y={60} dir="down" />
      <text x="212" y="43" fill={EV.inputText}
        fontSize="15" fontWeight="700" textAnchor="middle" dominantBaseline="middle">t</text>
    </svg>
  )
}

// ── B: Bolt Length ────────────────────────────────────────────────────────────
// Axial bolt geometry. L highlighted from under-head to tip.
// Current model uses L in bolt compliance. No threaded/shank/engagement sub-lengths.
function BoltLengthDiagram() {
  // Head: y=5..23, body (L): y=23..75, tip: y=75..83
  return (
    <svg viewBox="0 0 220 88" className="w-full" aria-hidden="true">
      <rect width="220" height="88" rx="3" fill={EV.canvasBackground} />
      {/* Centreline */}
      <line x1="110" y1="0" x2="110" y2="88"
        stroke={EV.centerline} strokeWidth="0.8" strokeDasharray="4,3" />
      {/* Bolt head */}
      <rect x="90" y="5" width="40" height="18" rx="1"
        fill={EV.fastenerFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      {/* Under-head shoulder lines */}
      <line x1="90" y1="23" x2="103" y2="23" stroke={EV.geometryPrimary} strokeWidth="1" />
      <line x1="117" y1="23" x2="130" y2="23" stroke={EV.geometryPrimary} strokeWidth="1" />
      {/* Bolt body (L) — highlighted */}
      <rect x="103" y="23" width="14" height="52"
        fill={EV.shankFill} stroke={EV.geometrySecondary} strokeWidth="1" />
      <rect x="103" y="23" width="14" height="52" fill={EV.contextImportant} />
      {/* Thread schematic at lower zone */}
      <line x1="103" y1="60" x2="117" y2="60" stroke={EV.geometrySecondary} strokeWidth="0.7" />
      <line x1="103" y1="65" x2="117" y2="65" stroke={EV.geometrySecondary} strokeWidth="0.7" />
      <line x1="103" y1="70" x2="117" y2="70" stroke={EV.geometrySecondary} strokeWidth="0.7" />
      {/* Bolt tip */}
      <line x1="103" y1="75" x2="110" y2="83" stroke={EV.geometrySecondary} strokeWidth="1" />
      <line x1="117" y1="75" x2="110" y2="83" stroke={EV.geometrySecondary} strokeWidth="1" />
      {/* Dimension: L (left side) */}
      <line x1="87" y1="23" x2="87" y2="75"
        stroke={EV.inputStroke} strokeWidth="1.5" />
      <line x1="80" y1="23" x2="94" y2="23"
        stroke={EV.inputStroke} strokeWidth="1" />
      <line x1="80" y1="75" x2="94" y2="75"
        stroke={EV.inputStroke} strokeWidth="1" />
      <Tip x={87} y={23} dir="up" />
      <Tip x={87} y={75} dir="down" />
      <text x="68" y="50" fill={EV.inputText}
        fontSize="15" fontWeight="700" textAnchor="middle" dominantBaseline="middle">L</text>
    </svg>
  )
}

// ── C: Load Factor ────────────────────────────────────────────────────────────
// Schematic showing load-entry arrows. n is load introduction factor — NOT
// number of fasteners, NOT Φ, NOT a geometric dimension.
function LoadFactorDiagram() {
  // Upper plate y=15..43, lower y=47..75, interface at ~y=45
  return (
    <svg viewBox="0 0 220 88" className="w-full" aria-hidden="true">
      <rect width="220" height="88" rx="3" fill={EV.canvasBackground} />
      {/* Centreline */}
      <line x1="110" y1="0" x2="110" y2="88"
        stroke={EV.centerline} strokeWidth="0.8" strokeDasharray="4,3" />
      {/* Upper plate */}
      <rect x="50" y="14" width="120" height="29"
        fill={EV.clampedUpperFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      {/* Lower plate */}
      <rect x="50" y="47" width="120" height="28"
        fill={EV.clampedLowerFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      {/* Bolt shank (full height) */}
      <rect x="104" y="0" width="12" height="88"
        fill={EV.shankFill} stroke={EV.geometrySecondary} strokeWidth="0.8" />
      {/* Bolt head (top) */}
      <rect x="96" y="0" width="28" height="14" rx="1"
        fill={EV.fastenerFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      {/* Clearance holes */}
      <rect x="104" y="14" width="12" height="61"
        fill={EV.holeVoidFill} stroke={EV.holeStroke} strokeWidth="0.7" />
      {/* Interface line */}
      <line x1="50" y1="43" x2="170" y2="43"
        stroke={EV.guidance} strokeWidth="1" strokeDasharray="5,3" />
      {/* Load-entry arrow from left at ~y=26 (inside upper plate zone) */}
      <line x1="10" y1="26" x2="49" y2="26"
        stroke={EV.inputStroke} strokeWidth="2" />
      <Tip x={49} y={26} dir="right" />
      {/* n label */}
      <text x="6" y="19" fill={EV.inputText}
        fontSize="12" fontWeight="700" textAnchor="middle">n</text>
      {/* Bracket showing n-fraction: from load entry y=26 to interface y=43 */}
      <line x1="173" y1="26" x2="173" y2="43"
        stroke={EV.inputStroke} strokeWidth="1" strokeDasharray="2,2" />
      <line x1="169" y1="26" x2="177" y2="26"
        stroke={EV.inputStroke} strokeWidth="1" />
      <line x1="169" y1="43" x2="177" y2="43"
        stroke={EV.inputStroke} strokeWidth="1" />
    </svg>
  )
}

// ── D: Operating Load ─────────────────────────────────────────────────────────
// External axial force arrows (FA) acting on joint. No preload or ΔFb fabricated.
function OperatingLoadDiagram() {
  return (
    <svg viewBox="0 0 220 88" className="w-full" aria-hidden="true">
      <rect width="220" height="88" rx="3" fill={EV.canvasBackground} />
      {/* Centreline */}
      <line x1="110" y1="0" x2="110" y2="88"
        stroke={EV.centerline} strokeWidth="0.8" strokeDasharray="4,3" />
      {/* Upper plate */}
      <rect x="60" y="26" width="100" height="18"
        fill={EV.clampedUpperFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      {/* Lower plate */}
      <rect x="60" y="48" width="100" height="18"
        fill={EV.clampedLowerFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      {/* Bolt shank */}
      <rect x="104" y="0" width="12" height="88"
        fill={EV.shankFill} stroke={EV.geometrySecondary} strokeWidth="0.8" />
      {/* Clearance holes */}
      <rect x="104" y="26" width="12" height="40"
        fill={EV.holeVoidFill} stroke={EV.holeStroke} strokeWidth="0.7" />
      {/* FA arrows — axial tension separating the joint */}
      {/* Upper: pulling upper plate upward */}
      <line x1="110" y1="26" x2="110" y2="8"
        stroke={EV.inputStroke} strokeWidth="2" />
      <Tip x={110} y={8} dir="up" />
      {/* Lower: pulling lower plate downward */}
      <line x1="110" y1="66" x2="110" y2="82"
        stroke={EV.inputStroke} strokeWidth="2" />
      <Tip x={110} y={82} dir="down" />
      {/* Labels */}
      <text x="128" y="16" fill={EV.inputText}
        fontSize="11" fontWeight="700">FA</text>
      <text x="128" y="82" fill={EV.inputText}
        fontSize="11" fontWeight="700">FA</text>
    </svg>
  )
}

// ── E: Delta T ────────────────────────────────────────────────────────────────
// Symbolic thermal expansion arrows. ΔT is NOT in the current simplified result.
function DeltaTDiagram() {
  const warnColor = EV.warn
  return (
    <svg viewBox="0 0 220 88" className="w-full" aria-hidden="true">
      <rect width="220" height="88" rx="3" fill={EV.canvasBackground} />
      {/* Centreline */}
      <line x1="110" y1="0" x2="110" y2="88"
        stroke={EV.centerline} strokeWidth="0.8" strokeDasharray="4,3" />
      {/* Plate */}
      <rect x="46" y="28" width="128" height="32"
        fill={EV.clampedUpperFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      {/* Bolt shank */}
      <rect x="104" y="12" width="12" height="64"
        fill={EV.shankFill} stroke={EV.geometrySecondary} strokeWidth="0.8" />
      {/* Clearance hole */}
      <rect x="104" y="28" width="12" height="32"
        fill={EV.holeVoidFill} stroke={EV.holeStroke} strokeWidth="0.7" />
      {/* Thermal expansion arrows (dashed) */}
      {/* Upward (bolt/plate expanding) */}
      <line x1="110" y1="12" x2="110" y2="4"
        stroke={warnColor} strokeWidth="1.5" strokeDasharray="2,1" />
      <Tip x={110} y={4} dir="up" color={warnColor} />
      {/* Downward */}
      <line x1="110" y1="76" x2="110" y2="84"
        stroke={warnColor} strokeWidth="1.5" strokeDasharray="2,1" />
      <Tip x={110} y={84} dir="down" color={warnColor} />
      {/* Leftward */}
      <line x1="46" y1="44" x2="28" y2="44"
        stroke={warnColor} strokeWidth="1.5" strokeDasharray="2,1" />
      <Tip x={28} y={44} dir="left" color={warnColor} />
      {/* Rightward */}
      <line x1="174" y1="44" x2="192" y2="44"
        stroke={warnColor} strokeWidth="1.5" strokeDasharray="2,1" />
      <Tip x={192} y={44} dir="right" color={warnColor} />
      {/* ΔT label */}
      <text x="110" y="44" fill={warnColor}
        fontSize="13" fontWeight="700" textAnchor="middle" dominantBaseline="middle">ΔT</text>
    </svg>
  )
}

// ── F: Plate Material ─────────────────────────────────────────────────────────
// Material/stiffness context. Steel: E=210 GPa. Aluminium: E=70 GPa.
// Cast iron: no modulus invented — simplified model follows non-Aluminium branch.
function PlateMaterialDiagram({ material }: { material: string }) {
  const isAluminium = material.includes('Alüm') || material.toLowerCase().includes('alum')
  const isCastIron  = material.includes('Dökme') || material.toLowerCase().includes('cast')
  const isSteel     = !isAluminium && !isCastIron

  const plateFill = isAluminium ? '#DCF0DC' : isCastIron ? '#E0E0DC' : EV.clampedUpperFill
  const eLabel    = isSteel ? 'E = 210 GPa' : isAluminium ? 'E = 70 GPa' : ''
  const epLabel   = isSteel ? 'Ep = 210 000 MPa' : isAluminium ? 'Ep = 70 000 MPa' : ''

  return (
    <svg viewBox="0 0 220 88" className="w-full" aria-hidden="true">
      <rect width="220" height="88" rx="3" fill={EV.canvasBackground} />
      {/* Material plate cross-section */}
      <rect x="20" y="18" width="180" height="52" rx="2"
        fill={plateFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      <rect x="20" y="18" width="180" height="52" rx="2" fill={EV.contextImportant} />
      {/* E value */}
      {eLabel && (
        <text x="110" y="38" fill={EV.inputText}
          fontSize="14" fontWeight="700" textAnchor="middle" dominantBaseline="middle">
          {eLabel}
        </text>
      )}
      {/* Ep label */}
      {epLabel && (
        <text x="110" y="56" fill={EV.schematicNote}
          fontSize="9" textAnchor="middle" dominantBaseline="middle">
          {epLabel}
        </text>
      )}
      {/* Cast iron note (no invented modulus) */}
      {isCastIron && (
        <text x="110" y="44" fill={EV.guidance}
          fontSize="11" textAnchor="middle" dominantBaseline="middle">
          non-Al branch
        </text>
      )}
    </svg>
  )
}

// ── Default (null context) ────────────────────────────────────────────────────
function NeutralDiagram() {
  return (
    <svg viewBox="0 0 220 88" className="w-full" aria-hidden="true">
      <rect width="220" height="88" rx="3" fill={EV.canvasBackground} />
      <line x1="110" y1="0" x2="110" y2="88"
        stroke={EV.centerline} strokeWidth="0.8" strokeDasharray="4,3" />
      {/* Bolt head */}
      <rect x="92" y="5" width="36" height="18" rx="1"
        fill={EV.fastenerFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      {/* Bolt shank */}
      <rect x="103" y="5" width="14" height="78"
        fill={EV.shankFill} stroke={EV.geometrySecondary} strokeWidth="0.8" />
      {/* Upper plate */}
      <rect x="38" y="23" width="144" height="28"
        fill={EV.clampedUpperFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      {/* Lower plate */}
      <rect x="38" y="55" width="144" height="27"
        fill={EV.clampedLowerFill} stroke={EV.geometryPrimary} strokeWidth="1.5" />
      {/* Clearance holes */}
      <rect x="103" y="23" width="14" height="59"
        fill={EV.holeVoidFill} stroke={EV.holeStroke} strokeWidth="0.7" />
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdvancedConnectionContextDiagram({
  contextKey,
  selectedMaterial = '',
}: Props) {
  const { t } = useLanguage()

  const tkey = contextKey ? CTX_KEY_MAP[contextKey] : null

  const title = tkey
    ? t(`adv.ctx.${tkey}.title`)
    : t('adv.ctx.none.title')

  let desc: string
  if (contextKey === 'plateMaterial') {
    const isAluminium = selectedMaterial.includes('Alüm') || selectedMaterial.toLowerCase().includes('alum')
    const isCastIron  = selectedMaterial.includes('Dökme') || selectedMaterial.toLowerCase().includes('cast')
    if (isAluminium)  desc = t('adv.ctx.plate_material.desc.aluminium')
    else if (isCastIron) desc = t('adv.ctx.plate_material.desc.cast_iron')
    else               desc = t('adv.ctx.plate_material.desc.steel')
  } else if (tkey) {
    desc = t(`adv.ctx.${tkey}.desc`)
  } else {
    desc = t('adv.ctx.none.desc')
  }

  const diagram = (() => {
    switch (contextKey) {
      case 'plateThickness':  return <PlateThicknessDiagram />
      case 'boltLength':      return <BoltLengthDiagram />
      case 'loadFactor':      return <LoadFactorDiagram />
      case 'operatingLoad':   return <OperatingLoadDiagram />
      case 'deltaT':          return <DeltaTDiagram />
      case 'plateMaterial':   return <PlateMaterialDiagram material={selectedMaterial} />
      default:                return <NeutralDiagram />
    }
  })()

  return (
    <div className="bg-tp-module border border-tp-border-2 rounded-md overflow-hidden">
      <div className="px-3 py-2.5 border-b border-tp-border/60 flex items-center gap-1.5">
        <span className="text-[12px] font-semibold text-tp-text-2 tracking-wide">
          {title}
        </span>
      </div>
      <div className="p-3">
        {diagram}
      </div>
      {desc && (
        <div className="px-3 pb-3 text-[11px] text-tp-text-3 leading-relaxed">
          {desc}
        </div>
      )}
    </div>
  )
}
