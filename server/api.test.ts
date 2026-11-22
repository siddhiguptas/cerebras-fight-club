import { describe, expect, it } from 'vitest'

const BASE = process.env.RIVAL_TEST_URL ?? 'http://localhost:8787'

describe('rival patch API', () => {
  it('health responds with OpenClaw + Kimi metadata', async () => {
    const response = await fetch(`${BASE}/health`)
    expect(response.ok).toBe(true)
    const json = (await response.json()) as {
      product?: string
      mode?: string
      harness?: string
      model?: string
      hackathon?: { modelId?: string }
    }
    expect(json.product).toBe('Rival Patch')
    expect(json.mode).toBe('live')
    expect(json.harness).toBe('openclaw')
    expect(json.model).toContain('kimi-k3.1-pro')
    expect(json.hackathon?.modelId).toBe('moonshotai-kimi-k3.1-pro-trial')
  })

  it('patch endpoint dedupes habits without calling Kimi', async () => {
    const body = {
      sessionId: 'api-test',
      sampleSeconds: 20,
      cornerShare: 0.8,
      blockShare: 0.1,
      retreatShare: 0.1,
      rushShare: 0.1,
      habits: ['corner_hide'],
      p1Health: 90,
      p2Health: 90,
      roundTime: 45,
      patchCount: 0,
      complaintCount: 0,
      appliedReasonCodes: ['corner_hide'],
      attackRate: 0.25,
      roundNumber: 1,
      tuning: { aggression: 0.4, pressure: 0.5, throwBias: 0.2 },
      matchMemory: { roundNumber: 1, priorRounds: [], rememberedTricks: [], patchNotes: [] },
    }
    const response = await fetch(`${BASE}/rival-patch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(response.ok).toBe(true)
    const json = (await response.json()) as { decision: string; latencyMs?: number }
    expect(json.decision).toBe('hold')
    expect(json.latencyMs).toBeDefined()
    expect(json.latencyMs!).toBeLessThan(500)
  })

  it('live patch applies for rush habit', { timeout: 90_000 }, async () => {
    const response = await fetch(`${BASE}/rival-patch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'api-test-rush',
        sampleSeconds: 20,
        cornerShare: 0.1,
        blockShare: 0.1,
        retreatShare: 0.1,
        rushShare: 0.55,
        habits: ['rush'],
        p1Health: 80,
        p2Health: 90,
        roundTime: 40,
        patchCount: 0,
        complaintCount: 0,
        appliedReasonCodes: [],
        attackRate: 0.4,
        roundNumber: 1,
        tuning: { aggression: 0.4, pressure: 0.5, throwBias: 0.2 },
        matchMemory: { roundNumber: 1, priorRounds: [], rememberedTricks: [], patchNotes: [] },
      }),
    })
    expect(response.ok).toBe(true)
    const json = (await response.json()) as {
      decision: string
      operations?: unknown[]
      patchNote?: string
      latencyMs?: number
    }
    expect(json.decision).toBe('apply')
    expect((json.operations ?? []).length).toBeGreaterThan(0)
    expect(json.patchNote?.length).toBeGreaterThan(0)
    expect(json.latencyMs).toBeGreaterThan(0)
  })

  it('complaint endpoint returns a live Kimi patch', { timeout: 90_000 }, async () => {
    const response = await fetch(`${BASE}/rival-complaint`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'api-test-complaint',
        sampleSeconds: 5,
        cornerShare: 0,
        blockShare: 0,
        retreatShare: 0,
        rushShare: 0,
        habits: ['neutral'],
        p1Health: 90,
        p2Health: 90,
        roundTime: 45,
        patchCount: 0,
        complaintCount: 0,
        appliedReasonCodes: [],
        attackRate: 0,
        roundNumber: 1,
        tuning: { aggression: 0.4, pressure: 0.5, throwBias: 0.2 },
        matchMemory: { roundNumber: 1, priorRounds: [], rememberedTricks: [], patchNotes: [] },
        complaint: 'This fight is unfair and too hard',
      }),
    })
    expect(response.ok).toBe(true)
    const json = (await response.json()) as {
      decision: string
      reasonCode: string
      patchNote?: string
      operations?: unknown[]
    }
    expect(json.decision).toBe('apply')
    expect(json.reasonCode.startsWith('complaint') || json.reasonCode === 'baseline').toBe(true)
    expect(json.patchNote?.length).toBeGreaterThan(0)
    expect((json.operations ?? []).length).toBeGreaterThan(0)
  })
})