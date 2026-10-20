/**
 * ContactPressureSchematic
 * VISUAL_NAME=ContactPressureSchematic
 * CLASSIFICATION=ENGINEERING_SCHEMATIC
 * DATA_SOURCE=Qualitative analytical model — no numerical values, no FEA
 * LABEL=Schematic Contact Pressure Distribution (clearly labeled, not quantitative)
 * FABRICATED_DATA=NO — illustrative geometry only
 */
import { EV } from '../engineering-visuals/engineeringVisualTokens'

interface Props {
  lang: 'tr' | 'en'
}

const TITLE = {
  tr: 'Şematik Temas Basıncı Dağılımı',
  en: 'Schematic Contact Pressure Distribution',
}

export default function ContactPressureSchematic({ lang }: Props) {
  // Layout constants — H reduced from 180→140 for viewport density
  const W = 240, H = 140
  const cx = W / 2

  // Bolt head / nut
  const headW = 32, headH = 12
  const nutW  = 32, nutH  = 12
  const shankW = 14
  const shankTop = 12 + headH            // y where shank begins
  const shankBot = H - 12 - nutH         // y where shank ends (nut top)

  // Plates
  const plate1Top = shankTop + 3
  const plate1Bot = plate1Top + 28
  const plate2Top = plate1Bot
  const plate2Bot = plate2Top + 28

  // Pressure cone trapezoids (qualitative, symmetric about cx)
  // Upper cone: top at plate1Top, narrow end at bolt head edge; wide end at plate1Bot
  const coneTopHalfW  = shankW / 2 + 1
  const coneBotHalfW  = coneTopHalfW + 28
  // Upper cone
  const ucTL = { x: cx - coneTopHalfW, y: plate1Top }
  const ucTR = { x: cx + coneTopHalfW, y: plate1Top }
  const ucBL = { x: cx - coneBotHalfW, y: plate1Bot }
  const ucBR = { x: cx + coneBotHalfW, y: plate1Bot }
  // Lower cone (mirrored)
  const lcTL = { x: cx - coneBotHalfW, y: plate2Top }
  const lcTR = { x: cx + coneBotHalfW, y: plate2Top }
  const lcBL = { x: cx - coneTopHalfW, y: plate2Bot }
  const lcBR = { x: cx + coneTopHalfW, y: plate2Bot }

  // Load-flow arrow positions
  const arrowX1 = cx - coneBotHalfW - 14
  const arrowX2 = cx + coneBotHalfW + 14
  const arrowY1 = plate1Top + 8
  const arrowY2 = plate2Bot - 8

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[9px] font-bold uppercase tracking-widest text-tp-text-3">
          {TITLE[lang]}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={TITLE[lang]}
        style={{ background: EV.canvasBackground, display: 'block', borderRadius: 4 }}
      >
        {/* Pressure cones (qualitative) */}
        <polygon
          points={`${ucTL.x},${ucTL.y} ${ucTR.x},${ucTR.y} ${ucBR.x},${ucBR.y} ${ucBL.x},${ucBL.y}`}
          fill="#4a7cc9"
          fillOpacity={0.10}
          stroke="#4a7cc9"
          strokeOpacity={0.22}
          strokeWidth={0.8}
        />
        <polygon
          points={`${lcTL.x},${lcTL.y} ${lcTR.x},${lcTR.y} ${lcBR.x},${lcBR.y} ${lcBL.x},${lcBL.y}`}
          fill="#4a7cc9"
          fillOpacity={0.10}
          stroke="#4a7cc9"
          strokeOpacity={0.22}
          strokeWidth={0.8}
        />

        {/* Plate 1 (upper clamped) */}
        <rect
          x={8} y={plate1Top} width={W - 16} height={plate1Bot - plate1Top}
          fill={EV.clampedUpperFill}
          stroke={EV.geometrySecondary}
          strokeWidth={0.8}
          strokeOpacity={0.5}
        />
        {/* Plate 2 (lower clamped) */}
        <rect
          x={8} y={plate2Top} width={W - 16} height={plate2Bot - plate2Top}
          fill={EV.clampedLowerFill}
          stroke={EV.geometrySecondary}
          strokeWidth={0.8}
          strokeOpacity={0.5}
        />
        {/* Hole voids */}
        <rect
          x={cx - shankW / 2} y={plate1Top}
          width={shankW} height={plate1Bot - plate1Top}
          fill={EV.holeVoidFill}
          stroke="none"
        />
        <rect
          x={cx - shankW / 2} y={plate2Top}
          width={shankW} height={plate2Bot - plate2Top}
          fill={EV.holeVoidFill}
          stroke="none"
        />

        {/* Shank */}
        <rect
          x={cx - shankW / 2} y={shankTop}
          width={shankW} height={shankBot - shankTop}
          fill={EV.shankFill}
          stroke={EV.geometryPrimary}
          strokeWidth={0.7}
          strokeOpacity={0.55}
        />

        {/* Bolt head */}
        <rect
          x={cx - headW / 2} y={12}
          width={headW} height={headH}
          fill={EV.fastenerFill}
          stroke={EV.geometryPrimary}
          strokeWidth={0.9}
        />
        {/* Nut */}
        <rect
          x={cx - nutW / 2} y={shankBot}
          width={nutW} height={nutH}
          fill={EV.fastenerFill}
          stroke={EV.geometryPrimary}
          strokeWidth={0.9}
        />

        {/* Load-flow arrows — left side */}
        {/* Upper arrow pointing down */}
        <line x1={arrowX1} y1={arrowY1} x2={arrowX1} y2={plate1Bot - 4}
          stroke={EV.guidance} strokeWidth={1} strokeOpacity={0.7} />
        <polygon
          points={`${arrowX1},${plate1Bot - 4} ${arrowX1 - 3},${plate1Bot - 10} ${arrowX1 + 3},${plate1Bot - 10}`}
          fill={EV.guidance} fillOpacity={0.7} />
        {/* Lower arrow pointing up */}
        <line x1={arrowX1} y1={arrowY2} x2={arrowX1} y2={plate2Top + 4}
          stroke={EV.guidance} strokeWidth={1} strokeOpacity={0.7} />
        <polygon
          points={`${arrowX1},${plate2Top + 4} ${arrowX1 - 3},${plate2Top + 10} ${arrowX1 + 3},${plate2Top + 10}`}
          fill={EV.guidance} fillOpacity={0.7} />

        {/* Load-flow arrows — right side */}
        <line x1={arrowX2} y1={arrowY1} x2={arrowX2} y2={plate1Bot - 4}
          stroke={EV.guidance} strokeWidth={1} strokeOpacity={0.7} />
        <polygon
          points={`${arrowX2},${plate1Bot - 4} ${arrowX2 - 3},${plate1Bot - 10} ${arrowX2 + 3},${plate1Bot - 10}`}
          fill={EV.guidance} fillOpacity={0.7} />
        <line x1={arrowX2} y1={arrowY2} x2={arrowX2} y2={plate2Top + 4}
          stroke={EV.guidance} strokeWidth={1} strokeOpacity={0.7} />
        <polygon
          points={`${arrowX2},${plate2Top + 4} ${arrowX2 - 3},${plate2Top + 10} ${arrowX2 + 3},${plate2Top + 10}`}
          fill={EV.guidance} fillOpacity={0.7} />

        {/* Label: "Koni" / "Cone" annotation */}
        <text
          x={cx + coneBotHalfW + 18} y={(plate1Top + plate1Bot) / 2 + 4}
          fill={EV.schematicNote} fontSize={7.5} textAnchor="middle"
        >
          {lang === 'tr' ? 'Koni' : 'Cone'}
        </text>
        <text
          x={cx + coneBotHalfW + 18} y={(plate2Top + plate2Bot) / 2 + 4}
          fill={EV.schematicNote} fontSize={7.5} textAnchor="middle"
        >
          {lang === 'tr' ? 'Koni' : 'Cone'}
        </text>
      </svg>
    </div>
  )
}
