# Kudos Board — Backend (placeholder)

Express + Prisma API. **Not yet implemented** — this directory is scaffolded for
Milestone 2. The API contract it must satisfy is defined in [`../planning.md`](../planning.md) §2,
and the Prisma schema in §3.

Planned layout:

```
backend/
├── prisma/
│   └── schema.prisma     ← models from planning.md §3
└── src/
    ├── index.js          ← Express app + middleware
    ├── routes/           ← boards, cards, giphy
    ├── controllers/      ← request handlers
    └── lib/              ← prisma client, giphy client
```

Until this is built, the frontend runs against a localStorage-backed store that
implements the same contract (`frontend/src/lib/api.js`). To switch the frontend
to this API once it exists, set `VITE_USE_API=true` in `frontend/.env`.
