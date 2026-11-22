import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import {
  decidePatchWithOpenClaw,
  HACKATHON_MODEL_ID,
  OPENCLAW_MODEL,
} from './openclawGameMaster.js'
import { complaintSchema, telemetrySchema } from './schemaTypes.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '64kb' }))

const port = Number(process.env.RIVAL_PORT ?? 8787)

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
  if (!proposal || proposal.decision !== 'apply') {
    res.json({ decision: 'hold', reasonCode: 'neutral', headline: '', patchNote: '', operations: [] })
    return
  }
  res.json({ ...proposal, latencyMs: proposal.latencyMs ?? Date.now() - started })
}

app.post('/rival-patch', async (req, res) => {
  const parsed = telemetrySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid telemetry', details: parsed.error.flatten() })
    return
  }

  const started = Date.now()
  try {
    const proposal = await decidePatchWithOpenClaw(parsed.data)
    await respondPatch(res, started, proposal)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'patch failed'
    res.status(503).json({ error: message })
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
    const proposal = await decidePatchWithOpenClaw(telemetry, complaint)
    await respondPatch(res, started, proposal)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'complaint failed'
    res.status(503).json({ error: message })
  }
})

app.listen(port, () => {
  console.log(`Rival Patch backend on http://localhost:${port}`)
  console.log(`Harness: OpenClaw (${transport}) · Model: ${OPENCLAW_MODEL}`)
  if (transport === 'gateway') {
    console.log('Start OpenClaw Gateway in another terminal: npm run gateway (port 18789)')
  }
})