import api from './apiClient'

export const getValidationDatasets = () => api<any[]>('/validation/datasets')
export const getValidationSummary = () => api<any>('/validation/summary')
export const checkCompatibility = (boltClass: string, nutClass: string) =>
  api<any>(`/validation/compatibility?bolt_class=${boltClass}&nut_class=${nutClass}`, { method: 'POST' })
