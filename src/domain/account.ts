import type { Units } from './types'
import type { ToolInventory } from './tools'
import type { Project } from './storage'

export interface WorkshopSnapshot {
  projects: Project[]
  activeId: string
  tools: ToolInventory
  units: Units
  progress: Record<string, string[]>
}

export interface Session {
  token: string
  name: string
}

const TOKEN_KEY = 'pipe-account-token'

export function savedSession(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function storeSession(token: string | null) {
  if (!token) localStorage.removeItem(TOKEN_KEY)
  else localStorage.setItem(TOKEN_KEY, token)
}

async function call<T>(path: string, options: { method?: string; token?: string | null; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const data = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || 'Сервер не ответил')
  return data
}

export function registerAccount(name: string, password: string) {
  return call<{ token: string; name: string }>('/api/register', { method: 'POST', body: { name, password } })
}

export function loginAccount(name: string, password: string) {
  return call<{ token: string; name: string }>('/api/login', { method: 'POST', body: { name, password } })
}

export function loadWorkshop(token: string) {
  return call<{ workshop: WorkshopSnapshot | null; name: string }>('/api/workshop', { token })
}

export function saveWorkshop(token: string, workshop: WorkshopSnapshot) {
  return call<{ ok: boolean }>('/api/workshop', { method: 'PUT', token, body: workshop })
}
