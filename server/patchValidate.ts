import { z } from 'zod'
import type { z as zod } from 'zod'
import type { telemetrySchema } from './schemaTypes.js'
import type { PatchResponse } from './patchLogic.js'

type Telemetry = zod.infer<typeof telemetrySchema>

const opSchema = z.object({
  kind: z.enum(['SET_AGGRESSION', 'SET_PRESSURE', 'SET_THROW_BIAS']),
  value: z.number().min(0).max(1),
})

export const patchProposalSchema = z.object({
  decision: z.enum(['apply', 'hold']),
  reasonCode: z.string(),
  headline: z.string(),
  patchNote: z.string(),
  operations: z.array(opSchema),
})

export function normalizeModelPatch(telemetry: Telemetry, raw: unknown): PatchResponse | null {
  const parsed = patchProposalSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error('Model response failed validation')
  }

  const patch = parsed.data
  if (patch.decision === 'hold') {
    return patch
  }

  if (telemetry.patchCount >= 5 && !patch.reasonCode.startsWith('complaint')) {
    return {
      decision: 'hold',
      reasonCode: 'neutral',
      headline: '',
      patchNote: '',
      operations: [],
    }
  }

  if (
    !patch.reasonCode.startsWith('complaint') &&
    telemetry.appliedReasonCodes.includes(patch.reasonCode)
  ) {
    return {
      decision: 'hold',
      reasonCode: 'neutral',
      headline: '',
      patchNote: '',
      operations: [],
    }
  }

  return patch
}

/** Match bootstrap — always accept Kimi loadout ops (no habit dedupe). */
export function normalizeMatchStartPatch(raw: unknown): PatchResponse | null {
  const parsed = patchProposalSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error('Model response failed validation')
  }
  const patch = parsed.data
  if (patch.decision === 'hold' || patch.operations.length === 0) {
    return {
      decision: 'apply',
      reasonCode: 'baseline',
      headline: patch.headline || 'Rival boot',
      patchNote: patch.patchNote || 'Kimi drafted a neutral opening loadout.',
      operations:
        patch.operations.length > 0
          ? patch.operations
          : [
              { kind: 'SET_AGGRESSION', value: 0.52 },
              { kind: 'SET_PRESSURE', value: 0.58 },
              { kind: 'SET_THROW_BIAS', value: 0.22 },
            ],
    }
  }
  return { ...patch, decision: 'apply', reasonCode: patch.reasonCode || 'baseline' }
}