/**
 * Local frame executor for Player 2 (reflexes, movement, buttons).
 * Strategic knobs — aggression, pressure, throwBias — are owned by Kimi K3.1 Pro
 * on Cerebras via OpenClaw (/rival-match-start, /rival-patch); this class applies them.
 */
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
  aggression: 0.5,
  pressure: 0.62,
  throwBias: 0.22,
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
type AttackBias = 'striker' | 'kicker' | 'bruiser' | 'mixologist'
type StrikeButton = 'light' | 'heavy' | 'kick'

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
  private openerSpent = false
  private blockDiscipline = 0.55
  private consecutiveBlocks = 0
  private foeAttackChain = 0
  private attackBias: AttackBias = 'mixologist'
  /** Shifts mid-round cadence so patterns do not loop identically. */
  private moodFlipMs = 0

  warmupFromMemory(tricks: HabitCode[]): void {
    for (const trick of tricks) {
      if (trick === 'neutral') continue
      this.applyInstantCounter(trick, 0.65)
    }
  }

  beginRound(roundNumber = 1): RivalRoundBoost | undefined {
    this.actionCooldown = 0
    this.consecutiveBlocks = 0
    this.foeAttackChain = 0
    this.openerSpent = false
    this.openingMs = 280 + Math.random() * 720
    this.blockDiscipline = 0.22 + Math.random() * 0.38
    this.attackBias = pickAttackBias()
    this.moodFlipMs = 2200 + Math.random() * 3800

    const spice = roundNumber === 1 ? 0.06 : 0.05
    this.tuning = jitterTuning({ ...this.tuning }, spice)

    this.opener = pickOpener()

    let boost: RivalRoundBoost | undefined
    if (roundNumber === 1) {
      const cheat = Math.random()
      if (cheat < 0.18) {
        this.opener = 'overdrive'
        this.openingMs += 160 + Math.random() * 120
        boost = { bonusMeter: SUPER_METER }
      } else if (cheat < 0.32) {
        this.opener = 'shockwave'
        boost = { bonusMeter: SPECIAL_METER }
      } else if (cheat < 0.4) {
        boost = { bonusMeter: 35 + Math.floor(Math.random() * 40) }
      }
    } else if (Math.random() < 0.16) {
      boost = { bonusMeter: 22 + Math.floor(Math.random() * 45) }
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

    this.moodFlipMs -= dt
    if (this.moodFlipMs <= 0) {
      this.moodFlipMs = 2400 + Math.random() * 3200
      if (Math.random() < 0.55) this.attackBias = pickAttackBias()
      this.tuning.aggression = clamp(this.tuning.aggression + (Math.random() - 0.5) * 0.12, 0.35, 0.96)
    }

    const dist = Math.abs(self.x - foe.x)
    const toward: ControlName = foe.x > self.x ? 'right' : 'left'
    const away: ControlName = toward === 'right' ? 'left' : 'right'
    const idealGap = 44 + (1 - this.tuning.pressure) * 46

    if (foe.state === 'attack') {
      this.foeAttackChain = Math.min(12, this.foeAttackChain + dt * 0.02)
    } else {
      this.foeAttackChain = Math.max(0, this.foeAttackChain - dt * 0.015)
    }

    if (foe.state === 'hit' || foe.state === 'knockdown' || foe.state === 'wake') {
      this.respectFoeRecovery(self, dist, toward, away, dt)
      return
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
        this.actionCooldown = 110 + Math.random() * 110
        return
      }
    }

    this.consecutiveBlocks = 0

    if (dist > idealGap + 12) {
      this.hold(self, toward)
      if (self.grounded && this.tuning.pressure > 0.58 && dist > 130 && Math.random() < 0.04) {
        this.tap(self, 'up')
      }
      if (dist < 108 && this.actionCooldown <= 0 && Math.random() < this.tuning.aggression * 0.52) {
        this.pressureAttack(self, foe, dist)
        this.actionCooldown = this.cooldownAfterAttack()
      }
    } else if (dist < idealGap - 22) {
      this.hold(self, away)
    }

    this.actionCooldown -= dt
    if (dist > 102 || this.actionCooldown > 0) return

    const idleFoe = foe.state === 'idle' || foe.state === 'walk' || foe.state === 'crouch'
    const attackBias = idleFoe ? 0.58 : 0.32
    if (Math.random() > this.tuning.aggression * attackBias) return

    this.pressureAttack(self, foe, dist)
    this.actionCooldown = this.cooldownAfterAttack()
  }

  private respectFoeRecovery(
    self: BrainFighter,
    dist: number,
    toward: ControlName,
    away: ControlName,
    dt: number,
  ): void {
    this.actionCooldown = Math.max(this.actionCooldown, 380 + Math.random() * 340)
    if (dist < 92) {
      this.hold(self, away)
    } else if (dist > 135) {
      this.hold(self, toward)
    }
    this.actionCooldown -= dt
  }

  private runOpening(self: BrainFighter, foe: BrainFighter, dist: number, toward: ControlName): void {
    this.hold(self, toward)

    if (this.actionCooldown > 0) return

    if (dist > 112) {
      if (this.opener === 'leap' && self.grounded && Math.random() < 0.16) {
        this.tap(self, 'up')
      }
      return
    }

    if (this.openerSpent) return

    if (this.opener === 'overdrive' && self.meter >= SUPER_METER && dist < 240) {
      this.openerSpent = true
      this.comboSuper(self)
      this.actionCooldown = 170 + Math.random() * 130
      return
    }

    if (this.opener === 'shockwave' && self.meter >= SPECIAL_METER && dist < 210) {
      this.openerSpent = true
      this.comboSpecial(self)
      this.actionCooldown = 130 + Math.random() * 110
      return
    }

    this.openerSpent = true
    switch (this.opener) {
      case 'blitz':
        this.tap(self, this.weightedStrike(0.5, 0.25, 0.25))
        break
      case 'poke':
        this.tap(self, this.weightedStrike(0.42, 0.32, 0.26))
        break
      case 'leap':
        if (self.grounded && Math.random() < 0.75) this.tap(self, 'up')
        this.tap(self, Math.random() < 0.45 ? 'heavy' : 'kick')
        break
      case 'grapple':
        if (dist < 92) this.comboThrow(self)
        else this.tap(self, Math.random() < 0.6 ? 'heavy' : 'light')
        break
      case 'overdrive':
      case 'shockwave':
        this.pressureAttack(self, foe, dist)
        break
      default:
        this.tap(self, this.weightedStrike(0.38, 0.32, 0.3))
    }
    this.actionCooldown = 55 + Math.random() * 130
  }

  private breakGuard(self: BrainFighter, dist: number): void {
    const roll = Math.random()
    if (dist < 88 && roll < this.tuning.throwBias + 0.25) {
      this.comboThrow(self)
    } else {
      this.tap(self, this.weightedStrike(0.3, 0.38, 0.32))
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
    } else if (foe.state === 'block' && self.meter >= 25 && roll < 0.4) {
      this.comboSpecial(self)
    } else if (foe.state === 'block' && dist < 92 && roll < 0.52 + this.tuning.throwBias) {
      this.comboThrow(self)
    } else {
      this.tap(self, this.pickStrike())
    }
  }

  private pickStrike(): StrikeButton {
    switch (this.attackBias) {
      case 'striker':
        return this.weightedStrike(0.52, 0.22, 0.26)
      case 'kicker':
        return this.weightedStrike(0.28, 0.46, 0.26)
      case 'bruiser':
        return this.weightedStrike(0.26, 0.28, 0.46)
      default:
        return this.weightedStrike(0.36, 0.32, 0.32)
    }
  }

  private weightedStrike(light: number, kick: number, _heavy: number): StrikeButton {
    const roll = Math.random()
    if (roll < light) return 'light'
    if (roll < light + kick) return 'kick'
    return 'heavy'
  }

  private cooldownAfterAttack(): number {
    const base = 165 + Math.random() * 155
    return Math.max(72, base * (1.08 - this.tuning.aggression * 0.35))
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

function jitterTuning(base: RivalTuning, spice: number): RivalTuning {
  const j = () => 0.86 + Math.random() * 0.32
  return {
    aggression: clamp(base.aggression * j() + spice * Math.random(), 0.4, 0.96),
    pressure: clamp(base.pressure * j() + spice * Math.random(), 0.46, 0.98),
    throwBias: clamp(base.throwBias * j() + Math.random() * 0.12, 0.1, 0.62),
  }
}

function pickOpener(): OpenerStyle {
  const roll = Math.random()
  if (roll < 0.24) return 'blitz'
  if (roll < 0.44) return 'poke'
  if (roll < 0.58) return 'grapple'
  if (roll < 0.72) return 'leap'
  return 'mix'
}

function pickAttackBias(): AttackBias {
  const styles: AttackBias[] = ['striker', 'kicker', 'bruiser', 'mixologist']
  return styles[Math.floor(Math.random() * styles.length)]
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}