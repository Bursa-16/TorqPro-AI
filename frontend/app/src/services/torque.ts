import api from './apiClient'
import type { Calculation, EngineeringCheckRequest, EngineeringCheckResult } from '../types/api'

export const createCalculation = (data: Partial<Calculation>) =>
  api<Calculation>('/calculations', { method: 'POST', body: JSON.stringify(data) })

export const listCalculations = (q = '') =>
  api<Calculation[]>(`/calculations${q ? `?q=${encodeURIComponent(q)}` : ''}`)

export const deleteCalculation = (id: number) =>
  api<{ ok: boolean }>(`/calculations/${id}`, { method: 'DELETE' })

export const clearCalculations = () =>
  api<{ ok: boolean }>('/calculations', { method: 'DELETE' })

export const engineeringCheck = (data: EngineeringCheckRequest) =>
  api<EngineeringCheckResult>('/engineering/check', { method: 'POST', body: JSON.stringify(data) })
