import type { PatchProposal, TelemetryPayload } from './types'

const API_BASE = import.meta.env.VITE_RIVAL_API ?? 'http://localhost:8787'

export type BackendStatus = 'live' | 'offline' | 'error'

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

export async function fetchRivalPatch(payload: TelemetryPayload): Promise<PatchProposal | null> {
  try {
    const response = await fetch(`${API_BASE}/rival-patch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) return null
    return (await response.json()) as PatchProposal
  } catch {
    return null
  }
}

export async function fetchRivalComplaint(
  payload: TelemetryPayload,
  complaint: string,
): Promise<PatchProposal | null> {
  try {
    const response = await fetch(`${API_BASE}/rival-complaint`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, complaint }),
    })
    if (!response.ok) return null
    return (await response.json()) as PatchProposal
  } catch {
    return null
  }
}