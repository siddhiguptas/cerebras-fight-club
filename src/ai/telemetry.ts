import type { HabitCode, MatchMemoryPayload, TelemetryPayload, RivalTuning } from './types'

type SampleFighter = {
  x: number
  health: number
  state: string
}

const ARENA_LEFT = 120
const ARENA_RIGHT = 840
const MIN_HABIT_SAMPLES = 12

export class FightTelemetry {
  readonly sessionId: string
  private samples = 0
  private corner = 0
  private blocking = 0
  private retreating = 0
  private rushing = 0
  private p1Attacks = 0
  private lastX = 0
  private hadLast = false

  constructor(sessionId = crypto.randomUUID()) {
    this.sessionId = sessionId
  }

  reset(): void {
    this.samples = 0
    this.corner = 0
    this.blocking = 0
    this.retreating = 0
    this.rushing = 0
    this.p1Attacks = 0
    this.hadLast = false
  }

  track(p1: SampleFighter, p2: SampleFighter): void {
    this.samples += 1
    if (p1.x <= ARENA_LEFT || p1.x >= ARENA_RIGHT) this.corner += 1
    if (p1.state === 'block') this.blocking += 1
    if (p1.state === 'attack') this.p1Attacks += 1

    if (this.hadLast) {
      const movedLeft = p1.x < this.lastX - 0.5
      const movedRight = p1.x > this.lastX + 0.5
      const awayFromP2 = p1.x < p2.x ? movedLeft : movedRight
      const towardP2 = p1.x < p2.x ? movedRight : movedLeft
      if (awayFromP2) this.retreating += 1
      if (towardP2 && p1.state === 'attack') this.rushing += 1
    }
    this.lastX = p1.x
    this.hadLast = true
  }

  habits(): HabitCode[] {
    if (this.samples < MIN_HABIT_SAMPLES) return ['neutral']
    const habits: HabitCode[] = []
    const n = this.samples
    const cornerShare = this.corner / n
    const blockShare = this.blocking / n
    const retreatShare = this.retreating / n
    const rushShare = this.rushing / n
    const attackRate = this.p1Attacks / n

    if (cornerShare >= 0.32) habits.push('corner_hide')
    if (blockShare >= 0.26) habits.push('block_spam')
    if (retreatShare >= 0.22) habits.push('retreat')
    if (rushShare >= 0.16 || attackRate >= 0.22) habits.push('rush')
    if (habits.length === 0) habits.push('neutral')
    return habits
  }

  pendingHabit(appliedReasonCodes: ReadonlySet<string>): HabitCode | null {
    if (this.samples < MIN_HABIT_SAMPLES) return null
    for (const habit of this.habits()) {
      if (habit === 'neutral') continue
      if (!appliedReasonCodes.has(habit)) return habit
    }
    return null
  }

  buildPayload(
    p1: SampleFighter,
    p2: SampleFighter,
    roundTime: number,
    roundNumber: number,
    patchCount: number,
    complaintCount: number,
    appliedReasonCodes: string[],
    tuning: RivalTuning,
    matchMemory: MatchMemoryPayload,
  ): TelemetryPayload {
    const n = Math.max(1, this.samples)
    return {
      sessionId: this.sessionId,
      sampleSeconds: n / 60,
      cornerShare: this.corner / n,
      blockShare: this.blocking / n,
      retreatShare: this.retreating / n,
      rushShare: this.rushing / n,
      attackRate: this.p1Attacks / n,
      habits: this.habits(),
      p1Health: p1.health,
      p2Health: p2.health,
      roundTime,
      roundNumber,
      patchCount,
      complaintCount,
      appliedReasonCodes,
      tuning,
      matchMemory,
    }
  }
}