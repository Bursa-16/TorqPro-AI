// ── toolTrackingApi.ts ────────────────────────────────────────────────────────
// Read and mutation API calls for the Tool Tracking (Sıkıcı Takip) module.
// C2.8: GET /api/tools, GET /api/tools/summary
// C2.9: POST /api/tools, PATCH /api/tools/{id}, DELETE /api/tools/{id},
//        POST /api/tools/{id}/capability-studies
// Uses the shared api<T>() client — token/auth/ApiError handled there.
// ─────────────────────────────────────────────────────────────────────────────

import api from './apiClient'
import type {
  ApiTool,
  ToolsSummary,
  ToolCreatePayload,
  ToolPatchPayload,
  CapabilityStudyCreatePayload,
  ApiCapabilityStudy,
} from '../types/toolTracking'

export interface ToolsListResponse {
  items: ApiTool[]
  total: number
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function fetchTools(): Promise<ToolsListResponse> {
  return api<ToolsListResponse>('/tools')
}

export async function fetchToolsSummary(): Promise<ToolsSummary> {
  return api<ToolsSummary>('/tools/summary')
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createTool(payload: ToolCreatePayload): Promise<ApiTool> {
  return api<ApiTool>('/tools', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateTool(
  toolId: number,
  payload: ToolPatchPayload,
): Promise<ApiTool> {
  return api<ApiTool>(`/tools/${toolId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function deactivateTool(toolId: number): Promise<ApiTool> {
  return api<ApiTool>(`/tools/${toolId}`, { method: 'DELETE' })
}

export async function createCapabilityStudy(
  toolId: number,
  payload: CapabilityStudyCreatePayload,
): Promise<ApiCapabilityStudy> {
  return api<ApiCapabilityStudy>(`/tools/${toolId}/capability-studies`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
