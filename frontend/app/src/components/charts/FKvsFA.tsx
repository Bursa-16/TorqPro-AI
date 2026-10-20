/**
 * FKvsFA — Additional Bolt Force vs External Load
 * VISUAL_NAME=FKvsFA
 * CLASSIFICATION=CALCULATED_RESULT
 * DATA_SOURCE=FK = n × Φ × FA  (VDI 2230 Blatt 1, authoritative in AdvancedAnalysisPage)
 * FORMULA_USED=FK = n × Φ × FA  (same formula as calculate() in AdvancedAnalysisPage)
 * AUTHORITATIVE=YES — derived from same formula as engine
 * FABRICATED_DATA=NO — points generated from authoritative linear formula only
 */
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot,
} from 'recharts'
import { CT } from './chartTokens'

interface Props {
  phi:  number   // VdiResult.phi
  n:    number   // inputs.v_n (load introduction factor)
  faKN: number   // inputs.v_FA (kN)
  fkN:  number   // result.FK (N) — current operating point
  lang: 'tr' | 'en'
}

const LABELS = {
  tr: { title: 'ΔFb / FA İlişkisi', x: 'FA (kN)', y: 'ΔFb (kN)', formula: 'FK = n × Φ × FA' },
  en: { title: 'ΔFb / FA Relationship', x: 'FA (kN)', y: 'ΔFb (kN)', formula: 'FK = n × Φ × FA' },
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: readonly any[]; label?: any }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: CT.tooltip.bg, border: `1px solid ${CT.tooltip.border}`,
      borderRadius: 4, padding: '5px 9px',
    }}>
      <div style={{ color: CT.tooltip.muted, fontSize: 10, marginBottom: 2 }}>
        FA = {Number(label).toFixed(2)} kN
      </div>
      <div style={{ color: CT.tooltip.text, fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        ΔFb = {(payload[0]?.value as number).toFixed(3)} kN
      </div>
    </div>
  )
}

export default function FKvsFA({ phi, n, faKN, fkN, lang }: Props) {
  const lbl = LABELS[lang]
  // FK (kN) = n × phi × FA (kN) — same formula as calculate(), units: kN throughout
  const slope = n * phi
  const faMax = Math.max(faKN * 1.8, 10)
  const POINTS = 22
  const pts = Array.from({ length: POINTS }, (_, i) => {
    const fa = parseFloat(((i / (POINTS - 1)) * faMax).toFixed(3))
    return { fa, fk: parseFloat((slope * fa).toFixed(5)) }
  })
  const currentFk = fkN / 1000  // N → kN

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-tp-text-2">
          {lbl.title}
        </span>
        <span className="text-[9px] text-tp-text-2 font-mono" style={{ opacity: 0.75 }}>
          {lbl.formula}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={108}>
        <LineChart data={pts} margin={{ top: 6, right: 10, bottom: 16, left: -4 }}>
          <CartesianGrid stroke={CT.grid} strokeOpacity={CT.gridOpacity} />
          <XAxis
            dataKey="fa"
            type="number"
            domain={[0, faMax]}
            tickCount={5}
            tick={{ fill: CT.text2, fontSize: 10, fontFamily: 'inherit' }}
            axisLine={{ stroke: CT.grid }}
            tickLine={false}
            tickFormatter={(v: number) => v.toFixed(0)}
            label={{ value: lbl.x, fill: CT.text2, fontSize: 9, position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            dataKey="fk"
            tick={{ fill: CT.text2, fontSize: 10, fontFamily: 'inherit' }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v: number) => v.toFixed(2)}
            label={{ value: lbl.y, fill: CT.text2, fontSize: 9, angle: -90, position: 'insideLeft', offset: 10 }}
          />
          <Tooltip
            content={(props) => <ChartTip active={props.active} payload={props.payload as any} label={props.label} />}
            cursor={{ stroke: CT.grid, strokeWidth: 1 }}
          />
          <Line
            type="linear"
            dataKey="fk"
            stroke={CT.accent}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: CT.accentLight, stroke: CT.accent, strokeWidth: 1.5 }}
          />
          {/* Current operating point */}
          <ReferenceDot
            x={faKN}
            y={currentFk}
            r={5}
            fill={CT.accentLight}
            stroke="#0d1a2e"
            strokeWidth={1.5}
            label={{
              value: `${currentFk.toFixed(3)}`,
              fill: CT.text,
              fontSize: 10,
              position: 'top',
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
