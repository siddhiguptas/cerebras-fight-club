import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { jsonForInference } from './cerebrasErrors.js'
import {
  decideMatchStartWithOpenClaw,
  decidePatchWithOpenClaw,
  HACKATHON_MODEL_ID,
  OPENCLAW_MODEL,
} from './openclawGameMaster.js'
import { complaintSchema, matchStartSchema, telemetrySchema } from './schemaTypes.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '64kb' }))

const port = Number(process.env.RIVAL_PORT ?? 8787)
/** Upper bound so clients do not hang if Gateway/OpenClaw stalls (ms). */
const HTTP_OPENCLAW_MS = Number(process.env.RIVAL_HTTP_TIMEOUT ?? 55_000)

async function withHttpTimeout<T>(fn: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('OpenClaw request timed out')), HTTP_OPENCLAW_MS)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

if (!process.env.CEREBRAS_API_KEY) {
  console.error('CEREBRAS_API_KEY is required. Copy .env.example to .env and set your key.')
  process.exit(1)
}

const transport = (process.env.OPENCLAW_TRANSPORT ?? 'gateway').toLowerCase()

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    mode: 'live',
    harness: 'openclaw',
    hackathon: {
      kimiOnCerebras: true,
      modelId: HACKATHON_MODEL_ID,
      openclawHarness: true,
    },
    transport,
    provider: 'cerebras',
    model: OPENCLAW_MODEL,
    product: 'Rival Patch',
  })
})

async function respondPatch(
  res: express.Response,
  started: number,
  proposal: Awaited<ReturnType<typeof decidePatchWithOpenClaw>>,
) {
  if (!proposal) {
    res.json({ decision: 'hold', reasonCode: 'neutral', headline: '', patchNote: '', operations: [] })
    return
  }
  const latencyMs = proposal.latencyMs ?? Date.now() - started
  if (proposal.decision !== 'apply') {
    res.json({ ...proposal, latencyMs })
    return
  }
  res.json({ ...proposal, latencyMs })
}

app.post('/rival-match-start', async (req, res) => {
  const parsed = matchStartSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid match start', details: parsed.error.flatten() })
    return
  }

  const started = Date.now()
  try {
    const proposal = await withHttpTimeout(() => decideMatchStartWithOpenClaw(parsed.data))
    await respondPatch(res, started, proposal)
  } catch (error) {
    const { status, body } = jsonForInference(error)
    res.status(status).json(body)
  }
})

app.post('/rival-patch', async (req, res) => {
  const parsed = telemetrySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid telemetry', details: parsed.error.flatten() })
    return
  }

  const started = Date.now()
  try {
    const proposal = await withHttpTimeout(() => decidePatchWithOpenClaw(parsed.data))
    await respondPatch(res, started, proposal)
  } catch (error) {
    const { status, body } = jsonForInference(error)
    res.status(status).json(body)
  }
})

app.post('/rival-complaint', async (req, res) => {
  const parsed = complaintSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid complaint', details: parsed.error.flatten() })
    return
  }

  const started = Date.now()
  const { complaint, ...telemetry } = parsed.data
  try {
    const proposal = await withHttpTimeout(() => decidePatchWithOpenClaw(telemetry, complaint))
    await respondPatch(res, started, proposal)
  } catch (error) {
    const { status, body } = jsonForInference(error)
    res.status(status).json(body)
  }
})

app.listen(port, () => {
  console.log(`Rival Patch backend on http://localhost:${port}`)
  console.log(`Harness: OpenClaw (${transport}) · Model: ${OPENCLAW_MODEL}`)
  if (transport === 'gateway') {
    console.log('Start OpenClaw Gateway in another terminal: npm run gateway (port 18789)')
  }
})