import { z } from 'zod'

const habitEnum = z.enum(['neutral', 'corner_hide', 'block_spam', 'retreat', 'rush'])

const matchMemorySchema = z.object({
  roundNumber: z.number(),
  priorRounds: z.array(
    z.object({
      round: z.number(),
      habits: z.array(habitEnum),
      patches: z.array(z.string()),
      winner: z.enum(['p1', 'p2', 'draw']),
    }),
  ),
  rememberedTricks: z.array(habitEnum),
  patchNotes: z.array(z.string()),
})

export const telemetrySchema = z.object({
  sessionId: z.string(),
  sampleSeconds: z.number(),
  cornerShare: z.number(),
  blockShare: z.number(),
  retreatShare: z.number(),
  rushShare: z.number(),
  attackRate: z.number().default(0),
  habits: z.array(habitEnum),
  p1Health: z.number(),
  p2Health: z.number(),
  roundTime: z.number(),
  roundNumber: z.number().default(1),
  patchCount: z.number(),
  complaintCount: z.number().default(0),
  appliedReasonCodes: z.array(z.string()).default([]),
  tuning: z.object({
    aggression: z.number(),
    pressure: z.number(),
    throwBias: z.number(),
  }),
  matchMemory: matchMemorySchema.default({
    roundNumber: 1,
    priorRounds: [],
    rememberedTricks: [],
    patchNotes: [],
  }),
})

export const complaintSchema = telemetrySchema.extend({
  complaint: z.string().min(1).max(280),
})

/** New match — Kimi drafts rival tuning before round 1 (OpenClaw + Cerebras). */
export const matchStartSchema = z.object({
  sessionId: z.string(),
  p1Fighter: z.string().min(1).max(32),
  p2Fighter: z.string().min(1).max(32),
})