# Rival Patch — architecture (judges / README companion)

## Hackathon stack (required)

| Piece | Role |
|-------|------|
| **OpenClaw** | Harness — every AI decision is `openclaw agent` → Gateway (default) |
| **Kimi K3.1 Pro** | Model `moonshotai-kimi-k3.1-pro-trial` on **Cerebras** |
| **Node `/health`** | Reports `harness: openclaw`, `model: cerebras/moonshotai-kimi-k3.1-pro-trial` |

There is **no mock Kimi path** on live endpoints. If OpenClaw/Cerebras is down, patches fail visibly (`AI error` / 503).

---

## Who controls the AI rival?

**Kimi owns the brain knobs.** The rival’s strategic behavior is defined by three live-tuned values:

- `aggression`
- `pressure`
- `throwBias`

Kimi sets and updates these through JSON patches validated on the server. Nothing in the client hardcodes a full opponent script or match outcome.

**`RivalBrain` (client)** is only a **frame executor**: given those knobs, it presses buttons (move, block, attack) at 60fps so the fight stays playable. It does **not** replace Kimi; comments in `src/ai/rivalBrain.ts` state this explicitly.

---

## Match lifecycle (every playthrough)

```
Character select (you pick fighter, rival = random ≠ you)
    → POST /rival-match-start (OpenClaw + Kimi) — draft opening loadout
    → Round 1 intro / fight
        → telemetry + POST /rival-patch (habit counters)
        → optional POST /rival-complaint
    → Round ends → MatchMemory records habits + patch notes
    → Round 2+ intro
        → memory sent to Kimi → round-plan patch
        → fight with recalled tricks
    → Match over → full reset (new session id, memory cleared, new random rival, new Kimi loadout)
```

Each match gets:

- New `sessionId`
- New random **P2 character** (never the same asset as P1)
- A **fresh OpenClaw session** per Kimi call (no bloated main chat)
- Clean **MatchMemory** after the set

---

## API surface

| Endpoint | When | Kimi via OpenClaw |
|----------|------|-------------------|
| `GET /health` | Probe | metadata only |
| `POST /rival-match-start` | ENTER on character select | **Yes** — bootstrap tuning |
| `POST /rival-patch` | Mid-round habits | **Yes** |
| `POST /rival-complaint` | Player dev complaint | **Yes** |

Code entrypoints:

- Server: `server/openclawGameMaster.ts`, `server/index.ts`
- Client: `src/ai/patchClient.ts`, `src/game/FightScene.ts`

---

## What is *not* “preset AI”

- No canned patch list served to the client in production (`server/index.ts` only calls `decidePatchWithOpenClaw` / `decideMatchStartWithOpenClaw`).
- Instant reflex tweaks on habit detection only **mirror** what Kimi is about to formalize; they read the same tuning knobs Kimi owns.
- `server/patchLogic.ts` exists for **unit tests** of policy, not for live inference.

---

## Cerebras overload (429)

When Kimi returns **429** or rate-limit errors through OpenClaw:

- API responds with **`429`**, `code: "rate_limit"`, and `retryAfterMs` (not a silent failure).
- Server retries **once** after a short jittered delay, then surfaces the error.
- Client shows **Cerebras busy**, **skips** new Kimi calls until backoff ends, and **still runs the fight** (local `RivalBrain` + habit reflex). No fake Kimi patches.

Patch polling gaps are slightly wider by default to reduce RPM pressure during hackathon load.

---

## Operational checks (before judging)

1. **One gateway only** — `openclaw gateway stop`, then `npm run gateway` (duplicate gateways cause hung Kimi calls).
2. **Restart `npm run server`** after backend changes (e.g. adding `/rival-match-start`); stale process = 404 on new routes.
3. `GET /health` → `harness: openclaw`, `model: cerebras/moonshotai-kimi-k3.1-pro-trial`.
4. `npm test` (policy + validation) and `npm run build` (client + server types).
5. `npm run test:api` with gateway + server up (live Kimi; allow ~90s per call).

## What is honestly “local” vs Kimi

| Behavior | Source |
|----------|--------|
| Match loadout, habit patches, complaints, round memory | **Kimi via OpenClaw** (`openclawGameMaster.ts`) |
| Knobs `aggression` / `pressure` / `throwBias` | Applied from Kimi JSON (`rivalBrain.applyOperations`) |
| Frame movement / blocking / attacking | **RivalBrain** executor (required at 60fps) |
| Brief habit reflex before patch card | `INSTANT_COUNTERS` mirrors pending habit (same knobs Kimi owns) |
| Invalid empty Kimi match-start JSON | Server `normalizeMatchStartPatch` supplies a neutral triple (last resort only) |

---

## Demo script (60s)

1. Show `/health` → OpenClaw + Kimi model id.
2. Select fighter; point at “Kimi drafting rival…” → match-start patch card.
3. Fight; show habit patch note arriving mid-round (latency on card).
4. Lose/win round 2 → “memory loaded” + different counters.
5. Return to select → new rival silhouette + new loadout on next ENTER.