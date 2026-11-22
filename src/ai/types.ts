export type HabitCode = 'neutral' | 'corner_hide' | 'block_spam' | 'retreat' | 'rush'

export type RivalTuning = {
  aggression: number
  pressure: number
  throwBias: number
}

export type PatchOperation = {
  kind: 'SET_AGGRESSION' | 'SET_PRESSURE' | 'SET_THROW_BIAS'
  value: number
}

export type PatchProposal = {
  decision: 'apply' | 'hold'
  reasonCode: string
  headline: string
  patchNote: string
  operations: PatchOperation[]
  latencyMs?: number
}

export type RoundSnapshot = {
  round: number
  habits: HabitCode[]
  patches: string[]
  winner: 'p1' | 'p2' | 'draw'
}

export type MatchMemoryPayload = {
  roundNumber: number
  priorRounds: RoundSnapshot[]
  rememberedTricks: HabitCode[]
  patchNotes: string[]
}

export type TelemetryPayload = {
  sessionId: string
  sampleSeconds: number
  cornerShare: number
  blockShare: number
  retreatShare: number
  rushShare: number
  attackRate: number
  habits: HabitCode[]
  p1Health: number
  p2Health: number
  roundTime: number
  roundNumber: number
  patchCount: number
  complaintCount: number
  appliedReasonCodes: string[]
  tuning: RivalTuning
  matchMemory: MatchMemoryPayload
}