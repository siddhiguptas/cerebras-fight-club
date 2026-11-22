import type { HabitCode, MatchMemoryPayload, RoundSnapshot } from './types'

export class MatchMemory {
  private rounds: RoundSnapshot[] = []
  private notes: string[] = []

  clear(): void {
    this.rounds = []
    this.notes = []
  }

  rememberPatchNote(note: string): void {
    if (!note.trim()) return
    this.notes.push(note.trim())
    if (this.notes.length > 8) this.notes.shift()
  }

  recordRoundEnd(round: number, habits: HabitCode[], patches: string[], winner: 'p1' | 'p2' | 'draw'): void {
    this.rounds.push({ round, habits, patches, winner })
  }

  toPayload(roundNumber: number): MatchMemoryPayload {
    const trickSet = new Set<HabitCode>()
    for (const snapshot of this.rounds) {
      for (const habit of snapshot.habits) {
        if (habit !== 'neutral') trickSet.add(habit)
      }
    }
    return {
      roundNumber,
      priorRounds: [...this.rounds],
      rememberedTricks: [...trickSet],
      patchNotes: [...this.notes],
    }
  }
}