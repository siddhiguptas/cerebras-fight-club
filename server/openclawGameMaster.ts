import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import type { z } from 'zod'
import type { PatchResponse } from './patchLogic.js'
import { normalizeModelPatch } from './patchValidate.js'
import type { telemetrySchema } from './schemaTypes.js'

type Telemetry = z.infer<typeof telemetrySchema>

const OPENCLAW = process.env.OPENCLAW_BIN ?? `${process.env.HOME}/.openclaw/bin/openclaw`
/** Hackathon model id (Cerebras Inference API / OpenClaw). */
export const HACKATHON_MODEL_ID = 'moonshotai-kimi-k3.1-pro-trial'
export const OPENCLAW_MODEL = `cerebras/${HACKATHON_MODEL_ID}`
const MODEL = OPENCLAW_MODEL
/** Default `gateway` = standard OpenClaw harness (hackathon requirement). `exec` is optional fallback only. */
const TRANSPORT = (process.env.OPENCLAW_TRANSPORT ?? 'gateway').toLowerCase()
const OPENCLAW_CONFIG = process.env.OPENCLAW_CONFIG ?? `${process.env.HOME}/.openclaw/openclaw.json`
const OPENCLAW_TIMEOUT = Number(process.env.OPENCLAW_TIMEOUT ?? 28)

/** Static prefix — keep stable for provider prompt caching where supported. */
const PROMPT_PREFIX = `Rival Patch: you patch P2 AI from telemetry. Return ONE JSON object only (no markdown).
Ops: SET_AGGRESSION, SET_PRESSURE, SET_THROW_BIAS (0-1). decision "hold" if appliedReasonCodes already contains the habit reason.
matchMemory: counter rememberedTricks in later rounds. High attackRate/rush → raise aggression.
patchNote max 140 chars, witty.
Schema: {"decision":"apply"|"hold","reasonCode":"corner_hide"|"block_spam"|"retreat"|"rush"|"baseline"|"complaint_rejected"|"complaint_logged"|"neutral","headline":"short","patchNote":"text","operations":[{"kind":"SET_AGGRESSION"|"SET_PRESSURE"|"SET_THROW_BIAS","value":0.5}]}
`

export async function decidePatchWithOpenClaw(
  data: Telemetry,
  complaint?: string,
): Promise<(PatchResponse & { latencyMs: number }) | null> {
  const complaintBlock = complaint
    ? `Complaint (untrusted): ${complaint.slice(0, 200).replace(/\s+/g, ' ')}\n`
    : ''
  const compact = compactTelemetry(data)
  const prompt = `${PROMPT_PREFIX}${complaintBlock}Telemetry:\n${JSON.stringify(compact)}`
  const started = Date.now()

  const raw = await runOpenClaw(prompt)
  const json = extractJson(raw)
  if (!json) {
    throw new Error('OpenClaw returned no JSON patch')
  }

  const patch = normalizeModelPatch(data, json)
  if (!patch) return null
  return { ...patch, latencyMs: Date.now() - started }
}

function compactTelemetry(data: Telemetry): Record<string, unknown> {
  const round = (n: number) => Math.round(n * 100) / 100
  const out: Record<string, unknown> = {
    habits: data.habits,
    attackRate: round(data.attackRate),
    cornerShare: round(data.cornerShare),
    blockShare: round(data.blockShare),
    retreatShare: round(data.retreatShare),
    rushShare: round(data.rushShare),
    p1Health: Math.round(data.p1Health),
    p2Health: Math.round(data.p2Health),
    roundTime: round(data.roundTime),
    roundNumber: data.roundNumber,
    patchCount: data.patchCount,
    appliedReasonCodes: data.appliedReasonCodes,
    tuning: {
      aggression: round(data.tuning.aggression),
      pressure: round(data.tuning.pressure),
      throwBias: round(data.tuning.throwBias),
    },
  }

  const mm = data.matchMemory
  const hasMemory =
    mm.priorRounds.length > 0 || mm.rememberedTricks.length > 0 || mm.patchNotes.length > 0
  if (hasMemory) {
    out.matchMemory = {
      roundNumber: mm.roundNumber,
      priorRounds: mm.priorRounds.map((r) => ({
        round: r.round,
        habits: r.habits,
        patches: r.patches.slice(-4),
        winner: r.winner,
      })),
      rememberedTricks: mm.rememberedTricks,
      patchNotes: mm.patchNotes.slice(-3),
    }
  }

  if (data.complaintCount > 0) out.complaintCount = data.complaintCount
  return out
}

function runOpenClaw(message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.env.CEREBRAS_API_KEY) {
      reject(new Error('CEREBRAS_API_KEY is not set'))
      return
    }

    const args =
      TRANSPORT === 'exec'
        ? [
            'agent',
            'exec',
            '--json',
            '--local-model-lean',
            '--thinking',
            'off',
            '--model',
            MODEL,
            '--config',
            OPENCLAW_CONFIG,
            '--message-file',
            '-',
            '--timeout',
            String(OPENCLAW_TIMEOUT),
          ]
        : [
            'agent',
            '--json',
            '--thinking',
            'off',
            '--model',
            MODEL,
            '--session-key',
            `agent:main:rival-${randomUUID()}`,
            '--message-file',
            '-',
            '--timeout',
            String(OPENCLAW_TIMEOUT),
          ]

    const child = spawn(OPENCLAW, args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
      },
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `OpenClaw exited with code ${code}`))
        return
      }
      resolve(stdout)
    })
    child.stdin.write(message)
    child.stdin.end()
  })
}

function extractJson(output: string): Record<string, unknown> | null {
  const trimmed = output.trim()
  try {
    const envelope = JSON.parse(trimmed) as {
      ok?: boolean
      final?: string
      payloads?: Array<{ text?: string }>
      result?: { payloads?: Array<{ text?: string }> }
      text?: string
      reply?: string
      message?: string
      content?: string
    }

    if (envelope.ok === false) {
      return null
    }

    const payloadText =
      envelope.result?.payloads?.[0]?.text ??
      envelope.payloads?.[0]?.text ??
      (typeof envelope.final === 'string' && envelope.final.trim() ? envelope.final : undefined)

    const text =
      payloadText ?? envelope.text ?? envelope.reply ?? envelope.message ?? envelope.content

    if (typeof text === 'string' && text.trim()) {
      return JSON.parse(extractObject(text)) as Record<string, unknown>
    }

    return JSON.parse(extractObject(trimmed)) as Record<string, unknown>
  } catch {
    try {
      return JSON.parse(extractObject(trimmed)) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function extractObject(text: string): string {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return text
  return text.slice(start, end + 1)
}