import { describe, expect, it } from 'vitest'

const BASE = process.env.RIVAL_TEST_URL ?? 'http://localhost:8787'

describe('rival patch API', () => {
  it('health responds', async () => {
    const response = await fetch(`${BASE}/health`)
    expect(response.ok).toBe(true)
    const json = (await response.json()) as { product?: string }
    expect(json.product).toBe('Rival Patch')
    expect(json.mode).toBe('live')
  })

  it('patch endpoint dedupes habits', { timeout: 90_000 }, async () => {
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
    const json = (await response.json()) as { decision: string }
    expect(json.decision).toBe('hold')
  })

  it('complaint endpoint applies a patch', { timeout: 90_000 }, async () => {
    const response = await fetch(`${BASE}/rival-complaint`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'api-test',
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
    const json = (await response.json()) as { decision: string; reasonCode: string }
    expect(json.decision).toBe('apply')
    expect(json.reasonCode).toBe('complaint_rejected')
  })
})