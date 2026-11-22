import type { Control, ControlName } from '../game/touch'
import type { HabitCode, PatchOperation, RivalTuning } from './types'

type BrainFighter = {
  x: number
  grounded: boolean
  state: string
  facing: number
  meter: number
  controls: Record<ControlName, Control>
  currentAttack: string | null
}

const CONTROL_NAMES: ControlName[] = ['left', 'right', 'up', 'down', 'block', 'light', 'heavy', 'kick']

export const DEFAULT_TUNING: RivalTuning = {
  aggression: 0.58,
  pressure: 0.72,
  throwBias: 0.24,
}

const INSTANT_COUNTERS: Record<Exclude<HabitCode, 'neutral'>, PatchOperation[]> = {
  corner_hide: [
    { kind: 'SET_PRESSURE', value: 0.82 },
    { kind: 'SET_AGGRESSION', value: 0.54 },
  ],
  block_spam: [
    { kind: 'SET_THROW_BIAS', value: 0.42 },
    { kind: 'SET_AGGRESSION', value: 0.48 },
  ],
  retreat: [{ kind: 'SET_PRESSURE', value: 0.78 }],
  rush: [
    { kind: 'SET_AGGRESSION', value: 0.62 },
    { kind: 'SET_PRESSURE', value: 0.68 },
  ],
}

type OpenerStyle = 'blitz' | 'poke' | 'leap' | 'grapple' | 'mix' | 'overdrive' | 'shockwave'

export type RivalRoundBoost = {
  bonusMeter?: number
}

const SUPER_METER = 100
const SPECIAL_METER = 25

export class RivalBrain {
  tuning: RivalTuning = { ...DEFAULT_TUNING }
  private actionCooldown = 0
  private antiRush = false
  private openingMs = 0
  private opener: OpenerStyle = 'mix'
  private openerUsed = false
  /** Lower = trades through block-spam more often (harder to survive on 1 HP). */
  private blockDiscipline = 0.55
  private consecutiveBlocks = 0
  private foeAttackChain = 0

  warmupFromMemory(tricks: HabitCode[]): void {
    for (const trick of tricks) {
      if (trick === 'neutral') continue
      this.applyInstantCounter(trick, 0.65)
    }
  }

  /** Fresh aggression profile each round so opens do not feel scripted. */
  beginRound(roundNumber = 1): RivalRoundBoost | undefined {
    this.actionCooldown = 0
    this.consecutiveBlocks = 0
    this.foeAttackChain = 0
    this.openerUsed = false
    this.openingMs = 340 + Math.random() * 620
    this.opener = pickOpener()
    this.blockDiscipline = 0.24 + Math.random() * 0.36

    const j = () => 0.88 + Math.random() * 0.28
    const roundSpice = roundNumber === 1 ? 0.08 : 0.04
    this.tuning = {
      aggression: clamp(this.tuning.aggression * j() + 0.06 + roundSpice, 0.42, 0.96),
      pressure: clamp(this.tuning.pressure * j() + 0.07 + roundSpice, 0.48, 0.98),
      throwBias: clamp(this.tuning.throwBias * j() + Math.random() * 0.14, 0.12, 0.62),
    }

    let boost: RivalRoundBoost | undefined
    if (roundNumber === 1) {
      const cheat = Math.random()
      if (cheat < 0.2) {
        this.opener = 'overdrive'
        this.openingMs += 180
        boost = { bonusMeter: SUPER_METER }
      } else if (cheat < 0.34) {
        this.opener = 'shockwave'
        boost = { bonusMeter: SPECIAL_METER }
      } else if (cheat < 0.42) {
        this.opener = pickOpener()
        boost = { bonusMeter: 40 + Math.floor(Math.random() * 35) }
      }
    } else if (Math.random() < 0.14) {
      boost = { bonusMeter: 25 + Math.floor(Math.random() * 40) }
    }

    return boost
  }

  applyInstantCounter(habit: HabitCode, strength = 1): void {
    if (habit === 'neutral') return
    const ops = INSTANT_COUNTERS[habit]
    if (!ops) return
    this.applyOperations(
      ops.map((op) => ({
        ...op,
        value: clamp(op.value * strength, 0.2, 0.95),
      })),
    )
    if (habit === 'rush') this.antiRush = true
    if (habit === 'block_spam') {
      this.blockDiscipline = Math.min(this.blockDiscipline, 0.32)
      this.tuning.throwBias = Math.max(this.tuning.throwBias, 0.38)
    }
  }

  applyOperations(ops: PatchOperation[]): void {
    for (const op of ops) {
      if (op.kind === 'SET_AGGRESSION') this.tuning.aggression = clamp(op.value, 0.25, 0.95)
      if (op.kind === 'SET_PRESSURE') this.tuning.pressure = clamp(op.value, 0.2, 0.95)
      if (op.kind === 'SET_THROW_BIAS') this.tuning.throwBias = clamp(op.value, 0.05, 0.65)
    }
  }

  tick(self: BrainFighter, foe: BrainFighter, dt: number): void {
    this.clearFrameInputs(self)

    if (self.state === 'ko' || self.state === 'victory' || self.state === 'hit' || self.state === 'knockdown' || self.state === 'wake') {
      return
    }
    if (self.state === 'attack') return

    const dist = Math.abs(self.x - foe.x)
    const toward: ControlName = foe.x > self.x ? 'right' : 'left'
    const away: ControlName = toward === 'right' ? 'left' : 'right'
    const idealGap = 48 + (1 - this.tuning.pressure) * 42

    if (foe.state === 'attack') {
      this.foeAttackChain = Math.min(12, this.foeAttackChain + dt * 0.02)
    } else {
      this.foeAttackChain = Math.max(0, this.foeAttackChain - dt * 0.015)
    }

    if (this.openingMs > 0) {
      this.openingMs -= dt
      this.runOpening(self, foe, dist, toward)
      this.actionCooldown -= dt
      return
    }

    const foeSwinging = foe.state === 'attack'
    const inThreatRange = dist < (this.antiRush ? 128 : 118)
    const blockSpam = this.consecutiveBlocks >= 2 || this.foeAttackChain > 4
    const wantsBlock =
      foeSwinging &&
      inThreatRange &&
      !blockSpam &&
      Math.random() < this.blockDiscipline * (foe.currentAttack === 'heavy' || foe.currentAttack === 'kick' ? 1.15 : 0.72)

    if (wantsBlock) {
      this.hold(self, 'block')
      this.consecutiveBlocks += 1
      if (blockSpam || (dist < 88 && Math.random() < 0.2 + this.tuning.aggression * 0.35)) {
        this.breakGuard(self, dist)
      }
      this.actionCooldown -= dt
      return
    }

    if (foeSwinging && inThreatRange && blockSpam) {
      this.consecutiveBlocks = 0
      if (dist < 95 && this.actionCooldown <= 0) {
        this.breakGuard(self, dist)
        this.actionCooldown = 120 + Math.random() * 80
        return
      }
    }

    this.consecutiveBlocks = 0

    if (dist > idealGap + 12) {
      this.hold(self, toward)
      if (self.grounded && this.tuning.pressure > 0.58 && dist > 130 && Math.random() < 0.035) {
        this.tap(self, 'up')
      }
      if (dist < 108 && this.actionCooldown <= 0 && Math.random() < this.tuning.aggression * 0.55) {
        this.pressureAttack(self, foe, dist)
        this.actionCooldown = this.cooldownAfterAttack()
      }
    } else if (dist < idealGap - 22) {
      this.hold(self, away)
    }

    this.actionCooldown -= dt
    if (dist > 102 || this.actionCooldown > 0) return

    const idleFoe = foe.state === 'idle' || foe.state === 'walk' || foe.state === 'crouch'
    const attackBias = idleFoe ? 0.72 : 0.38
    if (Math.random() > this.tuning.aggression * attackBias) return

    this.pressureAttack(self, foe, dist)
    this.actionCooldown = this.cooldownAfterAttack()
  }

  private runOpening(self: BrainFighter, foe: BrainFighter, dist: number, toward: ControlName): void {
    this.hold(self, toward)

    if (this.actionCooldown > 0) return

    if (dist > 105) {
      if (this.opener === 'leap' && self.grounded && Math.random() < 0.12) {
        this.tap(self, 'up')
      }
      return
    }

    if (this.opener === 'overdrive' && self.meter >= SUPER_METER && dist < 240) {
      this.openerUsed = true
      this.comboSuper(self)
      this.actionCooldown = 180 + Math.random() * 120
      return
    }

    if (this.opener === 'shockwave' && self.meter >= SPECIAL_METER && dist < 200) {
      this.openerUsed = true
      this.comboSpecial(self)
      this.actionCooldown = 140 + Math.random() * 100
      return
    }

    if (!this.openerUsed || Math.random() < 0.55) {
      this.openerUsed = true
      switch (this.opener) {
        case 'blitz':
          this.tap(self, Math.random() < 0.55 ? 'light' : 'heavy')
          break
        case 'poke':
          this.tap(self, Math.random() < 0.7 ? 'kick' : 'light')
          break
        case 'leap':
          if (self.grounded) this.tap(self, 'up')
          this.tap(self, 'kick')
          break
        case 'grapple':
          if (dist < 92) this.comboThrow(self)
          else this.tap(self, 'heavy')
          break
        case 'overdrive':
        case 'shockwave':
          this.pressureAttack(self, foe, dist)
          break
        default:
          this.pressureAttack(self, foe, dist)
      }
      this.actionCooldown = 70 + Math.random() * 110
    } else if (dist < 90) {
      this.pressureAttack(self, foe, dist)
      this.actionCooldown = 90 + Math.random() * 100
    }
  }

  private breakGuard(self: BrainFighter, dist: number): void {
    const roll = Math.random()
    if (dist < 88 && roll < this.tuning.throwBias + 0.25) {
      this.comboThrow(self)
    } else if (roll < 0.55) {
      this.tap(self, 'heavy')
    } else if (roll < 0.8) {
      this.tap(self, 'kick')
    } else {
      this.tap(self, 'light')
    }
  }

  private pressureAttack(self: BrainFighter, foe: BrainFighter, dist: number): void {
    const roll = Math.random()
    if (
      self.meter >= SUPER_METER &&
      dist > 65 &&
      dist < 250 &&
      roll < 0.1 + this.tuning.aggression * 0.14
    ) {
      this.comboSuper(self)
      return
    }
    if (
      self.meter >= SPECIAL_METER &&
      dist > 72 &&
      dist < 210 &&
      roll < 0.08 + this.tuning.aggression * 0.1
    ) {
      this.comboSpecial(self)
      return
    }
    if (dist < 86 && roll < this.tuning.throwBias) {
      this.comboThrow(self)
    } else if (foe.state === 'block' && self.meter >= 25 && roll < 0.42) {
      this.comboSpecial(self)
    } else if (foe.state === 'block' && dist < 92 && roll < 0.55 + this.tuning.throwBias) {
      this.comboThrow(self)
    } else if (roll < 0.4) {
      this.tap(self, 'light')
    } else if (roll < 0.72) {
      this.tap(self, 'kick')
    } else {
      this.tap(self, 'heavy')
    }
  }

  private cooldownAfterAttack(): number {
    const base = 145 + Math.random() * 120
    return Math.max(65, base * (1.05 - this.tuning.aggression * 0.42))
  }

  private clearFrameInputs(fighter: BrainFighter): void {
    for (const name of CONTROL_NAMES) {
      const control = fighter.controls[name]
      control.touchDown = false
      control.touchJust = false
    }
  }

  private hold(fighter: BrainFighter, name: ControlName): void {
    fighter.controls[name].touchDown = true
  }

  private tap(fighter: BrainFighter, name: ControlName): void {
    fighter.controls[name].touchDown = true
    fighter.controls[name].touchJust = true
  }

  private comboSpecial(fighter: BrainFighter): void {
    fighter.controls.block.touchDown = true
    fighter.controls.light.touchDown = true
    fighter.controls.light.touchJust = true
  }

  private comboThrow(fighter: BrainFighter): void {
    fighter.controls.block.touchDown = true
    fighter.controls.heavy.touchDown = true
    fighter.controls.heavy.touchJust = true
  }

  private comboSuper(fighter: BrainFighter): void {
    fighter.controls.block.touchDown = true
    fighter.controls.kick.touchDown = true
    fighter.controls.kick.touchJust = true
  }
}

function pickOpener(): OpenerStyle {
  const styles: OpenerStyle[] = ['blitz', 'poke', 'leap', 'grapple', 'mix']
  return styles[Math.floor(Math.random() * styles.length)]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}