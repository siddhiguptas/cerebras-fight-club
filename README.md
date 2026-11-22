# Rival Patch

A retro pixel fighter where you play Player 1 and the rival is controlled by AI. While you fight, the game watches how you play and **patches the rival in real time** — tuned by **Kimi K3.1 Pro on Cerebras** through **OpenClaw**.

Built for the **Cerebras × Kimi K3.1 Pro × OpenClaw Weekend Hackathon** (#KimiOnCerebras).

**By Siddhi Gupta**

- LinkedIn: [linkedin.com/in/siddhiguptas](https://linkedin.com/in/siddhiguptas)
- X: [x.com/siddhiguptas](https://x.com/siddhiguptas)
- GitHub: [github.com/siddhiguptas](https://github.com/siddhiguptas)

---

## Hackathon requirements (this project)

| Requirement | How Rival Patch satisfies it |
|-------------|------------------------------|
| **OpenClaw harness** (required) | Every patch runs `openclaw agent` via **OpenClaw Gateway** by default (`npm run gateway` + `OPENCLAW_TRANSPORT=gateway`). No mock LLM path in production. |
| **Kimi K3.1 Pro on Cerebras** (central) | Model `moonshotai-kimi-k3.1-pro-trial` through OpenClaw as `cerebras/moonshotai-kimi-k3.1-pro-trial`, using your **Cerebras API key**. |
| **Speed in the UX** | Fight stays on local AI; Kimi returns patch JSON in ~few seconds (fresh OpenClaw session per patch) while you are still in the round. |

Model id from the hackathon brief: **`moonshotai-kimi-k3.1-pro-trial`**.

---

## Why this exists

Most AI demos are chat or search. Rival Patch puts inference **inside a game loop**: your habits become telemetry, Kimi decides counter-patches, and the rival’s behavior changes **during the same match** — with patch notes that read like a live developer pushing hotfixes.

Speed matters. If the model takes too long, the joke dies. **Cerebras inference** keeps Kimi turns fast enough that patches can land while you are still fighting.

---

## What makes it different

| Typical idea | Rival Patch |
|--------------|-------------|
| Static AI opponent | Rival tuned every few seconds from your patterns |
| Difficulty slider | Patches target **your** habit (corner, block spam, rush, retreat) |
| One-shot LLM reply | **OpenClaw harness** runs each decision as a real agent turn |
| Match resets knowledge | **Match memory** carries tricks from prior rounds into the next |

Kimi owns the rival’s **brain knobs** (`aggression`, `pressure`, `throwBias`) — not a canned combo script. A local **RivalBrain** only executes frames (walk/block/attack) from those live values so the game stays 60fps.

Full judge-facing detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## How it works

```
Character select (A/D = your fighter; rival = random ≠ you)
  → POST /rival-match-start  (Kimi drafts opening loadout via OpenClaw)
  → Round 1 fight
  → telemetry → POST /rival-patch + /rival-complaint (OpenClaw → Kimi on Cerebras)
  → Round ends → MatchMemory (habits + patch notes)
  → Round 2+ Kimi round-plan patch with memory
  → Match over → reset (new session, new rival, new Kimi loadout)
```

```
Browser (Phaser)
  → Node :8787 (/rival-match-start, /rival-patch, /rival-complaint)
  → OpenClaw Gateway → openclaw agent
  → cerebras/moonshotai-kimi-k3.1-pro-trial
  → JSON SET_AGGRESSION | SET_PRESSURE | SET_THROW_BIAS
  → RivalBrain applies tuning; P2 sprite = random roster pick
```

**Two layers (honest split)**

1. **Kimi via OpenClaw (server)** — thinks each match: bootstrap loadout, habit counters, complaints, cross-round memory. **No client mock.**
2. **RivalBrain (client)** — reflex layer that reads Kimi’s knobs every frame (required for a fighting game loop).

**Every new match:** new telemetry `sessionId`, cleared memory, random opponent model (never same as P1), fresh Kimi **match-start** call so judges see inference before round 1.

**Latency:** Each patch uses a **fresh OpenClaw session** (avoids bloated main-session context). Optional `OPENCLAW_TRANSPORT=exec` is an embedded OpenClaw fallback without Gateway — still the OpenClaw harness, but use **Gateway for demos**.

---

## Prerequisites

| Item | Required for |
|------|----------------|
| **Node.js 20+** and npm | Game + patch API |
| **Cerebras Cloud** API key with **Kimi K3.1 Pro trial** access | OpenClaw → Cerebras + `npm run server` |
| **OpenClaw** CLI (desktop app or standalone install) | Hackathon harness — every Kimi decision |

Hackathon model id: **`moonshotai-kimi-k3.1-pro-trial`**  
OpenClaw model reference: **`cerebras/moonshotai-kimi-k3.1-pro-trial`**

You can open the **game UI** with `npm run dev` only. **Live rival brain** (match-start loadout, habit patches, complaints) needs **Gateway + server + dev** together.

---

## OpenClaw + Cerebras setup

Rival Patch does **not** call the Cerebras HTTP API directly. The Node server runs **`openclaw agent`** for each Kimi turn (match start, patches, complaints). Your Cerebras key must work inside **OpenClaw** and in **`fighting-game/.env`** (same key, never committed).

Official OpenClaw docs: [docs.openclaw.ai](https://docs.openclaw.ai/)

### Path A — You already have the OpenClaw app (recommended for hackathon)

If you installed OpenClaw, signed in, and already pointed it at **Cerebras** with hackathon Kimi access — **do not reinstall**. Wire this repo to that install:

1. **Find the CLI** the app installed (typical on macOS):

   ```bash
   ls -la ~/.openclaw/bin/openclaw
   openclaw --version
   ```

   If `openclaw` is not on PATH, use the full path in `.env` as `OPENCLAW_BIN`.

2. **Same Cerebras key everywhere**  
   Copy the key you use in the OpenClaw app into `fighting-game/.env`:

   ```bash
   cd fighting-game
   cp .env.example .env
   # edit CEREBRAS_API_KEY=...
   ```

   The server passes `CEREBRAS_API_KEY` into each `openclaw agent` child process. OpenClaw’s own config should also resolve Cerebras for that model.

3. **One Gateway only**  
   The OpenClaw app may already run a **Gateway** on port **18789**. Either:
   - **Use the app’s Gateway** — leave it running; skip `npm run gateway` in a second terminal, **or**
   - **Use the terminal Gateway** — quit/stop the app gateway, then run only `npm run gateway` here:

   ```bash
   openclaw gateway stop    # if you are unsure what is running
   npm run gateway          # from fighting-game/
   ```

   Do **not** run two gateways on the same state directory (Kimi calls will hang or fail).

4. **Prove Kimi works through OpenClaw** (before the game):

   With Gateway up (app or `npm run gateway`):

   ```bash
   export CEREBRAS_API_KEY="$(grep CEREBRAS_API_KEY fighting-game/.env | cut -d= -f2-)"
   openclaw agent --json --thinking off \
     --model cerebras/moonshotai-kimi-k3.1-pro-trial \
     --session-key "agent:main:smoke-$(uuidgen)" \
     --message "Reply with one word: OK" \
     --timeout 30
   ```

   You should get a JSON envelope and a short reply within ~30s. If this fails, fix OpenClaw + Cerebras before starting `npm run server`.

5. **Install game deps and run the stack** (see [Run](#run-default--openclaw-gateway) below).

### Path B — Fresh OpenClaw install

1. Install OpenClaw per [docs.openclaw.ai](https://docs.openclaw.ai/) (macOS/Linux).
2. Add Cerebras as a provider and confirm **`moonshotai-kimi-k3.1-pro-trial`** is enabled for your account ([Cerebras Cloud](https://cloud.cerebras.ai)).
3. Put `CEREBRAS_API_KEY` in `fighting-game/.env` and ensure OpenClaw can read the same key (environment or OpenClaw config — per OpenClaw docs).
4. Run the smoke command in **Path A step 4**.
5. Start Gateway → server → dev.

### What this repo expects (defaults)

| Setting | Value |
|---------|--------|
| `OPENCLAW_TRANSPORT` | `gateway` (hackathon standard) |
| Gateway port | **18789** (OpenClaw default) |
| Patch API | **8787** (`npm run server`) |
| Game | **5173** (`npm run dev`) |
| Per-turn model flag | `--model cerebras/moonshotai-kimi-k3.1-pro-trial` |
| Session | Fresh `agent:main:rival-<uuid>` per Kimi call |

Optional: `OPENCLAW_TRANSPORT=exec` runs `openclaw agent exec` without Gateway (still OpenClaw harness; demos should use **gateway**).

---

## Setup (project)

```bash
cd fighting-game
cp .env.example .env
npm install
```

Edit `.env`:

| Variable | What to set |
|----------|-------------|
| `CEREBRAS_API_KEY` | **Required** — same key as your working OpenClaw + Cerebras setup |
| `OPENCLAW_BIN` | Full path if `openclaw` is not on PATH (often `~/.openclaw/bin/openclaw`) |
| `OPENCLAW_TRANSPORT` | Leave **`gateway`** for judging / demos |
| `OPENCLAW_TIMEOUT` | Seconds per agent turn (default `28`) |
| `RIVAL_HTTP_TIMEOUT` | Optional; max wait for HTTP responses (default `55000` ms) |

Never commit `.env`.

---

## Run (default — OpenClaw Gateway)

Use **three terminals** when the OpenClaw app is **not** already providing Gateway. If the app keeps Gateway running, use **two terminals** (`server` + `dev` only).

```bash
# Terminal 1 — skip if OpenClaw app Gateway is already on :18789
npm run gateway

# Terminal 2 — restart after any server code change
npm run server

# Terminal 3
npm run dev
```

Open **http://127.0.0.1:5173**

### Verify backend + harness

```bash
curl -s http://localhost:8787/health | python3 -m json.tool
```

Expect:

- `harness`: `"openclaw"`
- `transport`: `"gateway"`
- `model`: `"cerebras/moonshotai-kimi-k3.1-pro-trial"`
- `hackathon.modelId`: `"moonshotai-kimi-k3.1-pro-trial"`

In-game panel: **Kimi live** (not “AI offline”).

### Verify live Kimi in the game

1. Character select — **A/D** picks your fighter; rival is **random and never the same** as you.
2. **ENTER** — UI shows **“Kimi … drafting rival brain”**, then a **MATCH START** patch card (OpenClaw round-trip).
3. Fight, repeat a habit (rush, corner, block), or use the complaint box — patch cards should update via the same path.

### Smoke test API (optional)

With Gateway + server running:

```bash
npm run test:api
```

Live tests call Kimi; allow up to ~90s per test. Policy/dedupe tests stay fast without Kimi.

---

## Troubleshooting (OpenClaw)

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| Panel **AI offline** | Server not running or wrong URL | `npm run server`, check `VITE_RIVAL_API` |
| **AI error** on match start | Gateway down, bad key, or model access | Run Path A step 4 smoke; fix `CEREBRAS_API_KEY` |
| Patches hang 60s+ | Two gateways or stuck OpenClaw | `openclaw gateway stop`, one `npm run gateway`, restart `npm run server` |
| `404` on `/rival-match-start` | Old server process | Kill port 8787, run `npm run server` again |
| **`429` / Cerebras rate limit** | Hackathon load + OpenClaw overhead | Panel shows **Cerebras busy**; match still runs on local reflex; Kimi calls back off automatically (`RIVAL_RATE_LIMIT_BACKOFF_MS`) |
| `503` / `504` timeout | Kimi slow or Gateway busy | Wait for cooldown; increase `OPENCLAW_TIMEOUT` / `RIVAL_HTTP_TIMEOUT` slightly |
| Works in app but not in game | `.env` key ≠ OpenClaw key | Align keys; restart server |

More architecture detail for judges: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## Play (game only)

| What | Command |
|------|---------|
| Fights, local rival AI | `npm run dev` only |
| Live Kimi patches | `gateway` + `server` + `dev` (above) |

- **You:** Player 1 (keyboard; touch overlay on mobile).
- **Rival:** AI + Kimi tuning mid-match and between rounds.
- **Header:** AI status and complaint box (same OpenClaw path).

---

## Environment

| Variable | Purpose |
|----------|---------|
| `CEREBRAS_API_KEY` | **Required** for server and OpenClaw → Cerebras Kimi K3.1 Pro |
| `OPENCLAW_BIN` | Path to `openclaw` CLI if not on PATH |
| `OPENCLAW_TRANSPORT` | **`gateway`** (default, hackathon demo) or `exec` (optional, no Gateway) |
| `OPENCLAW_CONFIG` | Used only when `OPENCLAW_TRANSPORT=exec` |
| `OPENCLAW_TIMEOUT` | Seconds per OpenClaw agent turn (default 28) |
| `RIVAL_HTTP_TIMEOUT` | Max milliseconds before API returns 503/504 (default 55000) |
| `RIVAL_RATE_LIMIT_BACKOFF_MS` | Hint to client after 429 (default 22000) |
| `RIVAL_RATE_LIMIT_RETRY_MS` | Server’s single Kimi retry delay after 429 (default 4000) |
| `RIVAL_PORT` | API port (default 8787) |
| `VITE_RIVAL_API` | Optional API URL when client talks to a remote Mac backend |

---

## Stack

- **Client:** Vite, TypeScript, Phaser 3
- **Server:** Node, Express, Zod
- **AI:** OpenClaw harness + Kimi K3.1 Pro on Cerebras
- **Game logic:** `src/ai/` (telemetry, rival brain, match memory)

---

## Tests

Live OpenClaw only — there is **no mock Kimi fallback** on `/rival-patch` or `/rival-complaint`.

```bash
npm test              # Patch policy unit tests
npm run test:api      # HTTP smoke (server + Gateway must be running)
npm run test:rival    # Playwright E2E
```

---

## Hackathon tags

Post demos with: `@Cerebras` `@Kimi_Moonshot` `#KimiOnCerebras`

---

## License

Hackathon project. Assets and engine code as included in this repository.