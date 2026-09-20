import type { EngineeringCheckResult } from '../../types/api'

export default function JointVisualization({ result }: { result: EngineeringCheckResult | null }) {
  const preload  = result?.preload_n ?? 0
  const torque   = result?.torque_nom_nm ?? 0
  const nutUtil  = result?.nut_proof_util_pct ?? 0
  const active   = result !== null

  const utilColor = nutUtil > 90 ? '#c04040' : nutUtil > 75 ? '#c8860e' : '#1b9e7a'
  const barFill = active ? Math.min(80, Math.max(10, (nutUtil / 100) * 80)) : 0

  return (
    <svg
      viewBox="0 0 300 340"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-h-[260px]"
      aria-label="Bolted joint schematic with force arrows"
    >
      <defs>
        <marker id="jv-blue"     markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#4a7cc9" />
        </marker>
        <marker id="jv-util-up" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill={utilColor} />
        </marker>
        <marker id="jv-util-dn" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill={utilColor} />
        </marker>
        <marker id="jv-clamp"   markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
          <polygon points="0 0,8 3,0 6" fill="#1b9e7a" />
        </marker>
      </defs>

      {/* ── Clamped members ─────────────────────────────────────────────── */}
      <rect x="74" y="124" width="152" height="34" rx="2"
        fill="#242838" stroke="#3a4060" strokeWidth="1.2" />
      <rect x="74" y="158" width="152" height="34" rx="2"
        fill="#1c2030" stroke="#3a4060" strokeWidth="1.2" />

      {/* Engineering hatching — top plate */}
      {Array.from({ length: 13 }, (_, i) => i * 12).map(x => (
        <line key={`th-${x}`} x1={74 + x} y1="124" x2={82 + x} y2="114"
          stroke="#2d3450" strokeWidth="0.7" />
      ))}
      {/* Engineering hatching — bottom plate */}
      {Array.from({ length: 13 }, (_, i) => i * 12).map(x => (
        <line key={`bh-${x}`} x1={74 + x} y1="192" x2={82 + x} y2="202"
          stroke="#252c42" strokeWidth="0.7" />
      ))}

      {/* ── Bolt shaft ──────────────────────────────────────────────────── */}
      <rect x="132" y="52" width="18" height="158" rx="2"
        fill="#4a5578" stroke="#5a6890" strokeWidth="0.9" />
      {/* Thread indication */}
      {Array.from({ length: 14 }, (_, i) => i * 11).map(dy => (
        <line key={dy} x1="132" y1={96 + dy} x2="150" y2={101 + dy}
          stroke="#3a4060" strokeWidth="0.7" />
      ))}

      {/* ── Bolt head ───────────────────────────────────────────────────── */}
      <rect x="120" y="34" width="42" height="20" rx="2.5"
        fill="#5a6890" stroke="#6b7aa0" strokeWidth="1" />
      <line x1="132" y1="34" x2="132" y2="54" stroke="#4a5578" strokeWidth="0.7" />
      <line x1="150" y1="34" x2="150" y2="54" stroke="#4a5578" strokeWidth="0.7" />
      <rect x="120" y="34" width="42" height="5" rx="1.5" fill="#6b7aa0" opacity="0.35" />

      {/* Washer under head */}
      <rect x="113" y="54" width="56" height="6" rx="1.5"
        fill="#3a4060" stroke="#4a5578" strokeWidth="0.7" />

      {/* ── Nut ─────────────────────────────────────────────────────────── */}
      <rect x="120" y="190" width="42" height="20" rx="2.5"
        fill="#5a6890" stroke="#6b7aa0" strokeWidth="1" />
      <line x1="132" y1="190" x2="132" y2="210" stroke="#4a5578" strokeWidth="0.7" />
      <line x1="150" y1="190" x2="150" y2="210" stroke="#4a5578" strokeWidth="0.7" />
      <rect x="120" y="205" width="42" height="5" rx="1.5" fill="#3a4060" opacity="0.45" />

      {/* Washer under nut */}
      <rect x="113" y="184" width="56" height="6" rx="1.5"
        fill="#3a4060" stroke="#4a5578" strokeWidth="0.7" />

      {/* ── TORQUE arc ──────────────────────────────────────────────────── */}
      {active && (
        <g>
          <path d="M 166 46 A 26 26 0 0 1 190 58"
            fill="none" stroke="#4a7cc9" strokeWidth="2.2"
            markerEnd="url(#jv-blue)" />
          <text x="196" y="50" fill="#4a7cc9" fontSize="12" fontWeight="700">T</text>
          <text x="196" y="65" fill="#6b9bdd" fontSize="10" fontWeight="500">
            {torque.toFixed(1)} Nm
          </text>
        </g>
      )}

      {/* ── PRELOAD (Fv) arrows ──────────────────────────────────────────── */}
      {active && (
        <g>
          <line x1="100" y1="118" x2="100" y2="72"
            stroke={utilColor} strokeWidth="2.2"
            markerEnd="url(#jv-util-up)" />
          <line x1="100" y1="190" x2="100" y2="232"
            stroke={utilColor} strokeWidth="2.2"
            markerEnd="url(#jv-util-dn)" />
          <text x="100" y="94" fill={utilColor} fontSize="11" fontWeight="700" textAnchor="middle">
            Fv
          </text>
          <text x="100" y="108" fill={utilColor} fontSize="10" textAnchor="middle">
            {(preload / 1000).toFixed(1)} kN
          </text>
        </g>
      )}

      {/* ── CLAMP FORCE arrows ──────────────────────────────────────────── */}
      {active && (
        <g>
          <line x1="198" y1="118" x2="198" y2="140"
            stroke="#1b9e7a" strokeWidth="2.2"
            markerEnd="url(#jv-clamp)" />
          <line x1="198" y1="190" x2="198" y2="168"
            stroke="#1b9e7a" strokeWidth="2.2"
            markerEnd="url(#jv-clamp)" />
          <text x="240" y="154" fill="#1b9e7a" fontSize="11" fontWeight="700" textAnchor="middle">
            Fc
          </text>
          <text x="240" y="168" fill="#1b9e7a" fontSize="10" textAnchor="middle">
            Clamp
          </text>
        </g>
      )}

      {/* ── Utilization bar ─────────────────────────────────────────────── */}
      <rect x="36" y="124" width="9" height="68" rx="2.5"
        fill="#1c2030" stroke="#3a4060" strokeWidth="0.6" />
      {active && (
        <rect x="36" y={124 + (68 - barFill)} width="9" height={barFill} rx="2.5"
          fill={utilColor} opacity="0.85" />
      )}
      <text x="40.5" y="202" fill="#555c78" fontSize="9" fontWeight="500" textAnchor="middle">
        {active ? `${nutUtil.toFixed(0)}%` : '—'}
      </text>

      {/* ── Idle state ──────────────────────────────────────────────────── */}
      {!active && (
        <text x="150" y="260" fill="#3a4060" fontSize="11" textAnchor="middle">
          Hesap yapılmadı
        </text>
      )}
    </svg>
  )
}
