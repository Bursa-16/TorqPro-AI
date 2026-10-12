/**
 * TorqPro Engineering Visual System — SCENE_01: FASTENER_ASSEMBLY_SECTION
 *
 * VISUAL-03B.3 implementation.
 * Authority: VISUAL-03B.2-R1 corrected contract, VISUAL-03B.1 drawing standard,
 *            VISUAL-03B.0-R1 hard engineering rules.
 *
 * Scale mode: SCHEMATIC — geometry is not scaled from engineering values.
 * All numeric values are annotation only. No scale bar.
 *
 * States: S01-DIAMETER | S01-BEARING-DIAMETER | S01-ENGAGEMENT |
 *         S01-GRIP | S01-BEARING-PRESSURE | S01-THREAD-SAFETY
 */

import React, { useEffect, useState } from 'react'
import type { Scene01Props, Scene01State, SceneStatus } from './sceneTypes'
import { EV } from './engineeringVisualTokens'

// ── Schematic geometry constants ─────────────────────────────────────────────
// SCALE_MODE = SCHEMATIC: these are drawing units, not engineering millimetres.

const CX = 240 // bolt centreline x

// Bolt head (section: rectangular block)
const HEAD = { x1: 200, x2: 280, top: 24, bot: 86 } as const
// Washer — head side
const WH = { x1: 186, x2: 294, top: 86, bot: 100 } as const
// Clamped plates (left/right extent)
const PX1 = 60; const PX2 = 420
// Clamped part — upper
const PU = { top: 100, bot: 220 } as const
// Joint parting plane
const PART_Y = 220
// Clamped part — lower
const PL = { top: 220, bot: 340 } as const
// Washer — nut side
const WN = { x1: 186, x2: 294, top: 340, bot: 354 } as const
// Nut body (hex-nut section: rectangular block)
const NUT = { x1: 204, x2: 276, top: 354, bot: 434 } as const
// Bolt shank (unthreaded + threaded)
const SH = { x1: 224, x2: 256, top: 86, bot: 434 } as const
// Clearance hole in plates (slightly larger than shank)
const HOLE = { x1: 220, x2: 260 } as const
// External thread starts (shank transitions from smooth to threaded)
const THEXT_Y = 318
// Thread engagement zone (inside nut)
const ENG = { top: 354, bot: 424 } as const
// Bearing contact zone — head side (washer/plate interface)
const BCH_Y = WH.bot   // 100
// Bearing contact zone — nut side (plate/washer interface)
const BCN_Y = WN.top   // 340
// Thread pitch (schematic)
const TPitch = 10
// Thread groove depth (schematic)
const TDepth = 6
// D_Km schematic span: mean of clearance-hole radius and washer OD radius
// r_inner = HOLE.x2 - CX = 20; r_outer = WH.x2 - CX = 54; r_mean = 37
const DKM = { x1: CX - 37, x2: CX + 37, y: 93 } as const
// Result panel area (bottom of SVG)
const RP_Y = 448
// Schematic note area
const NOTE_Y = 516

// ── Colour palette — VISUAL-03C.1B-R1: light engineering canvas ──────────────
// All structural fills and outlines now reference the shared EV token system.
// The SVG contains an explicit light background rect (id="engineering-canvas-background").
const C = {
  // Geometry fills — light technical drawing palette
  plateFill:    EV.clampedUpperFill,   // #EDF1F5
  plateStroke:  EV.geometryPrimary,    // #263445
  headFill:     EV.fastenerFill,       // #E4EAF1
  headStroke:   EV.geometryPrimary,    // #263445
  shankFill:    EV.shankFill,          // #E8EDF4
  shankStroke:  EV.geometryPrimary,    // #263445
  nutFill:      EV.fastenerFill,       // #E4EAF1
  nutStroke:    EV.geometryPrimary,    // #263445
  washerFill:   EV.washerFill,         // #DDE4EB
  washerStroke: EV.geometrySecondary,  // #59697A
  holeFill:     EV.holeVoidFill,       // #F0F4F8 — light negative space, NOT dark
  holeStroke:   EV.holeStroke,         // #B8C4D0
  // Centreline
  clLine:       EV.centerline,         // #8291A3 — dashed axis
  // Thread
  threadExt:    EV.geometrySecondary,  // #59697A
  threadInt:    EV.sectionHatch,       // #AAB5C2
  // Engagement zone — preserved cyan/blue accent on light canvas
  engFill:      EV.neutralFill,
  engStroke:    EV.inputStroke,        // #007F9E
  // Bearing zones — neutral
  bzFill:       EV.neutralFill,
  bzStroke:     EV.geometrySecondary,  // #59697A
  // Bearing zones — PASS
  bzPassFill:   EV.validFill,
  bzPassStroke: EV.valid,              // #16835D
  // Bearing zones — FAIL
  bzFailFill:   EV.failFill,
  bzFailStroke: EV.fail,              // #C83C3C
  // Parting plane
  partLine:     EV.inputStroke,        // #007F9E
  // Provenance — unchanged, semantically meaningful
  userInput:    EV.inputStroke,        // #007F9E — USER_INPUT
  computed:     EV.computedResult,     // #1769AA — COMPUTED_RESULT / FRONTEND_COMPUTED
  visualCtx:    EV.guidance,           // #667585 — VISUAL_CONTEXT_ONLY
  // Status
  pass:         EV.valid,              // #16835D
  fail:         EV.fail,              // #C83C3C
  neutral:      EV.neutral,           // #59697A
  // Text — on light canvas: dark text hierarchy
  textPrimary:  EV.geometryPrimary,   // #263445
  textSecondary: EV.geometrySecondary, // #59697A
  textMuted:    EV.guidance,           // #667585
  // Dimension subdued
  dimSubdued:   EV.sectionHatch,      // #AAB5C2
  // Hatch
  hatch:        EV.sectionHatch,      // #AAB5C2
} as const

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** Build a zigzag path for thread indication along a shank/bore edge. */
function threadZigzag(
  edgeX: number,
  dir: 1 | -1,   // +1 = grooves go right, -1 = grooves go left
  yTop: number,
  yBot: number,
): string {
  const grooveX = edgeX + dir * TDepth
  let d = `M ${edgeX},${yTop}`
  for (let y = yTop; y + TPitch <= yBot; y += TPitch) {
    const mid = y + TPitch / 2
    d += ` L ${grooveX},${mid} L ${edgeX},${y + TPitch}`
  }
  return d
}

/** External thread path: zigzag on both sides of shank from THEXT_Y to SH.bot */
function extThreadPath(): string {
  const left  = threadZigzag(SH.x1, -1, THEXT_Y, SH.bot)
  const right = threadZigzag(SH.x2, +1, THEXT_Y, SH.bot)
  return `${left} ${right}`
}

/** Internal thread path: zigzag inside nut bore walls from NUT.top to NUT.bot */
function intThreadPath(): string {
  const left  = threadZigzag(SH.x1, -1, NUT.top, NUT.bot)
  const right = threadZigzag(SH.x2, +1, NUT.top, NUT.bot)
  return `${left} ${right}`
}

/** Build chevron hatch lines for a rectangular region, clipped by caller. */
function hatchLines(x1: number, y1: number, x2: number, y2: number, gap = 8): React.ReactElement[] {
  const lines: React.ReactElement[] = []
  const w = x2 - x1; const h = y2 - y1; const diag = w + h
  for (let i = 0; i * gap <= diag + gap; i++) {
    const offset = i * gap
    const lx1 = x1 + offset; const ly1 = y1
    const lx2 = x1;           const ly2 = y1 + offset
    lines.push(
      <line key={i}
            x1={Math.min(lx1, x2)} y1={Math.max(ly1, y1)}
            x2={Math.max(lx2, x1)} y2={Math.min(ly2, y2)}
            stroke={C.hatch} strokeWidth="0.7" />,
    )
  }
  return lines
}

// ── Opacity maps ──────────────────────────────────────────────────────────────

interface OpacitySet {
  head: number; shank: number; washerH: number; washerN: number
  plateU: number; plateL: number; parting: number
  nut: number; threadExt: number; threadInt: number
  engZone: number; bzH: number; bzN: number
  dimD: number; dimDKm: number; dimEng: number; dimGrip: number
  panels: number
}

function computeOpacity(state: Scene01State): OpacitySet {
  const isD  = state === 'S01-DIAMETER'
  const isBD = state === 'S01-BEARING-DIAMETER'
  const isE  = state === 'S01-ENGAGEMENT'
  const isG  = state === 'S01-GRIP'
  const isBP = state === 'S01-BEARING-PRESSURE'
  const isSF = state === 'S01-THREAD-SAFETY'

  return {
    head:      isD ? 1.0 : isBD || isBP ? 0.70 : isG ? 0.40 : 0.22,
    shank:     isD ? 1.0 : isBD || isBP || isG ? 0.65 : isE || isSF ? 0.55 : 0.22,
    washerH:   isD || isBD || isBP ? 0.85 : isG ? 0.65 : 0.22,
    washerN:   isBD || isBP ? 0.85 : isG || isE || isSF ? 0.65 : 0.22,
    plateU:    isBD || isBP ? 0.65 : isG ? 1.0 : isD ? 0.40 : 0.25,
    plateL:    isBD || isBP ? 0.65 : isG ? 1.0 : isE || isSF ? 0.50 : isD ? 0.25 : 0.30,
    parting:   isG ? 1.0 : isD || isBD || isBP ? 0.35 : 0.22,
    nut:       isE || isSF ? 0.90 : isBD || isBP ? 0.55 : isG ? 0.35 : 0.22,
    threadExt: isE || isSF ? 0.95 : isD ? 0.30 : 0.38,
    threadInt: isE || isSF ? 0.90 : 0.28,
    engZone:   isE || isSF ? 1.0 : 0.15,
    bzH:       isBD || isBP ? 1.0 : isD ? 0.28 : 0.15,
    bzN:       isBD || isBP ? 1.0 : isG ? 0.30 : 0.15,
    dimD:      isD ? 1.0 : 0.0,
    dimDKm:    isBD ? 1.0 : 0.0,
    dimEng:    isE ? 1.0 : 0.0,
    dimGrip:   isG ? 0.80 : 0.0,
    panels:    isBP || isSF ? 1.0 : 0.0,
  }
}

// ── Status colour helpers ─────────────────────────────────────────────────────

function statusColor(s?: SceneStatus): string {
  if (s === 'pass') return C.pass
  if (s === 'fail') return C.fail
  return C.neutral
}

function bzFillColor(s?: SceneStatus): string {
  if (s === 'pass') return C.bzPassFill
  if (s === 'fail') return C.bzFailFill
  return C.bzFill
}

function bzStrokeColor(s?: SceneStatus): string {
  if (s === 'pass') return C.bzPassStroke
  if (s === 'fail') return C.bzFailStroke
  return C.bzStroke
}

function sfStatusColor(sfVal?: number): string {
  if (sfVal === undefined) return C.neutral
  return sfVal >= 1.0 ? C.pass : C.fail
}

// ── Arrowhead markers ─────────────────────────────────────────────────────────

function Markers() {
  return (
    <defs>
      {/* Hatch pattern for plates */}
      <pattern id="s01-hatch" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
        <line x1="0" y1="8" x2="8" y2="0" stroke={C.hatch} strokeWidth="0.75" />
      </pattern>
      {/* Clip path: plate regions excluding clearance hole */}
      <clipPath id="s01-plate-clip">
        <rect x={PX1}      y={PU.top} width={HOLE.x1 - PX1}   height={PL.bot - PU.top} />
        <rect x={HOLE.x2}  y={PU.top} width={PX2 - HOLE.x2}   height={PL.bot - PU.top} />
      </clipPath>
      {/* Dimension arrowhead — cyan (USER_INPUT) */}
      <marker id="s01-arr-cyan" markerWidth="7" markerHeight="5"
              refX="6" refY="2.5" orient="auto">
        <polygon points="0 0,7 2.5,0 5" fill={C.userInput} />
      </marker>
      {/* Dimension arrowhead — cyan reverse */}
      <marker id="s01-arr-cyan-r" markerWidth="7" markerHeight="5"
              refX="1" refY="2.5" orient="auto">
        <polygon points="7 0,0 2.5,7 5" fill={C.userInput} />
      </marker>
      {/* Dimension arrowhead — muted (VISUAL_CONTEXT_ONLY) */}
      <marker id="s01-arr-muted" markerWidth="7" markerHeight="5"
              refX="6" refY="2.5" orient="auto">
        <polygon points="0 0,7 2.5,0 5" fill={C.visualCtx} />
      </marker>
      <marker id="s01-arr-muted-r" markerWidth="7" markerHeight="5"
              refX="1" refY="2.5" orient="auto">
        <polygon points="7 0,0 2.5,7 5" fill={C.visualCtx} />
      </marker>
    </defs>
  )
}

// ── Dimension annotation components ──────────────────────────────────────────

interface DimLineHProps {
  id: string; x1: number; x2: number; y: number; yExt?: number
  label: string; value?: string; color: string; markerStart: string; markerEnd: string
  opacity: number; fontSize?: number
}
function DimLineH({ id, x1, x2, y, yExt, label, value, color, markerStart, markerEnd, opacity, fontSize = 10 }: DimLineHProps) {
  const yL = (yExt ?? y) - 6
  const midX = (x1 + x2) / 2
  return (
    <g id={id} className="scene-transition" style={{ opacity }}>
      {/* Extension lines */}
      {yExt !== undefined && (
        <>
          <line x1={x1} y1={yExt} x2={x1} y2={y + 2} stroke={color} strokeWidth="0.8" strokeDasharray="none" />
          <line x1={x2} y1={yExt} x2={x2} y2={y + 2} stroke={color} strokeWidth="0.8" />
        </>
      )}
      {/* Dimension line */}
      <line x1={x1} y1={y} x2={x2} y2={y}
            stroke={color} strokeWidth="1.0"
            markerStart={`url(#${markerStart})`}
            markerEnd={`url(#${markerEnd})`} />
      {/* Label */}
      <text x={midX} y={yL} textAnchor="middle" fontSize={fontSize}
            fill={color} fontFamily="JetBrains Mono,monospace" fontWeight="600">
        {label}{value ? ` = ${value}` : ''}
      </text>
    </g>
  )
}

interface DimLineVProps {
  id: string; x: number; y1: number; y2: number; xExt?: number
  label: string; value?: string; color: string; markerStart: string; markerEnd: string
  opacity: number; labelSide?: 'left' | 'right'; fontSize?: number
}
function DimLineV({ id, x, y1, y2, xExt, label, value, color, markerStart, markerEnd, opacity, labelSide = 'right', fontSize = 10 }: DimLineVProps) {
  const xLine = xExt ?? x
  const midY = (y1 + y2) / 2
  const textX = labelSide === 'right' ? xLine + 7 : xLine - 7
  const textAnchor = labelSide === 'right' ? 'start' : 'end'
  return (
    <g id={id} className="scene-transition" style={{ opacity }}>
      {/* Extension lines */}
      {xExt !== undefined && (
        <>
          <line x1={x} y1={y1} x2={xLine - 2} y2={y1} stroke={color} strokeWidth="0.8" />
          <line x1={x} y1={y2} x2={xLine - 2} y2={y2} stroke={color} strokeWidth="0.8" />
        </>
      )}
      {/* Dimension line */}
      <line x1={xLine} y1={y1} x2={xLine} y2={y2}
            stroke={color} strokeWidth="1.0"
            markerStart={`url(#${markerStart})`}
            markerEnd={`url(#${markerEnd})`} />
      {/* Label */}
      <text x={textX} y={midY + 4} textAnchor={textAnchor} fontSize={fontSize}
            fill={color} fontFamily="JetBrains Mono,monospace" fontWeight="600">
        {label}{value ? ` = ${value}` : ''}
      </text>
    </g>
  )
}

// ── Label helpers ─────────────────────────────────────────────────────────────

const LABELS = {
  tr: {
    states: {
      'S01-DIAMETER':         'Cıvata Çapı (d)',
      'S01-BEARING-DIAMETER': 'Etkin Yatak Çapı (Dₖₘ)',
      'S01-ENGAGEMENT':       'Diş Kavrama Uzunluğu (Lₑ)',
      'S01-GRIP':             'Kavrama Uzunluğu — Şematik',
      'S01-BEARING-PRESSURE': 'Yatak Basıncı (pᴅ)',
      'S01-THREAD-SAFETY':    'Diş Emniyet Katsayısı',
    } as Record<Scene01State, string>,
    desc: {
      'S01-DIAMETER':         'd — nominal cıvata çapı, kullanıcı girişi',
      'S01-BEARING-DIAMETER': 'Dₖₘ = 2 × rₚₒₜ — etkin yatak çapı, kullanıcı girişi, tam yatay çap',
      'S01-ENGAGEMENT':       'Lₑ — eksenel diş kavrama bölgesi, kullanıcı girişi, yalnızca MühendislikKontrol',
      'S01-GRIP':             'L₂ — sıkıştırılan yığın kalınlığı, yalnızca görsel bağlam',
      'S01-BEARING-PRESSURE': 'pᴅ — ön yüzde hesaplanan yatak basıncı, şematik temas bölgesi',
      'S01-THREAD-SAFETY':    'İç ve dış diş emniyet katsayıları, hesaplama sonucu',
    } as Record<Scene01State, string>,
    pbLabel:    'p_B (hesaplanmış)',
    allowLabel: 'p_B,izin (giriş)',
    sfInt:      'İç diş SF',
    sfExt:      'Dış diş SF',
    note:       'Şematik temas bölgesi — TorqPro uzaysal basınç dağılımı hesaplamaz.',
    pass:       'GEÇTİ',
    fail:       'BAŞARISIZ',
    notEval:    'DEĞERLENDİRİLEMEZ',
    grip:       'L₂ — Kavrama Uzunluğu',
    gripNote:   'Yalnızca görsel bağlam — alan bağlaması yok',
  },
  en: {
    states: {
      'S01-DIAMETER':         'Bolt Diameter (d)',
      'S01-BEARING-DIAMETER': 'Effective Bearing Diameter (Dₖₘ)',
      'S01-ENGAGEMENT':       'Thread Engagement (Lₑ)',
      'S01-GRIP':             'Grip Length — Schematic',
      'S01-BEARING-PRESSURE': 'Bearing Pressure (pᴅ)',
      'S01-THREAD-SAFETY':    'Thread Safety Factor',
    } as Record<Scene01State, string>,
    desc: {
      'S01-DIAMETER':         'd — nominal bolt diameter, user input',
      'S01-BEARING-DIAMETER': 'Dₖₘ = 2 × rₘₑₐₙ — effective mean bearing diameter, user input, full horizontal diameter',
      'S01-ENGAGEMENT':       'Lₑ — axial thread engagement zone, user input, EngineeringCheck only',
      'S01-GRIP':             'L₂ — clamped stack thickness, visual context only',
      'S01-BEARING-PRESSURE': 'pᴅ — frontend-computed bearing pressure, schematic contact zone',
      'S01-THREAD-SAFETY':    'Internal and external thread safety factors, computed result',
    } as Record<Scene01State, string>,
    pbLabel:    'p_B (computed)',
    allowLabel: 'p_B,allow (input)',
    sfInt:      'Internal thread SF',
    sfExt:      'External thread SF',
    note:       'Schematic contact zone — TorqPro does not compute spatial pressure distribution.',
    pass:       'PASS',
    fail:       'FAIL',
    notEval:    'NOT EVALUABLE',
    grip:       'L₂ — Grip Length',
    gripNote:   'Visual context only — no field binding',
  },
} as const

// ── Mobile viewBox crop definitions ──────────────────────────────────────────
// 390×844 first-class: each state crops to the relevant geometry region.

const MOBILE_VB: Record<Scene01State, string> = {
  'S01-DIAMETER':         '155 10 170 270',  // shank region
  'S01-BEARING-DIAMETER': '140 10 200 200',  // head / washer / bearing zone
  'S01-ENGAGEMENT':       '148 305 184 195', // thread engagement region
  'S01-GRIP':             '40  90 400 272',  // full-width clamped stack
  'S01-BEARING-PRESSURE': '100 80 280 310',  // both bearing interfaces
  'S01-THREAD-SAFETY':    '148 305 184 195', // thread engagement region
}

const DESKTOP_VB = '0 0 480 560'

// ── Result panel sub-components ───────────────────────────────────────────────

interface ResultPanelProps {
  id: string; x: number; y: number; w?: number; h?: number
  label: string; value?: string; unit?: string
  color: string; isLimit?: boolean
}
function ResultPanel({ id, x, y, w = 190, h = 58, label, value, unit, color, isLimit }: ResultPanelProps) {
  return (
    <g id={id}>
      <rect x={x} y={y} width={w} height={h} rx="3"
            fill="#F0F4F8" stroke={isLimit ? color : EV.canvasBorder}
            strokeWidth={isLimit ? '1.0' : '1.0'}
            strokeDasharray={isLimit ? '4 2' : 'none'} />
      <text x={x + 8} y={y + 14} fontSize="9" fill={EV.guidance}
            fontFamily="JetBrains Mono,monospace">
        {label}
      </text>
      {value !== undefined ? (
        <text x={x + 8} y={y + 38} fontSize="18" fontWeight="700" fill={color}
              fontFamily="JetBrains Mono,monospace" letterSpacing="-0.03em">
          {value}
          {unit && (
            <tspan fontSize="10" fill={EV.guidance} fontWeight="400"> {unit}</tspan>
          )}
        </text>
      ) : (
        <text x={x + 8} y={y + 35} fontSize="11" fill={EV.guidance}
              fontFamily="JetBrains Mono,monospace">
          —
        </text>
      )}
    </g>
  )
}

interface SFRowProps { label: string; sfVal?: number; color: string; x: number; y: number }
function SFRow({ label, sfVal, color, x, y }: SFRowProps) {
  const display = sfVal !== undefined ? sfVal.toFixed(3) : '—'
  return (
    <g>
      <text x={x} y={y} fontSize="9" fill={EV.guidance} fontFamily="JetBrains Mono,monospace">
        {label}
      </text>
      <text x={x + 190} y={y} fontSize="13" fontWeight="700" fill={color}
            fontFamily="JetBrains Mono,monospace" textAnchor="end" letterSpacing="-0.02em">
        {display}
      </text>
    </g>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Scene01FastenerAssembly({
  activeState,
  values = {},
  status = {},
  lang = 'tr',
  className = '',
}: Scene01Props) {
  // Mobile detection (390px breakpoint = first-class mobile)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    setIsMobile(mq.matches)
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  const L = LABELS[lang]
  const op = computeOpacity(activeState)

  // D_Km annotation value (schematic annotation only)
  const dkmVal = values.effective_bearing_diameter_mm !== undefined
    ? `${values.effective_bearing_diameter_mm} mm` : undefined
  const dVal = values.diameter_mm !== undefined
    ? `${values.diameter_mm} mm` : undefined
  const engVal = values.engagement_mm !== undefined
    ? `${values.engagement_mm} mm` : undefined

  // Bearing pressure displays
  const pbDisplay = values.bearing_pressure_mpa !== undefined
    ? values.bearing_pressure_mpa.toFixed(1) : undefined
  const pAllowDisplay = values.bearing_limit_mpa !== undefined
    ? values.bearing_limit_mpa.toFixed(1) : undefined

  // Bearing zone colours (based on status)
  const bpFill   = bzFillColor(status.bearingPressure)
  const bpStroke = bzStrokeColor(status.bearingPressure)
  const bpColor  = statusColor(status.bearingPressure)

  // Thread SF colours
  const sfIntColor = sfStatusColor(values.internal_thread_sf)
  const sfExtColor = sfStatusColor(values.external_thread_sf)

  // Engagement zone stroke colour (active state dependent)
  const engStrokeColor = activeState === 'S01-THREAD-SAFETY'
    ? (status.internalThreadSf === 'fail' || status.externalThreadSf === 'fail'
       ? C.fail : status.internalThreadSf === 'pass' || status.externalThreadSf === 'pass'
       ? C.pass : C.engStroke)
    : C.engStroke

  const engFillColor = activeState === 'S01-THREAD-SAFETY'
    ? (status.internalThreadSf === 'fail' || status.externalThreadSf === 'fail'
       ? EV.failFill : status.internalThreadSf === 'pass' || status.externalThreadSf === 'pass'
       ? EV.validFill : C.engFill)
    : C.engFill

  const viewBox = isMobile ? MOBILE_VB[activeState] : DESKTOP_VB

  const titleText = L.states[activeState]
  const descText  = L.desc[activeState]

  // Hatch rects (aria-hidden, clipped to exclude hole)
  const upperHatch = hatchLines(PX1, PU.top, PX2, PU.bot)
  const lowerHatch = hatchLines(PX1, PL.top, PX2, PL.bot)

  return (
    <div className={`w-full ${className}`}>
      {/* prefers-reduced-motion: instant transitions */}
      <style>{`
        .scene-transition {
          transition: opacity 200ms ease-in-out, fill 200ms ease-in-out, stroke 200ms ease-in-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .scene-transition { transition: none !important; }
        }
      `}</style>

      <svg
        viewBox={viewBox}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-labelledby="s01-title s01-desc"
        style={{ display: 'block' }}
      >
        {/* ── Accessibility ──────────────────────────────────────────────── */}
        <title id="s01-title">{titleText}</title>
        <desc id="s01-desc">{descText}</desc>

        {/* ── Defs: markers, patterns, clips ────────────────────────────── */}
        <Markers />

        {/* ── Engineering canvas background — VISUAL-03C.1B-R1 ────────────
            HARD RULE: light technical canvas; dark app shell is outside this SVG.
            id="engineering-canvas-background" is the canonical drawing surface. */}
        <rect id="engineering-canvas-background"
              x="0" y="0" width="480" height="560"
              fill={EV.canvasBackground} />

        {/* ════════════════════════════════════════════════════════════════
            LAYER 1: Clamped parts (plates)
            ════════════════════════════════════════════════════════════ */}

        {/* Clamped part — upper */}
        <rect id="clamped-part-upper"
              x={PX1} y={PU.top} width={PX2 - PX1} height={PU.bot - PU.top}
              fill={C.plateFill} stroke={C.plateStroke} strokeWidth="1.5"
              className="scene-transition" style={{ opacity: op.plateU }} />

        {/* Clamped part — lower */}
        <rect id="clamped-part-lower"
              x={PX1} y={PL.top} width={PX2 - PX1} height={PL.bot - PL.top}
              fill={C.plateFill} stroke={C.plateStroke} strokeWidth="1.5"
              className="scene-transition" style={{ opacity: op.plateL }} />

        {/* Engineering section hatch — decorative, aria-hidden */}
        <g clipPath="url(#s01-plate-clip)" aria-hidden="true"
           className="scene-transition"
           style={{ opacity: Math.max(op.plateU, op.plateL) * 0.7 }}>
          {upperHatch}
          {lowerHatch}
        </g>

        {/* Joint parting plane */}
        <line id="joint-parting-plane"
              x1={PX1 + 10} y1={PART_Y} x2={PX2 - 10} y2={PART_Y}
              stroke={C.partLine} strokeWidth="1.2" strokeDasharray="10 4"
              className="scene-transition" style={{ opacity: op.parting }} />

        {/* Context hole (clearance hole indicator) */}
        <rect id="context-hole"
              x={HOLE.x1} y={PU.top} width={HOLE.x2 - HOLE.x1} height={PL.bot - PU.top}
              fill={C.holeFill} stroke={C.holeStroke} strokeWidth="0.8"
              strokeDasharray="none"
              className="scene-transition"
              style={{ opacity: Math.max(op.plateU, op.plateL) }} />

        {/* ════════════════════════════════════════════════════════════════
            LAYER 2: Bolt shank (passes through plates)
            ════════════════════════════════════════════════════════════ */}

        {/* Bolt shank */}
        <rect id="bolt-shank"
              x={SH.x1} y={SH.top} width={SH.x2 - SH.x1} height={SH.bot - SH.top}
              fill={C.shankFill} stroke={C.shankStroke} strokeWidth="1.2"
              className="scene-transition" style={{ opacity: op.shank }} />

        {/* External thread (zigzag profile on shank sides, below THEXT_Y) */}
        <path id="bolt-thread-external"
              d={extThreadPath()}
              fill="none" stroke={C.threadExt} strokeWidth="1.1"
              strokeLinejoin="miter"
              className="scene-transition" style={{ opacity: op.threadExt }} />

        {/* ════════════════════════════════════════════════════════════════
            LAYER 3: Bolt head
            ════════════════════════════════════════════════════════════ */}

        {/* Bolt head (hex bolt section: rectangular with underhead chamfer line) */}
        <rect id="bolt-head"
              x={HEAD.x1} y={HEAD.top} width={HEAD.x2 - HEAD.x1} height={HEAD.bot - HEAD.top}
              fill={C.headFill} stroke={C.headStroke} strokeWidth="1.5"
              rx="1"
              className="scene-transition" style={{ opacity: op.head }} />
        {/* Underhead bearing chamfer indicator (decorative) */}
        <line x1={HEAD.x1} y1={HEAD.bot - 6} x2={HEAD.x2} y2={HEAD.bot - 6}
              stroke={C.headStroke} strokeWidth="0.6"
              aria-hidden="true"
              className="scene-transition" style={{ opacity: op.head * 0.6 }} />
        {/* Head top chamfer indicator (decorative) */}
        <line x1={HEAD.x1 + 4} y1={HEAD.top + 4} x2={HEAD.x2 - 4} y2={HEAD.top + 4}
              stroke={C.headStroke} strokeWidth="0.6"
              aria-hidden="true"
              className="scene-transition" style={{ opacity: op.head * 0.5 }} />

        {/* ════════════════════════════════════════════════════════════════
            LAYER 4: Washers
            ════════════════════════════════════════════════════════════ */}

        {/* Washer — head side */}
        <rect id="washer-head"
              x={WH.x1} y={WH.top} width={WH.x2 - WH.x1} height={WH.bot - WH.top}
              fill={C.washerFill} stroke={C.washerStroke} strokeWidth="1.2"
              className="scene-transition" style={{ opacity: op.washerH }} />

        {/* Washer — nut side */}
        <rect id="washer-nut"
              x={WN.x1} y={WN.top} width={WN.x2 - WN.x1} height={WN.bot - WN.top}
              fill={C.washerFill} stroke={C.washerStroke} strokeWidth="1.2"
              className="scene-transition" style={{ opacity: op.washerN }} />

        {/* ════════════════════════════════════════════════════════════════
            LAYER 5: Nut body and internal thread
            ════════════════════════════════════════════════════════════ */}

        {/* Nut body (hex nut section: rectangular block) */}
        <rect id="nut-body"
              x={NUT.x1} y={NUT.top} width={NUT.x2 - NUT.x1} height={NUT.bot - NUT.top}
              fill={C.nutFill} stroke={C.nutStroke} strokeWidth="1.5"
              className="scene-transition" style={{ opacity: op.nut }} />
        {/* Nut chamfer lines (decorative, section indication) */}
        <line x1={NUT.x1} y1={NUT.top + 5} x2={NUT.x2} y2={NUT.top + 5}
              stroke={C.nutStroke} strokeWidth="0.6"
              aria-hidden="true"
              className="scene-transition" style={{ opacity: op.nut * 0.6 }} />
        <line x1={NUT.x1} y1={NUT.bot - 5} x2={NUT.x2} y2={NUT.bot - 5}
              stroke={C.nutStroke} strokeWidth="0.6"
              aria-hidden="true"
              className="scene-transition" style={{ opacity: op.nut * 0.6 }} />

        {/* Internal thread (zigzag on nut bore walls) */}
        <path id="nut-thread-internal"
              d={intThreadPath()}
              fill="none" stroke={C.threadInt} strokeWidth="1.0"
              strokeLinejoin="miter"
              className="scene-transition" style={{ opacity: op.threadInt }} />

        {/* Thread engagement zone (axial overlap: external meets internal thread) */}
        <rect id="thread-engagement-zone"
              x={SH.x1 - 7} y={ENG.top} width={(SH.x2 - SH.x1) + 14} height={ENG.bot - ENG.top}
              fill={engFillColor} stroke={engStrokeColor}
              strokeWidth="1.2" strokeDasharray="5 2.5"
              rx="1"
              className="scene-transition" style={{ opacity: op.engZone }} />

        {/* ════════════════════════════════════════════════════════════════
            LAYER 6: Bearing contact zones
            ════════════════════════════════════════════════════════════ */}

        {/* Bearing contact zone — head side (washer/plate interface) */}
        <g id="bearing-contact-zone-head"
           className="scene-transition" style={{ opacity: op.bzH }}>
          <rect id="contact-bearing-head"
                x={WH.x1} y={BCH_Y - 3} width={WH.x2 - WH.x1} height={6}
                fill={bpFill} stroke={bpStroke} strokeWidth="1.0" rx="1" />
        </g>

        {/* Bearing contact zone — nut side (plate/washer interface) */}
        <g id="bearing-contact-zone-nut"
           className="scene-transition" style={{ opacity: op.bzN }}>
          <rect id="contact-bearing-nut"
                x={WN.x1} y={BCN_Y - 3} width={WN.x2 - WN.x1} height={6}
                fill={bpFill} stroke={bpStroke} strokeWidth="1.0" rx="1" />
        </g>

        {/* contact-thread-engagement (thread engagement zone contact indicator) */}
        <rect id="contact-thread-engagement"
              x={SH.x1 - 7} y={ENG.top} width={(SH.x2 - SH.x1) + 14} height={ENG.bot - ENG.top}
              fill="none" stroke="transparent" strokeWidth="0"
              aria-hidden="true" />

        {/* ════════════════════════════════════════════════════════════════
            LAYER 7: Centreline
            ════════════════════════════════════════════════════════════ */}

        {/* Centreline — vertical dash-dot line through bolt axis */}
        <line id="centerline-main"
              x1={CX} y1="8" x2={CX} y2="440"
              stroke={C.clLine} strokeWidth="0.8"
              strokeDasharray="12 4 2 4"
              aria-hidden="true" />

        {/* ════════════════════════════════════════════════════════════════
            LAYER 8: Dimension annotations
            ════════════════════════════════════════════════════════════ */}

        {/* dimension-d: nominal bolt diameter (S01-DIAMETER, USER_INPUT) */}
        <DimLineH
          id="dimension-d"
          x1={SH.x1} x2={SH.x2} y={196}
          yExt={170}
          label="d" value={dVal}
          color={C.userInput}
          markerStart="s01-arr-cyan-r"
          markerEnd="s01-arr-cyan"
          opacity={op.dimD}
        />

        {/* dimension-bearing-diameter: D_Km full horizontal diameter (S01-BEARING-DIAMETER, USER_INPUT)
            D_Km = 2 × r_mean, full span through bolt centreline */}
        <DimLineH
          id="dimension-bearing-diameter"
          x1={DKM.x1} x2={DKM.x2} y={DKM.y}
          label="Dₖₘ" value={dkmVal}
          color={C.userInput}
          markerStart="s01-arr-cyan-r"
          markerEnd="s01-arr-cyan"
          opacity={op.dimDKm}
        />

        {/* dimension-engagement: thread engagement length L_e (S01-ENGAGEMENT, USER_INPUT) */}
        <DimLineV
          id="dimension-engagement"
          x={SH.x2} xExt={SH.x2 + 28}
          y1={ENG.top} y2={ENG.bot}
          label="Lₑ" value={engVal}
          color={C.userInput}
          markerStart="s01-arr-cyan-r"
          markerEnd="s01-arr-cyan"
          opacity={op.dimEng}
          labelSide="right"
        />

        {/* dimension-grip: clamped stack L_G (S01-GRIP, VISUAL_CONTEXT_ONLY — no value, no field binding) */}
        <DimLineV
          id="dimension-grip"
          x={PX2} xExt={PX2 + 18}
          y1={PU.top} y2={PL.bot}
          label="L₂"
          color={C.visualCtx}
          markerStart="s01-arr-muted-r"
          markerEnd="s01-arr-muted"
          opacity={op.dimGrip}
          labelSide="right"
        />
        {/* Grip context note (VISUAL_CONTEXT_ONLY) */}
        <text className="scene-transition" style={{ opacity: op.dimGrip * 0.85 }}
              x={PX2 + 12} y={(PU.top + PL.bot) / 2 + 20}
              fontSize="7.5" fill={C.visualCtx}
              fontFamily="JetBrains Mono,monospace" textAnchor="start">
          {L.gripNote}
        </text>

        {/* ════════════════════════════════════════════════════════════════
            LAYER 9: Result panels (S01-BEARING-PRESSURE and S01-THREAD-SAFETY)
            Each semantic ID rendered EXACTLY ONCE. Opacity controls visibility.
            No conditional JSX for any element with a required semantic ID.
            ════════════════════════════════════════════════════════════ */}

        <g className="scene-transition" style={{ opacity: op.panels }}>

          {/* ── Bearing pressure panels (result-bearing-pressure, limit-bearing-pressure)
              Always in DOM once. Visible only when S01-BEARING-PRESSURE.           ── */}
          <g style={{
            opacity: activeState === 'S01-BEARING-PRESSURE' ? 1 : 0,
            pointerEvents: activeState === 'S01-BEARING-PRESSURE' ? 'auto' : 'none',
          }}>
            {/* Panel: p_B — FRONTEND_COMPUTED (annotated in engineering blue, NOT cyan) */}
            <ResultPanel
              id="result-bearing-pressure"
              x={20} y={RP_Y} w={196} h={62}
              label={L.pbLabel}
              value={pbDisplay}
              unit="MPa"
              color={C.computed}
            />

            {/* Panel: p_B,allow — USER_INPUT + LIMIT (dashed border) */}
            <ResultPanel
              id="limit-bearing-pressure"
              x={224} y={RP_Y} w={196} h={62}
              label={L.allowLabel}
              value={pAllowDisplay}
              unit="MPa"
              color={C.userInput}
              isLimit={true}
            />

            {/* Status badge */}
            <g style={{ opacity: status.bearingPressure ? 1 : 0.3 }}>
              <rect x={428} y={RP_Y} width={44} height={62} rx="3"
                    fill={bpColor + '18'} stroke={bpColor} strokeWidth="1.0" />
              <text x={450} y={RP_Y + 28} textAnchor="middle" fontSize="8.5"
                    fill={bpColor} fontFamily="JetBrains Mono,monospace" fontWeight="700">
                {status.bearingPressure === 'pass' ? L.pass
                  : status.bearingPressure === 'fail' ? L.fail
                  : L.notEval}
              </text>
            </g>

            {/* Mandatory schematic note — VISUAL-03B.0-R1 requirement */}
            <text x={20} y={NOTE_Y} fontSize="8.5" fill={C.textMuted}
                  fontFamily="JetBrains Mono,monospace">
              {L.note}
            </text>
          </g>

          {/* ── Thread safety panel (result-thread-safety)
              Always in DOM once. Visible only when S01-THREAD-SAFETY.             ── */}
          <g id="result-thread-safety"
             style={{
               opacity: activeState === 'S01-THREAD-SAFETY' ? 1 : 0,
               pointerEvents: activeState === 'S01-THREAD-SAFETY' ? 'auto' : 'none',
             }}>
            <rect x={20} y={RP_Y} width={420} height={90} rx="3"
                  fill="#F0F4F8" stroke={EV.canvasBorder} strokeWidth="1.0" />
            {/* Internal thread SF row */}
            <SFRow label={L.sfInt}
                   sfVal={values.internal_thread_sf}
                   color={sfIntColor}
                   x={28} y={RP_Y + 20} />
            {/* Divider */}
            <line x1={28} y1={RP_Y + 28} x2={432} y2={RP_Y + 28}
                  stroke={EV.canvasBorder} strokeWidth="0.6" />
            {/* External thread SF row */}
            <SFRow label={L.sfExt}
                   sfVal={values.external_thread_sf}
                   color={sfExtColor}
                   x={28} y={RP_Y + 48} />
            {/* PASS/FAIL threshold note — no amber, no 1.5, no merged SF */}
            <text x={28} y={RP_Y + 74} fontSize="8" fill={C.textMuted}
                  fontFamily="JetBrains Mono,monospace">
              {lang === 'tr'
                ? 'GEÇER: SF ≥ 1.0   BAŞARISIZ: SF < 1.0'
                : 'PASS: SF ≥ 1.0   FAIL: SF < 1.0'}
            </text>
          </g>

        </g>

      </svg>
    </div>
  )
}
