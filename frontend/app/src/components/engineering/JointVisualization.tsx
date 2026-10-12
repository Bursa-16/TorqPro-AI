import type { EngineeringCheckResult } from '../../types/api'
import { EV } from '../engineering-visuals/engineeringVisualTokens'

export default function JointVisualization({ result }: { result: EngineeringCheckResult | null }) {
  const preload  = result?.preload_n ?? 0
  const torque   = result?.torque_nom_nm ?? 0
  const nutUtil  = result?.nut_proof_util_pct ?? 0
  const active   = result !== null

  const barFill = active ? Math.min(68, (nutUtil / 100) * 68) : 0

  return (
    <svg
      viewBox="0 0 300 340"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-h-[260px]"
      aria-label="Bolted joint schematic with force arrows"
    >
      <defs>
        <marker id="jv-blue"     markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill={EV.computedResult} />
        </marker>
        <marker id="jv-util-up" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill={EV.computedResult} />
        </marker>
        <marker id="jv-util-dn" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill={EV.computedResult} />
        </marker>
        <marker id="jv-clamp"   markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill={EV.guidance} />
        </marker>
      </defs>

      {/* ── Engineering canvas background ──────────────────────────────────── */}
      <rect x="0" y="0" width="300" height="340"
        fill={EV.canvasBackground} rx="4" />

      {/* ── Clamped members ─────────────────────────────────────────────── */}
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

      {/* ── Bolt shaft ──────────────────────────────────────────────────── */}
      <rect x="132" y="52" width="18" height="158" rx="2"
        fill={EV.shankFill} stroke={EV.geometryPrimary} strokeWidth="0.9" />
      {/* Thread indication */}
      {Array.from({ length: 14 }, (_, i) => i * 11).map(dy => (
        <line key={dy} x1="132" y1={96 + dy} x2="150" y2={101 + dy}
          stroke={EV.sectionHatch} strokeWidth="0.7" />
      ))}

      {/* ── Bolt head ───────────────────────────────────────────────────── */}
      <rect x="120" y="34" width="42" height="20" rx="2.5"
        fill={EV.fastenerFill} stroke={EV.geometryPrimary} strokeWidth="1" />
      <line x1="132" y1="34" x2="132" y2="54" stroke={EV.geometrySecondary} strokeWidth="0.7" />
      <line x1="150" y1="34" x2="150" y2="54" stroke={EV.geometrySecondary} strokeWidth="0.7" />
      <rect x="120" y="34" width="42" height="5" rx="1.5" fill={EV.geometrySecondary} opacity="0.15" />

      {/* Washer under head */}
      <rect x="113" y="54" width="56" height="6" rx="1.5"
        fill={EV.washerFill} stroke={EV.geometrySecondary} strokeWidth="0.7" />

      {/* ── Nut ─────────────────────────────────────────────────────────── */}
      <rect x="120" y="190" width="42" height="20" rx="2.5"
        fill={EV.fastenerFill} stroke={EV.geometryPrimary} strokeWidth="1" />
      <line x1="132" y1="190" x2="132" y2="210" stroke={EV.geometrySecondary} strokeWidth="0.7" />
      <line x1="150" y1="190" x2="150" y2="210" stroke={EV.geometrySecondary} strokeWidth="0.7" />
      <rect x="120" y="205" width="42" height="5" rx="1.5" fill={EV.geometrySecondary} opacity="0.20" />

      {/* Washer under nut */}
      <rect x="113" y="184" width="56" height="6" rx="1.5"
        fill={EV.washerFill} stroke={EV.geometrySecondary} strokeWidth="0.7" />

      {/* ── TORQUE arc ──────────────────────────────────────────────────── */}
      {active && (
        <g>
          <path d="M 166 46 A 26 26 0 0 1 190 58"
            fill="none" stroke={EV.computedResult} strokeWidth="2.2"
            markerEnd="url(#jv-blue)" />
          <text x="196" y="50" fill={EV.computedResult} fontSize="12" fontWeight="700">M_A</text>
          <text x="196" y="65" fill={EV.inputText} fontSize="10" fontWeight="500">
            {torque.toFixed(1)} Nm
          </text>
        </g>
      )}

      {/* ── PRELOAD (Fv) arrows ──────────────────────────────────────────── */}
      {active && (
        <g>
          <line x1="100" y1="118" x2="100" y2="72"
            stroke={EV.computedResult} strokeWidth="2.2"
            markerEnd="url(#jv-util-up)" />
          <line x1="100" y1="190" x2="100" y2="232"
            stroke={EV.computedResult} strokeWidth="2.2"
            markerEnd="url(#jv-util-dn)" />
          <text x="100" y="94" fill={EV.computedResult} fontSize="11" fontWeight="700" textAnchor="middle">
            F_M
          </text>
          <text x="100" y="108" fill={EV.computedResult} fontSize="10" textAnchor="middle">
            {(preload / 1000).toFixed(1)} kN
          </text>
        </g>
      )}

      {/* ── CLAMP FORCE arrows ──────────────────────────────────────────── */}
      {active && (
        <g>
          <line x1="198" y1="118" x2="198" y2="140"
            stroke={EV.guidance} strokeWidth="2.2"
            markerEnd="url(#jv-clamp)" />
          <line x1="198" y1="190" x2="198" y2="168"
            stroke={EV.guidance} strokeWidth="2.2"
            markerEnd="url(#jv-clamp)" />
          <text x="240" y="154" fill={EV.guidance} fontSize="11" fontWeight="700" textAnchor="middle">
            Fc
          </text>
          <text x="240" y="168" fill={EV.guidance} fontSize="10" textAnchor="middle">
            Clamp
          </text>
        </g>
      )}

      {/* ── Utilization bar ─────────────────────────────────────────────── */}
      <rect x="36" y="124" width="9" height="68" rx="2.5"
        fill={EV.holeVoidFill} stroke={EV.geometrySecondary} strokeWidth="0.8" />
      {active && (
        <rect x="36" y={124 + (68 - barFill)} width="9" height={barFill} rx="2.5"
          fill={EV.computedResult} opacity="0.85" />
      )}
      <text x="40.5" y="202" fill={EV.guidance} fontSize="9" fontWeight="500" textAnchor="middle">
        {active ? `${nutUtil.toFixed(0)}%` : '—'}
      </text>

      {/* ── Idle state ──────────────────────────────────────────────────── */}
      {!active && (
        <text x="150" y="260" fill={EV.guidance} fontSize="11" textAnchor="middle">
          Hesap yapılmadı
        </text>
      )}
    </svg>
  )
}
