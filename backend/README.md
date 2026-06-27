# Kudos Board — Backend

Express proxy for the Kudos Board. The full boards/cards API + GIPHY proxy
(planning.md §2) are still **scaffolded for Milestone 2** — until then the
frontend runs against a localStorage store with the same contract
(`frontend/src/lib/api.js`).

**What's live now:** the **AI proxy** (`/api/ai`) for the "Help me write" kudos
composer. It keeps the OpenRouter API key server-side (planning.md §2.3 / §7).

## Setup

```bash
cd backend
npm install
cp .env.example .env        # then paste your OpenRouter key into .env
npm run dev                 # http://localhost:3001  (Vite proxies /api here)
```

Get a free key at https://openrouter.ai/keys and put it in `.env`:

```
OPENROUTER_API_KEY=sk-or-...
```

`.env` is gitignored — your key is never committed. Restart `npm run dev` after
editing `.env`. Check `GET /api/health` → `{ "ok": true, "ai": true }` to confirm
the key loaded.

## Endpoints

| Method | Path                   | Status | Notes |
| ------ | ---------------------- | ------ | ----- |
| GET    | `/api/health`          | ✅     | `{ ok, ai }` — `ai` is true when a key is configured. |
| POST   | `/api/ai/compose`      | ✅     | `{ keywords, tone?, recipient? }` → `{ message }`. |
| POST   | `/api/ai/suggest-gifs` | 🚧 501 | Teammate's AI GIF-term suggester (planning.md §7.2). |

## Layout

```
src/
├── index.js                  ← Express app + middleware + error handler
├── lib/openrouter.js         ← shared chat() helper (the only place the LLM is called)
├── routes/ai.js              ← /api/ai routes
└── controllers/aiController.js
```

Boards, cards, and the GIPHY proxy (planning.md §2/§3) will mount alongside the
AI router here. To switch the frontend onto this API once that exists, set
`VITE_USE_API=true` in `frontend/.env`.
