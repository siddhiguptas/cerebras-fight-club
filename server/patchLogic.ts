import type { z } from 'zod'
import type { telemetrySchema } from './schemaTypes.js'

export type Telemetry = z.infer<typeof telemetrySchema>
export type HabitCode = Telemetry['habits'][number]

export type PatchResponse = {
  decision: 'apply' | 'hold'
  reasonCode: string
  headline: string
  patchNote: string
  operations: Array<{ kind: 'SET_AGGRESSION' | 'SET_PRESSURE' | 'SET_THROW_BIAS'; value: number }>
}

const HABIT_PATCHES: Record<Exclude<HabitCode, 'neutral'>, PatchResponse> = {
  corner_hide: {
    decision: 'apply',
    reasonCode: 'corner_hide',
    headline: 'v0.2 · Edge camper fix',
    patchNote: 'You hugged the corner. Rival pressure increased.',
    operations: [
      { kind: 'SET_PRESSURE', value: 0.84 },
      { kind: 'SET_AGGRESSION', value: 0.56 },
    ],
  },
  block_spam: {
    decision: 'apply',
    reasonCode: 'block_spam',
    headline: 'v0.3 · Shield tax',
    patchNote: 'Blocking every hit? Throws are patched in.',
    operations: [
      { kind: 'SET_THROW_BIAS', value: 0.45 },
      { kind: 'SET_AGGRESSION', value: 0.5 },
    ],
  },
  retreat: {
    decision: 'apply',
    reasonCode: 'retreat',
    headline: 'v0.4 · Backpedal nerf',
    patchNote: 'You keep running away. Chase logic buffed.',
    operations: [{ kind: 'SET_PRESSURE', value: 0.8 }],
  },
  rush: {
    decision: 'apply',
    reasonCode: 'rush',
    headline: 'v0.5 · Rush counter',
    patchNote: 'All-in detected. Rival defense tuned up.',
    operations: [{ kind: 'SET_AGGRESSION', value: 0.46 }],
  },
}

export function decidePatch(data: Telemetry): PatchResponse | null {
  if (data.patchCount >= 5) return null

  for (const habit of data.habits) {
    if (habit === 'neutral') continue
    if (data.appliedReasonCodes.includes(habit)) continue
    return { ...HABIT_PATCHES[habit] }
  }

  if (
    data.sampleSeconds > 12 &&
    data.patchCount === 0 &&
    data.appliedReasonCodes.length === 0
  ) {
    return {
      decision: 'apply',
      reasonCode: 'baseline',
      headline: 'v0.1 · Baseline tune',
      patchNote: 'Rival AI is now watching how you fight.',
      operations: [{ kind: 'SET_AGGRESSION', value: 0.5 }],
    }
  }

  return null
}

export function decideComplaint(data: Telemetry, complaint: string): PatchResponse | null {
  const text = complaint.trim().slice(0, 280)
  if (!text) return null
  if (data.complaintCount >= 3) {
    return {
      decision: 'apply',
      reasonCode: 'complaint_cap',
      headline: 'Ticket closed',
      patchNote: 'Complaint limit reached. The rival ignores you now.',
      operations: [],
    }
  }

  const lower = text.toLowerCase()
  const wantsEasier = /easy|unfair|hard|stop|cheat|broken/.test(lower)

  if (wantsEasier) {
    return {
      decision: 'apply',
      reasonCode: 'complaint_rejected',
      headline: 'Complaint denied',
      patchNote: `Request: "${text}" — denied. Rival aggression increased.`,
      operations: [
        { kind: 'SET_AGGRESSION', value: Math.min(0.92, data.tuning.aggression + 0.14) },
        { kind: 'SET_PRESSURE', value: Math.min(0.9, data.tuning.pressure + 0.08) },
      ],
    }
  }

  return {
    decision: 'apply',
    reasonCode: 'complaint_logged',
    headline: 'Feedback logged',
    patchNote: `We read: "${text}". Rival throw logic slightly buffed anyway.`,
    operations: [{ kind: 'SET_THROW_BIAS', value: Math.min(0.55, data.tuning.throwBias + 0.12) }],
  }
}