# Rival Patch

A retro pixel fighter where you play Player 1 and the rival is controlled by AI. While you fight, the game watches how you play and **patches the rival in real time** — tuned by **Kimi K3.1 Pro on Cerebras** through **OpenClaw**.

Built for the **Cerebras x Kimi K3.1 Pro x OpenClaw Weekend Hackathon** (#KimiOnCerebras).

**By Siddhi Gupta**

- LinkedIn: [linkedin.com/in/siddhiguptas](https://linkedin.com/in/siddhiguptas)
- X: [x.com/siddhiguptas](https://x.com/siddhiguptas)
- GitHub: [github.com/siddhiguptas](https://github.com/siddhiguptas)

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
  → OpenClaw agent (Gateway)
  → Kimi K3.1 Pro on Cerebras
  → JSON patch (SET_AGGRESSION | SET_PRESSURE | SET_THROW_BIAS)
  → validated + applied to RivalBrain
```

**Two layers**

1. **RivalBrain (local)** — moves, blocks, and attacks every frame so the fight stays responsive.
2. **Game Master (Kimi via OpenClaw)** — reads a compact telemetry summary and returns a small patch. When a habit is detected quickly, the rival gets an immediate counter-tune, then Kimi’s formal patch and note follow.

**Between rounds**, the game stores habits and patch history. Round two sends `matchMemory` to Kimi so the rival can prep for tricks you already used.

**Model:** `cerebras/moonshotai-kimi-k3.1-pro-trial`  
**Harness:** OpenClaw Gateway + `openclaw agent` (hackathon requirement)

**Latency:** Each patch uses a **fresh OpenClaw session** (the default main session can grow to 17k+ tokens and stall for minutes). The server sends **compact telemetry**, `thinking off`, and optional `OPENCLAW_TRANSPORT=exec` for embedded runs without Gateway (~8s typical per patch vs 25–40s+ before).

---

## Stack

- **Client:** Vite, TypeScript, Phaser 3
- **Server:** Node, Express, Zod
- **AI:** OpenClaw, Kimi K3.1 Pro on Cerebras
- **Game logic:** `src/ai/` (telemetry, rival brain, match memory)

---

## Setup

```bash
cp .env.example .env
# Add CEREBRAS_API_KEY — never commit .env
npm install
```

---

## Run

Three terminals:

```bash
npm run gateway   # OpenClaw Gateway (required)
npm run server      # Live Kimi patch API on :8787
npm run dev         # Game on http://127.0.0.1:5173
```

Health check: `http://localhost:8787/health` should report `mode: live`.

---

## Play

- **You:** Player 1 only (keyboard; touch overlay on mobile).
- **Rival:** AI only; patches apply mid-round and across rounds.
- **Header:** live AI status and complaint box (talks to the same Kimi path).

Footer rotates short control hints (move, fight, specials).

---

## Environment

| Variable | Purpose |
|----------|---------|
| `CEREBRAS_API_KEY` | Credentials for Kimi on Cerebras (server + OpenClaw) |
| `OPENCLAW_BIN` | Optional path to `openclaw` |
| `RIVAL_PORT` | API port (default 8787) |
| `VITE_RIVAL_API` | Optional API URL for remote client |

---

## Tests

```bash
npm test              # Patch policy unit tests
npm run test:api      # HTTP smoke (server + Gateway running)
npm run test:rival    # Playwright E2E
```

---

## Hackathon tags

Post demos with: `@Cerebras` `@Kimi_Moonshot` `#KimiOnCerebras`

---

## License

Hackathon project. Assets and engine code as included in this repository.