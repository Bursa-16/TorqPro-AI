// ── toolTrackingDemo.ts ──────────────────────────────────────────────────────
// C1 static demo data — exact 4 rows from the legacy page-sikici HTML.
// No fabrication. Cm/Cmk and status are display-only; not computed here.
// Replace this constant with an API call in C2.
// ─────────────────────────────────────────────────────────────────────────────

import type { ToolStatus } from '../types/toolTracking'

type DemoToolTrackingRecord = {
  id: string
  registrationId: string
  model: string
  operation: string
  nominalTorqueNm: number
  toolClass: string
  cm: number | null
  cmk: number | null
  lastCapabilityDate: string | null
  status: ToolStatus
}

export const DEMO_TOOLS: DemoToolTrackingRecord[] = [
  {
    id: '1',
    registrationId:    'G278',
    model:             'EXACT 12',
    operation:         'Güneşlik mont.',
    nominalTorqueNm:   15,
    toolClass:         'C',
    cm:                2.34,
    cmk:               2.18,
    lastCapabilityDate:'2024-06-20',
    status:            'OK',
  },
  {
    id: '2',
    registrationId:    'S1823',
    model:             'SEC EXACT',
    operation:         'Braket mont.',
    nominalTorqueNm:   28,
    toolClass:         'B',
    cm:                1.71,
    cmk:               1.42,
    lastCapabilityDate:'2024-05-15',
    status:            'KONTROL',
  },
  {
    id: '3',
    registrationId:    'S1109',
    model:             'EXACT 15',
    operation:         'Kutup başı mont.',
    nominalTorqueNm:   5,
    toolClass:         'C',
    cm:                1.28,
    cmk:               1.10,
    lastCapabilityDate:'2024-04-02',
    status:            'YETERSİZ',
  },
  {
    id: '4',
    registrationId:    'ST22',
    model:             'SEC EXACT',
    operation:         'Arkalık ayarı',
    nominalTorqueNm:   28,
    toolClass:         'B',
    cm:                1.45,
    cmk:               1.31,
    lastCapabilityDate:'2024-03-01',
    status:            'SÜRESİ DOLMUŞ',
  },
]
