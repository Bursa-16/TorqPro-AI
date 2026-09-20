const API_BASE = '/api'

class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail); this.status = status; this.detail = detail
  }
}

function getToken(): string | null {
  return sessionStorage.getItem('torqpro_token')
}

export function setAuth(token: string, displayName: string, role: string) {
  sessionStorage.setItem('torqpro_token', token)
  sessionStorage.setItem('torqpro_user', displayName)
  sessionStorage.setItem('torqpro_role', role)
}

export function clearAuth() {
  sessionStorage.removeItem('torqpro_token')
  sessionStorage.removeItem('torqpro_user')
  sessionStorage.removeItem('torqpro_role')
}

export function getStoredAuth() {
  return {
    token: sessionStorage.getItem('torqpro_token'),
    displayName: sessionStorage.getItem('torqpro_user'),
    role: sessionStorage.getItem('torqpro_role') as 'admin' | 'engineer' | 'viewer' | null,
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers as Record<string, string> }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    let detail = 'İstek başarısız'
    try { const d = await res.json(); detail = d.detail || detail } catch { /* ignore */ }
    throw new ApiError(res.status, detail)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res as unknown as T
}

export { ApiError }
export default api
