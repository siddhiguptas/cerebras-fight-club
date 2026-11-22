import { describe, expect, it } from 'vitest'
import { normalizeMatchStartPatch, normalizeModelPatch } from './patchValidate.js'

const telemetry = {
  sessionId: 'v',
  sampleSeconds: 1,
  cornerShare: 0,
  blockShare: 0,
  retreatShare: 0,
  rushShare: 0,
  attackRate: 0,
  habits: ['neutral' as const],
  p1Health: 100,
  p2Health: 100,
  roundTime: 60,
  roundNumber: 1,
  patchCount: 0,
  complaintCount: 0,
  appliedReasonCodes: [] as string[],
  tuning: { aggression: 0.5, pressure: 0.5, throwBias: 0.2 },
  matchMemory: { roundNumber: 1, priorRounds: [], rememberedTricks: [], patchNotes: [] },
}

describe('normalizeMatchStartPatch', () => {
  it('forces apply for match bootstrap even when model says hold', () => {
    const patch = normalizeMatchStartPatch({
      decision: 'hold',
      reasonCode: 'neutral',
      headline: '',
      patchNote: '',
      operations: [],
    })
    expect(patch?.decision).toBe('apply')
    expect(patch?.reasonCode).toBe('baseline')
    expect(patch?.operations.length).toBeGreaterThan(0)
  })

  it('keeps Kimi operations when valid', () => {
    const patch = normalizeMatchStartPatch({
      decision: 'apply',
      reasonCode: 'baseline',
      headline: 'Opening salvo',
      patchNote: 'Feint left, grab meter.',
      operations: [
        { kind: 'SET_AGGRESSION', value: 0.71 },
        { kind: 'SET_PRESSURE', value: 0.66 },
      ],
    })
    expect(patch?.operations).toEqual([
      { kind: 'SET_AGGRESSION', value: 0.71 },
      { kind: 'SET_PRESSURE', value: 0.66 },
    ])
  })
})

describe('normalizeModelPatch', () => {
  it('dedupes habit patches already applied', () => {
    const patch = normalizeModelPatch(
      { ...telemetry, appliedReasonCodes: ['rush'] },
      {
        decision: 'apply',
        reasonCode: 'rush',
        headline: 'x',
        patchNote: 'y',
        operations: [{ kind: 'SET_AGGRESSION', value: 0.8 }],
      },
    )
    expect(patch?.decision).toBe('hold')
  })
})