/**
 * JointStiffness — Joint Stiffness Working Diagram (Verspannungsschaubild)
 * VISUAL_NAME=JointStiffness
 * CLASSIFICATION=CALCULATED_RESULT
 * DATA_SOURCE=calculateStiffness() + SeparationResult — no fabricated data
 * FORMULA_USED=F_bolt(Δδ)=FM+c_b×Δδ/1000; F_clamp(Δδ)=max(0,FM−c_p×Δδ/1000)
 */
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceDot, ReferenceLine,
} from 'recharts'
import { CT } from './chartTokens'
import type { StiffnessResult } from '../../lib/stiffnessCalc'

interface Props {
  FM:      number           // kN — assembly preload
  deltaFb: number           // kN — additional bolt force (ΔFb)
  FK_res:  number           // kN — residual clamp force
  stiff:   StiffnessResult
  lang:    'tr' | 'en'
}

const LABELS = {
  tr: { title: 'Bağlantı Rijitlik Diyagramı', x: 'Δδ (μm)', y: 'F (kN)', bolt: 'Cıvata', clamp: 'Flanş' },
  en: { title: 'Joint Stiffness Diagram',      x: 'Δδ (μm)', y: 'F (kN)', bolt: 'Bolt',  clamp: 'Clamp' },
}

interface Tip { active?: boolean; payload?: readonly any[]; label?: any }
function ChartTip({ active, payload, label }: Tip) {
  if (!active || !payload?.length) return null
  const bolt  = payload.find((p: any) => p.dataKey === 'bolt')
  const clamp = payload.find((p: any) => p.dataKey === 'clamp')
  return (
    <div style={{
      background: CT.tooltip.bg, border: `1px solid ${CT.tooltip.border}`,
      borderRadius: 4, padding: '5px 9px',
    }}>
      <div style={{ color: CT.tooltip.muted, fontSize: 10, marginBottom: 2 }}>
        Δδ = {Number(label).toFixed(2)} μm
      </div>
      {bolt  && <div style={{ color: CT.accentLight, fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>F_bolt = {(bolt.value  as number).toFixed(2)} kN</div>}
      {clamp && <div style={{ color: CT.valid,       fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>F_clamp = {(clamp.value as number).toFixed(2)} kN</div>}
    </div>
  )
}

const POINTS = 30

export default function JointStiffness({ FM, deltaFb, FK_res, stiff, lang }: Props) {
  const lbl = LABELS[lang]
  const { c_b, c_p, f_p_preload_um, delta_op_um } = stiff

  // x-axis covers the larger of: separation point × 1.15 or operating point × 2.5
  const xMax = Math.max(f_p_preload_um * 1.15, delta_op_um * 2.5, 1)

  const pts = Array.from({ length: POINTS }, (_, i) => {
    const d = (i / (POINTS - 1)) * xMax
    return {
      d:     parseFloat(d.toFixed(3)),
      bolt:  parseFloat((FM + c_b * d / 1000).toFixed(4)),
      clamp: parseFloat(Math.max(0, FM - c_p * d / 1000).toFixed(4)),
    }
  })

  const opBolt  = FM + deltaFb
  const opClamp = Math.max(0, FK_res)

  const yMin = 0
  const yMax = parseFloat((opBolt * 1.15).toFixed(1))

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-tp-text-2">
          {lbl.title}
        </span>
        <span className="text-[9px] font-mono text-tp-text-2" style={{ opacity: 0.75 }}>
          VDI 2230
        </span>
      </div>

      {/* Stiffness scalars */}
      <div className="flex gap-3 mb-1">
        <span className="text-[9px] font-mono text-tp-text-3">
          c<sub>b</sub> = {c_b.toFixed(1)} kN/mm
        </span>
        <span className="text-[9px] font-mono text-tp-text-3">
          c<sub>p</sub> = {c_p.toFixed(1)} kN/mm
        </span>
      </div>

      {/* Legend */}
      <div className="flex gap-3 mb-1">
        <div className="flex items-center gap-1">
          <span style={{ width: 10, height: 2, background: CT.accentLight, display: 'inline-block', borderRadius: 1 }} />
          <span className="text-[9px] text-tp-text-3">{lbl.bolt}</span>
        </div>
        <div className="flex items-center gap-1">
          <span style={{ width: 10, height: 2, background: CT.valid, display: 'inline-block', borderRadius: 1 }} />
          <span className="text-[9px] text-tp-text-3">{lbl.clamp}</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={pts} margin={{ top: 8, right: 12, bottom: 18, left: -2 }}>
          <CartesianGrid stroke={CT.grid} strokeOpacity={CT.gridOpacity} />
          <XAxis
            dataKey="d"
            type="number"
            domain={[0, xMax]}
            tickCount={5}
            tick={{ fill: CT.text2, fontSize: 10, fontFamily: 'inherit' }}
            axisLine={{ stroke: CT.grid }}
            tickLine={false}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{ value: lbl.x, fill: CT.text2, fontSize: 9, position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: CT.text2, fontSize: 10, fontFamily: 'inherit' }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v: number) => v.toFixed(0)}
            label={{ value: lbl.y, fill: CT.text2, fontSize: 9, angle: -90, position: 'insideLeft', offset: 10 }}
          />
          <Tooltip
            content={(p) => <ChartTip active={p.active} payload={p.payload as any} label={p.label} />}
            cursor={{ stroke: CT.grid, strokeWidth: 1 }}
          />

          {/* Bolt force line */}
          <Line
            type="linear"
            dataKey="bolt"
            stroke={CT.accentLight}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: CT.accentLight, strokeWidth: 0 }}
          />
          {/* Clamp force line */}
          <Line
            type="linear"
            dataKey="clamp"
            stroke={CT.valid}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: CT.valid, strokeWidth: 0 }}
          />

          {/* Preload point (Δδ=0) */}
          <ReferenceLine x={0} stroke={CT.axis} strokeDasharray="3 3" strokeWidth={1} />
          <ReferenceDot
            x={0} y={FM}
            r={4} fill={CT.text2} stroke="#0d1a2e" strokeWidth={1}
            label={{ value: `${FM.toFixed(1)}`, fill: CT.text2, fontSize: 9, position: 'right' }}
          />

          {/* Operating point — bolt */}
          <ReferenceDot
            x={delta_op_um} y={opBolt}
            r={4} fill={CT.accentLight} stroke="#0d1a2e" strokeWidth={1.5}
            label={{ value: `${opBolt.toFixed(2)}`, fill: CT.accentLight, fontSize: 9, position: 'top' }}
          />
          {/* Operating point — clamp */}
          {opClamp > 0 && (
            <ReferenceDot
              x={delta_op_um} y={opClamp}
              r={4} fill={CT.valid} stroke="#0d1a2e" strokeWidth={1.5}
              label={{ value: `${opClamp.toFixed(2)}`, fill: CT.valid, fontSize: 9, position: 'bottom' }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
