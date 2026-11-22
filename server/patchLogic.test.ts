import { describe, expect, it } from 'vitest'
import { decideComplaint, decidePatch } from './patchLogic.js'

const base = {
  sessionId: 'test',
  sampleSeconds: 15,
  cornerShare: 0.5,
  blockShare: 0.1,
  retreatShare: 0.1,
  rushShare: 0.1,
  habits: ['corner_hide' as const],
  p1Health: 80,
  p2Health: 70,
  roundTime: 50,
  patchCount: 0,
  complaintCount: 0,
  appliedReasonCodes: [] as string[],
  tuning: { aggression: 0.4, pressure: 0.5, throwBias: 0.2 },
  attackRate: 0.1,
  roundNumber: 1,
  matchMemory: { roundNumber: 1, priorRounds: [], rememberedTricks: [], patchNotes: [] },
}

describe('decidePatch', () => {
  it('applies a habit patch once', () => {
    const first = decidePatch(base)
    expect(first?.reasonCode).toBe('corner_hide')
    const second = decidePatch({ ...base, appliedReasonCodes: ['corner_hide'], patchCount: 1 })
    expect(second).toBeNull()
  })

  it('caps total patches at five', () => {
    expect(decidePatch({ ...base, patchCount: 5 })).toBeNull()
  })
})

describe('decideComplaint', () => {
  it('rejects easy-mode complaints with a buff', () => {
    const patch = decideComplaint(base, 'This is too hard and unfair')
    expect(patch?.reasonCode).toBe('complaint_rejected')
    expect(patch?.operations.length).toBeGreaterThan(0)
  })
})