/**
 * TorqueRangeChart
 * VISUAL_NAME=TorqueRangeChart
 * CLASSIFICATION=CALCULATED_RESULT
 * DATA_SOURCE=EngineeringCheckResult.torque_min_nm / torque_nom_nm / torque_max_nm
 * AUTHORITATIVE=YES — direct backend calculation result
 * FABRICATED_DATA=NO
 */
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { EngineeringCheckResult } from '../../types/api'
import { CT } from './chartTokens'

interface Props {
  result: EngineeringCheckResult
  lang: 'tr' | 'en'
}

const LABELS = {
  tr: { min: 'Min', nom: 'Nom', max: 'Maks', title: 'Tork Aralığı', formula: 'M_min · M_nom · M_max' },
  en: { min: 'Min', nom: 'Nom', max: 'Max', title: 'Torque Range',  formula: 'M_min · M_nom · M_max' },
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: readonly any[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: CT.tooltip.bg, border: `1px solid ${CT.tooltip.border}`,
      borderRadius: 4, padding: '5px 9px',
    }}>
      <div style={{ color: CT.tooltip.muted, fontSize: 10, marginBottom: 2 }}>{label}</div>
      <div style={{
        color: CT.tooltip.text, fontSize: 12, fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {(payload[0].value as number).toFixed(1)} N·m
      </div>
    </div>
  )
}

export default function TorqueRangeChart({ result, lang }: Props) {
  const lbl = LABELS[lang]
  const data = [
    { name: lbl.min, value: result.torque_min_nm },
    { name: lbl.nom, value: result.torque_nom_nm },
    { name: lbl.max, value: result.torque_max_nm },
  ]
  const yMax = Math.ceil(result.torque_max_nm * 1.22)
  const barColors = [CT.accentMuted, CT.accent, CT.accentLight]

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[9px] font-bold uppercase tracking-widest text-tp-text-3">
          {lbl.title}
        </span>
        <span className="text-[9px] text-tp-text-3 font-mono" style={{ opacity: 0.55 }}>
          {lbl.formula}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={76}>
        <BarChart
          data={data}
          margin={{ top: 14, right: 4, bottom: 0, left: -10 }}
          barCategoryGap="22%"
        >
          <CartesianGrid vertical={false} stroke={CT.grid} strokeOpacity={CT.gridOpacity} />
          <XAxis
            dataKey="name"
            tick={{ fill: CT.axis, fontSize: 9, fontFamily: 'inherit' }}
            axisLine={{ stroke: CT.grid }}
            tickLine={false}
            interval={0}
          />
          <YAxis hide domain={[0, yMax]} />
          <Tooltip
            content={(props) => <ChartTip active={props.active} payload={props.payload as any} label={props.label as string} />}
            cursor={{ fill: 'rgba(74,124,201,0.06)' }}
          />
          <Bar
            dataKey="value"
            radius={[2, 2, 0, 0]}
            maxBarSize={38}
            label={(props) => {
              const { x, y, width, value } = props as { x: number; y: number; width: number; value: number }
              return (
                <text
                  x={x + width / 2} y={y - 3}
                  textAnchor="middle" dominantBaseline="auto"
                  fill={CT.axis} fontSize={9}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {typeof value === 'number' ? value.toFixed(1) : ''}
                </text>
              )
            }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={barColors[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
