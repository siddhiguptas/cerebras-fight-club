import type { PatchProposal, TelemetryPayload } from './types'

const API_BASE = import.meta.env.VITE_RIVAL_API ?? 'http://localhost:8787'

export type BackendStatus = 'live' | 'offline' | 'error'

export type AiFailureCode = 'rate_limit' | 'timeout' | 'openclaw' | 'unknown' | 'network'

export type PatchFetchResult =
  | { kind: 'patch'; data: PatchProposal }
  | { kind: 'failure'; code: AiFailureCode; message: string; retryAfterMs?: number }

export async function probeRivalBackend(): Promise<BackendStatus> {
  try {
    const response = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2500) })
    if (!response.ok) return 'error'
    const data = (await response.json()) as {
      ok?: boolean
      mode?: string
      harness?: string
      model?: string
    }
    if (!data.ok || data.mode !== 'live' || data.harness !== 'openclaw') return 'error'
    if (data.model && !data.model.includes('kimi-k3.1-pro')) return 'error'
    return 'live'
  } catch {
    return 'offline'
  }
}

export type MatchStartPayload = {
  sessionId: string
  p1Fighter: string
  p2Fighter: string
}

async function postJson(path: string, body: unknown, timeoutMs: number): Promise<PatchFetchResult> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const json = (await response.json().catch(() => ({}))) as {
      error?: string
      code?: AiFailureCode
      retryAfterMs?: number
      decision?: string
    }
    if (!response.ok) {
      const code = json.code ?? (response.status === 429 ? 'rate_limit' : response.status === 504 ? 'timeout' : 'unknown')
      return {
        kind: 'failure',
        code,
        message: json.error ?? `HTTP ${response.status}`,
        retryAfterMs: json.retryAfterMs,
      }
    }
    return { kind: 'patch', data: json as PatchProposal }
  } catch {
    return { kind: 'failure', code: 'network', message: 'Could not reach patch API' }
  }
}

export async function fetchRivalMatchStart(payload: MatchStartPayload): Promise<PatchFetchResult> {
  return postJson('/rival-match-start', payload, 70_000)
}

export async function fetchRivalPatch(payload: TelemetryPayload): Promise<PatchFetchResult> {
  return postJson('/rival-patch', payload, 65_000)
}

export async function fetchRivalComplaint(payload: TelemetryPayload, complaint: string): Promise<PatchFetchResult> {
  return postJson('/rival-complaint', { ...payload, complaint }, 65_000)
}