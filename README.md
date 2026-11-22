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

You fight a bot locally every frame. Kimi does not steer every button press. It changes **how aggressive, how hard they pressure, and how often they throw** — and can respond to complaints from the in-game dev box.

---

## How it works

```
Browser (Phaser)
  → telemetry (position, block rate, rush, etc.)
  → Node backend (/rival-patch, /rival-complaint)
  → OpenClaw Gateway → openclaw agent (CLI harness)
  → Kimi K3.1 Pro on Cerebras (moonshotai-kimi-k3.1-pro-trial)
  → JSON patch (SET_AGGRESSION | SET_PRESSURE | SET_THROW_BIAS)
  → validated + applied to RivalBrain
```

**Two layers**

1. **RivalBrain (local)** — moves, blocks, and attacks every frame so the fight stays responsive.
2. **Game Master (Kimi via OpenClaw)** — reads compact telemetry and returns a small patch. When a habit is detected quickly, the rival gets an immediate counter-tune, then Kimi’s formal patch and note follow.

**Between rounds**, the game stores habits and patch history. Round two sends `matchMemory` to Kimi so the rival can prep for tricks you already used.

**Latency:** Each patch uses a **fresh OpenClaw session** (avoids bloated main-session context). Optional `OPENCLAW_TRANSPORT=exec` is an embedded OpenClaw fallback without Gateway — still the OpenClaw harness, but use **Gateway for demos**.

---

## Prerequisites

Before you run the full stack:

1. **Node.js 20+** and npm
2. **Cerebras Cloud** account and **API key** (hackathon access to Kimi K3.1 Pro trial)
3. **OpenClaw** installed and on your PATH ([OpenClaw docs](https://docs.openclaw.ai/))
4. OpenClaw configured to call **Cerebras** with `CEREBRAS_API_KEY` in your environment (same key as this app’s `.env`)

You do **not** need OpenClaw to open the game UI, but you **do** need **Gateway + server + OpenClaw** for live Kimi patch notes and complaints.

---

## Setup

```bash
cd fighting-game
cp .env.example .env
```

Edit `.env`:

- Set `CEREBRAS_API_KEY` (never commit `.env`)
- Set `OPENCLAW_BIN` if `openclaw` is not already on PATH
- Leave **`OPENCLAW_TRANSPORT=gateway`** unless you know you want the exec fallback

```bash
npm install
```

Quick checks:

```bash
openclaw --version
# Ensure Kimi trial is available via OpenClaw + Cerebras (per your hackathon access)
```

---

## Run (default — OpenClaw Gateway)

Use **three terminals** (order matters: gateway first):

```bash
npm run gateway   # OpenClaw Gateway on :18789 (required for default transport)
npm run server    # Patch API on :8787 — spawns openclaw agent per request
npm run dev       # Game on http://127.0.0.1:5173
```

**Verify**

```bash
curl -s http://localhost:8787/health | python3 -m json.tool
```

Expect `harness: "openclaw"`, `transport: "gateway"`, and `model` containing `cerebras/moonshotai-kimi-k3.1-pro-trial`. In-game header should show **Kimi live**.

Fight for a few seconds, repeat a habit (rush, corner, block), or send a **complaint** in the panel — you should see a patch card when Kimi returns `apply`.

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
| `RIVAL_PORT` | API port (default 8787) |
| `VITE_RIVAL_API` | Optional API URL for remote client |

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