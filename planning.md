# Kudos Board — Project Specification (`planning.md`)

> **Status:** Living document. This spec governs the full stack and is the source of truth for
> component architecture, API contracts, the database schema, and frontend state. Any
> implementation change that diverges from this document must be reflected here and committed.
> The goal at submission is **code–spec parity**.

## 0. Overview

**Kudos Board** lets users create themed boards and fill them with cards — short messages of
praise, encouragement, and appreciation, each paired with a GIF. Users browse, filter, and search
boards on the home page, open a board to see its cards, and upvote / pin / delete cards.

### Tech stack

| Layer        | Choice                                                                 |
| ------------ | ---------------------------------------------------------------------- |
| Frontend     | React (Vite) + React Router, plain CSS / CSS variables (design tokens) |
| Backend      | Node.js + Express                                                      |
| ORM          | Prisma                                                                 |
| Database     | PostgreSQL                                                             |
| External API | GIPHY API (GIF search inside the Create Card modal)                    |
| Deployment   | Render (stretch)                                                       |

### Repo layout

```
Enforcers-FTL-Kudos_Board/
├── planning.md          ← this file
├── frontend/            ← React app (Vite)
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── lib/         ← api client, giphy client
│       └── styles/      ← design tokens (CSS variables)
└── backend/             ← Express + Prisma
    ├── prisma/schema.prisma
    └── src/
        ├── routes/
        ├── controllers/
        └── index.js
```

### Scope

- **Required:** home page (header, banner, search, board grid, footer), display boards, filter by
  category, search by title, view a board, create board, delete board, display cards, create card
  (with GIPHY GIF), upvote card, delete card.
- **In-scope stretch (present in the design system):** **Dark Mode** (theme toggle + token sets)
  and **Pinned Cards** (pin/unpin, pinned cards float to the top).
- **Deferred stretch (specced in §6, not built yet):** User Accounts, Comments, Render deployment.

### A note on persistence

The original front-end design JSON described `localStorage` persistence (`kudos-boards`,
`kudos-cards`). That is **superseded** by the Express + Prisma backend: boards and cards live in
PostgreSQL and are reached over HTTP (§2). The **only** thing that stays in `localStorage` is the
user's **theme preference** (`kudos-theme`), since it's a per-device UI preference, not shared data.

---

## 1. Component Architecture

### 1.1 Hierarchy

```
App (router, theme provider/state)
│
├── Header
│   └── ThemeToggle
│
├── Route "/" → HomePage
│   ├── Banner
│   ├── section.controls
│   │   ├── FilterBar          (Create New Board button lives here)
│   │   └── SearchBar
│   ├── BoardGrid
│   │   ├── BoardGridSkeleton   (loading)
│   │   ├── EmptyState          (empty)
│   │   └── BoardCard[]         (populated)
│   └── CreateBoardModal        (portal, toggled from FilterBar)
│
├── Route "/boards/:boardId" → BoardDetailPage
│   ├── BoardDetailHeader       (Add Card button lives here)
│   ├── CardGrid
│   │   ├── BoardGridSkeleton   (loading — reused)
│   │   ├── EmptyState          (empty — reused)
│   │   └── KudoCard[]          (populated)
│   │       └── UpvoteButton
│   └── CreateCardModal         (portal, toggled from BoardDetailHeader)
│       └── GifPicker
│
└── Footer
```

`Header` and `Footer` are rendered once at the `App` level so they persist across routes.

### 1.2 Component specs

#### `App`
- **Responsibility:** Root component — sets up routing and owns the global theme.
- **Renders:** `Header`, the active route (`HomePage` / `BoardDetailPage`), `Footer`.
- **Props:** none.
- **State:** `theme` (`'light' | 'dark'`) — read from `localStorage` (`kudos-theme`), default `'light'`.
- **Interactions:** toggles `theme`; applies `data-theme` / class to the root element; persists choice.

#### `Header`
- **Responsibility:** Sticky top bar with the app logo/name and the theme toggle.
- **Renders:** logo icon + "Kudos Board" heading (left), `ThemeToggle` (right).
- **Props:** `theme`, `onToggleTheme` — from `App`.
- **State:** local `scrolled` boolean (for backdrop blur on scroll).
- **Interactions:** none beyond delegating the toggle.

#### `ThemeToggle`
- **Responsibility:** Icon button that switches between light and dark mode.
- **Renders:** a circular button containing a Sun icon (dark mode) or Moon icon (light mode).
- **Props:** `theme`, `onToggle` — from `Header`.
- **State:** none.
- **Interactions:** `onClick` → `onToggle()`.

#### `Banner`
- **Responsibility:** Home-page hero with headline + subtitle on a gradient.
- **Renders:** heading (`displayXl`) and subtitle (`bodyLg`), optional decorative confetti.
- **Props:** `headline`, `subtitle` — static, from `HomePage`.
- **State:** none.
- **Interactions:** none.

#### `FilterBar`
- **Responsibility:** Category filter pills + the "Create New Board" entry point.
- **Renders:** a pill per filter value (`all`, `recent`, `celebration`, `thankyou`, `inspiration`)
  and a "Create New Board" button.
- **Props:** `activeFilter`, `onFilterChange(filter)`, `onCreateBoard()` — from `HomePage`.
- **State:** none (controlled).
- **Interactions:** clicking a pill → `onFilterChange`; clicking the button → `onCreateBoard` (opens modal).

#### `SearchBar`
- **Responsibility:** Title search with submit + clear.
- **Renders:** search icon, text input, submit button, clear (×) button (when value present).
- **Props:** `value`, `onChange(text)`, `onSubmit()`, `onClear()`, `placeholder` — from `HomePage`.
- **State:** none (controlled by `HomePage`). Local draft state is acceptable if a "submit on
  Enter / click" model is used instead of live filtering.
- **Interactions:** typing → `onChange`; Enter or submit click → `onSubmit`; clearing all text or
  clicking × → `onClear` (which shows all boards again).

#### `BoardGrid`
- **Responsibility:** Responsive grid that renders boards, the loading skeleton, or the empty state.
- **Renders:** `BoardGridSkeleton` (loading), `EmptyState` (empty), or `BoardCard[]` (populated).
- **Props:** `boards`, `loading`, `onDeleteBoard(id)`, `onOpenBoard(id)` — from `HomePage`.
- **State:** none.
- **Interactions:** delegates card clicks / deletes upward.

#### `BoardCard`
- **Responsibility:** A single board tile on the home page.
- **Renders:** cover image (16:9), category tag, title (`h4`), author line, delete icon button.
- **Props:** `id`, `title`, `category`, `imageUrl`, `author`, `cardCount`, `onDelete(id)`, `onClick(id)`.
- **State:** local `deleting` boolean (optimistic/disabled state during delete).
- **Interactions:** card click → navigate to `/boards/:id`; delete button → `onDelete` (stop propagation).

#### `EmptyState`
- **Responsibility:** Friendly placeholder when a grid has no items.
- **Renders:** emoji/icon, heading, message, optional action button.
- **Props:** `title`, `message`, `actionLabel?`, `onAction?`.
- **State:** none.
- **Interactions:** optional action click → `onAction`.

#### `BoardGridSkeleton`
- **Responsibility:** Shimmer placeholders during load (reused for boards and cards).
- **Renders:** `count` skeleton cards matching the grid layout.
- **Props:** `count`.
- **State:** none.
- **Interactions:** none.

#### `CreateBoardModal`
- **Responsibility:** Form dialog to create a board.
- **Renders:** overlay + card with fields — title (required), category (required, select among the
  three stored categories), image URL (optional), author (optional) — plus Cancel / Create.
- **Props:** `open`, `onClose()`, `onCreate(boardData)` — from `HomePage`.
- **State:** local form fields (`title`, `category`, `imageUrl`, `author`), `submitting`, `errors`.
- **Interactions:** input changes; submit → validate → `onCreate`; cancel/overlay/Esc → `onClose`.

#### `BoardDetailHeader`
- **Responsibility:** Header strip for a board's page.
- **Renders:** back link, board title (`h1`), category chip, "Add Card" button, themed gradient.
- **Props:** `board`, `onAddCard()` — from `BoardDetailPage`.
- **State:** none.
- **Interactions:** back link → navigate home; "Add Card" → `onAddCard` (opens modal).

#### `CardGrid`
- **Responsibility:** Responsive grid of cards; renders pinned cards first.
- **Renders:** `BoardGridSkeleton` (loading), `EmptyState` (empty), or `KudoCard[]` (populated).
- **Props:** `cards`, `loading`, `onDeleteCard(id)`, `onUpvote(id)`, `onPin(id, pinned)`.
- **State:** none (ordering is computed by the parent / API — see §4 & §5).
- **Interactions:** delegates upvote / pin / delete upward.

#### `KudoCard`
- **Responsibility:** A single kudos card.
- **Renders:** GIF (16:9), message (`bodyMd`), author line, footer with `UpvoteButton` (left) and
  pin + delete icon buttons (right). Pinned state shows the 📌 badge + highlighted border.
- **Props:** `id`, `message`, `gifUrl`, `author`, `upvotes`, `pinned`, `category`, `onUpvote(id)`,
  `onPin(id, pinned)`, `onDelete(id)`.
- **State:** local `upvoting` / `busy` flags for click animation + disabling during requests.
- **Interactions:** upvote click → `onUpvote`; pin click → `onPin`; delete click → `onDelete`.

#### `UpvoteButton`
- **Responsibility:** Heart button with live count and a click animation.
- **Renders:** heart icon + count.
- **Props:** `count`, `onUpvote()`, `voted?`.
- **State:** local transient `animating` flag.
- **Interactions:** click → `onUpvote` (count may be optimistically bumped by the parent).

#### `CreateCardModal`
- **Responsibility:** Form dialog to add a card to the current board.
- **Renders:** overlay + card with message (required), `GifPicker` (required selection), author
  (optional), Cancel / Create. Create button uses the board category's accent.
- **Props:** `open`, `boardCategory`, `onClose()`, `onCreate(cardData)` — from `BoardDetailPage`.
- **State:** local `message`, `gifUrl` (selected), `author`, `submitting`, `errors`.
- **Interactions:** field changes; GIF select; submit → validate (message + gif required) → `onCreate`.

#### `GifPicker`
- **Responsibility:** Search GIPHY and select a GIF inside the Create Card modal.
- **Renders:** search input + scrollable result grid; the selected GIF is highlighted.
- **Props:** `onSelect(gifUrl)`, `selectedUrl`.
- **State:** local `query`, `results`, `status` (`idle | searching | results | error`).
- **Interactions:** typing/submitting query → call GIPHY (debounced); clicking a result → `onSelect`.

#### `Footer`
- **Responsibility:** Site footer with tagline + copyright.
- **Renders:** tagline (left), copyright (right).
- **Props:** none.
- **State:** none.
- **Interactions:** none.

---

## 2. API Contracts

**Base URL:** `/api`  ·  **Content type:** `application/json`  ·  **IDs:** UUID strings.

**Standard error envelope:**
```json
{ "error": "Human-readable message", "details": { "field": "reason" } }
```

| Status | Used when |
| ------ | --------- |
| `200`  | Successful GET / PATCH / upvote / pin |
| `201`  | Resource created |
| `204`  | Resource deleted (no body) |
| `400`  | Validation failed (missing/invalid required field) |
| `404`  | Resource not found |
| `500`  | Unexpected server error |

### 2.1 Boards

#### `GET /api/boards`
List boards. **Filtering and search are query params** (server-side).

| Query param | Type     | Required | Notes |
| ----------- | -------- | -------- | ----- |
| `filter`    | string   | no       | One of `all`, `recent`, `celebration`, `thankyou`, `inspiration`. `all` → no filter; `recent` → 6 most recently created; a category value → boards with that category. Default `all`. |
| `search`    | string   | no       | Case-insensitive substring match on `title`. |

- **Success `200`:** `Board[]` (each includes derived `cardCount`), newest first — except
  `filter=recent`, which returns at most 6 ordered by `createdAt` desc.
- **Errors:** `400` if `filter` is not an allowed value; `500` on server error.

```jsonc
// 200
[
  {
    "id": "uuid",
    "title": "Welcome New Hires",
    "category": "celebration",
    "imageUrl": "https://…",
    "author": "Benny",
    "createdAt": 1719400000000,
    "cardCount": 4
  }
]
```

#### `GET /api/boards/:boardId`
- **Success `200`:** a single `Board` (with `cardCount`).
- **Errors:** `404` if no board with that id; `500`.

#### `POST /api/boards`
Create a board.

| Field      | Type   | Required | Notes |
| ---------- | ------ | -------- | ----- |
| `title`    | string | **yes**  | Non-empty after trim. |
| `category` | string | **yes**  | One of `celebration`, `thankyou`, `inspiration`. |
| `imageUrl` | string | no       | URL; defaults to a placeholder if omitted. |
| `author`   | string | no       | |

- **Success `201`:** the created `Board` (`cardCount` = 0).
- **Errors:** `400` if `title` missing/empty or `category` missing/invalid; `500`.

#### `DELETE /api/boards/:boardId`
Delete a board and (cascade) all its cards.
- **Success `204`:** no body.
- **Errors:** `404` if not found; `500`.

> `PUT/PATCH /api/boards/:boardId` (edit board) is **not required**; reserved for future use.

### 2.2 Cards

#### `GET /api/boards/:boardId/cards`
List a board's cards.
- **Success `200`:** `Card[]`, ordered **pinned first** (`pinnedAt` desc) then unpinned
  (`createdAt` desc). See §5 for the exact ordering rule.
- **Errors:** `404` if the board doesn't exist; `500`.

```jsonc
// 200
[
  {
    "id": "uuid",
    "boardId": "uuid",
    "message": "Thanks for covering my shift!",
    "gifUrl": "https://media.giphy.com/…",
    "author": "Sam",
    "upvotes": 3,
    "pinned": true,
    "pinnedAt": 1719400500000,
    "createdAt": 1719400000000
  }
]
```

#### `POST /api/boards/:boardId/cards`
Create a card on a board.

| Field     | Type   | Required | Notes |
| --------- | ------ | -------- | ----- |
| `message` | string | **yes**  | Non-empty after trim. |
| `gifUrl`  | string | **yes**  | Selected via the GIPHY picker. |
| `author`  | string | no       | |

- **Success `201`:** the created `Card` (`upvotes` 0, `pinned` false, `pinnedAt` null).
- **Errors:** `404` if the board doesn't exist; `400` if `message` or `gifUrl` missing; `500`.

#### `DELETE /api/boards/:boardId/cards/:cardId`
- **Success `204`:** no body.
- **Errors:** `404` if board or card not found; `500`.

#### `PATCH /api/boards/:boardId/cards/:cardId/upvote`
Increment the upvote count by 1. Body: none. (Multiple upvotes by the same user are allowed.)
- **Success `200`:** the updated `Card` (`upvotes` incremented).
- **Errors:** `404` if not found; `500`.

#### `PATCH /api/boards/:boardId/cards/:cardId/pin`
Toggle pin state.

| Field    | Type    | Required | Notes |
| -------- | ------- | -------- | ----- |
| `pinned` | boolean | **yes**  | `true` → set pinned and stamp `pinnedAt = now`; `false` → unpin and clear `pinnedAt`. |

- **Success `200`:** the updated `Card`.
- **Errors:** `404` if not found; `400` if `pinned` is not a boolean; `500`.

### 2.3 GIPHY proxy (recommended)

To keep the GIPHY API key off the client, the GIF search goes through the backend.

#### `GET /api/giphy/search?q=<query>&limit=<n>`
- **Success `200`:** `{ "gifs": [{ "id": "…", "url": "https://…", "previewUrl": "https://…" }] }`
- **Errors:** `400` if `q` missing; `502` if GIPHY is unreachable; `500`.

> Alternative: call GIPHY directly from `GifPicker` with a public key in a `VITE_` env var. The
> proxy is preferred so the key isn't shipped to the browser.

---

## 3. Database Schema Spec (Prisma)

PostgreSQL via Prisma. Timestamps are stored as `DateTime` in the DB; the API serializes
`createdAt` / `pinnedAt` as epoch-millis numbers (or ISO strings — pick one and keep §2 in sync).

### 3.1 `Board`

| Field       | Type        | Required | Default        | Notes |
| ----------- | ----------- | -------- | -------------- | ----- |
| `id`        | `String`    | yes      | `uuid()`       | `@id @default(uuid())` |
| `title`     | `String`    | yes      | —              | |
| `category`  | `Category`  | yes      | —              | enum: `celebration`, `thankyou`, `inspiration` |
| `imageUrl`  | `String?`   | no       | —              | |
| `author`    | `String?`   | no       | —              | |
| `createdAt` | `DateTime`  | yes      | `now()`        | `@default(now())` |
| `cards`     | `Card[]`    | —        | —              | relation (one board → many cards) |

- `cardCount` is **derived** (Prisma `_count` / `cards.length`), not a stored column.

### 3.2 `Card`

| Field       | Type        | Required | Default   | Notes |
| ----------- | ----------- | -------- | --------- | ----- |
| `id`        | `String`    | yes      | `uuid()`  | `@id @default(uuid())` |
| `boardId`   | `String`    | yes      | —          | FK → `Board.id` |
| `board`     | `Board`     | —        | —          | relation, `onDelete: Cascade` |
| `message`   | `String`    | yes      | —          | |
| `gifUrl`    | `String`    | yes      | —          | required (selected GIF) |
| `author`    | `String?`   | no       | —          | |
| `upvotes`   | `Int`       | yes      | `0`        | |
| `pinned`    | `Boolean`   | yes      | `false`    | |
| `pinnedAt`  | `DateTime?` | no       | —          | set when pinned, null when not — drives pin ordering |
| `createdAt` | `DateTime`  | yes      | `now()`    | |

### 3.3 Relationships & constraints

- One `Board` has many `Card`s. Deleting a board **cascades** to its cards
  (`@relation(... onDelete: Cascade)`).
- `category` is a Prisma `enum Category { celebration thankyou inspiration }`.
  > `all` and `recent` are **view filters only** — they are never stored on a board.
- Index `Card.boardId` for fast per-board lookups.

### 3.4 Reference `schema.prisma` (to implement in Milestone 2)

```prisma
enum Category {
  celebration
  thankyou
  inspiration
}

model Board {
  id        String   @id @default(uuid())
  title     String
  category  Category
  imageUrl  String?
  author    String?
  createdAt DateTime @default(now())
  cards     Card[]
}

model Card {
  id        String    @id @default(uuid())
  boardId   String
  board     Board     @relation(fields: [boardId], references: [id], onDelete: Cascade)
  message   String
  gifUrl    String
  author    String?
  upvotes   Int       @default(0)
  pinned    Boolean   @default(false)
  pinnedAt  DateTime?
  createdAt DateTime  @default(now())

  @@index([boardId])
}
```

---

## 4. State Architecture

### 4.1 Global / app-level

| State        | Type                  | Initial               | Owner | Trigger to update |
| ------------ | --------------------- | --------------------- | ----- | ----------------- |
| `theme`      | `'light' \| 'dark'`   | `localStorage` or `'light'` | `App` | `ThemeToggle` click; persisted to `localStorage` (`kudos-theme`) and applied on every route. |

### 4.2 HomePage

| State           | Type                | Initial   | Owner | Trigger to update |
| --------------- | ------------------- | --------- | ----- | ----------------- |
| `boards`        | `Board[]`           | `[]`      | `HomePage` | Fetched on mount and after create/delete; refetched (or re-queried) when filter/search change. |
| `loading`       | `boolean`           | `true`    | `HomePage` | True while a boards request is in flight. |
| `error`         | `string \| null`    | `null`    | `HomePage` | Set when a request fails. |
| `activeFilter`  | `FilterValue`       | `'all'`   | `HomePage` | `FilterBar` pill click. Drives the `filter` query param. |
| `searchQuery`   | `string`            | `''`      | `HomePage` | `SearchBar` change/submit; clearing resets to all boards. |
| `isCreateOpen`  | `boolean`           | `false`   | `HomePage` | `FilterBar` "Create New Board" opens; modal close/create closes. |

> Filtering + search may be (a) sent to the API as query params (`filter`, `search`) for
> server-side filtering, or (b) applied client-side over the already-fetched `boards`. **Decision:
> server-side** via query params (matches §2.1), so `recent`'s "6 most recent" is computed once on
> the backend. Update this note if that changes.

### 4.3 BoardDetailPage

| State              | Type             | Initial  | Owner | Trigger to update |
| ------------------ | ---------------- | -------- | ----- | ----------------- |
| `board`            | `Board \| null`  | `null`   | `BoardDetailPage` | Fetched on mount from `:boardId`. |
| `cards`            | `Card[]`         | `[]`     | `BoardDetailPage` | Fetched on mount; updated after create/delete/upvote/pin. |
| `loading`          | `boolean`        | `true`   | `BoardDetailPage` | True while board/cards load. |
| `error`            | `string \| null` | `null`   | `BoardDetailPage` | Set on fetch failure (incl. 404 → "board not found"). |
| `isAddCardOpen`    | `boolean`        | `false`  | `BoardDetailPage` | `BoardDetailHeader` "Add Card" opens; close/create closes. |

**Card ordering (derived, not stored state):** sort `pinned === true` first by `pinnedAt` desc,
then `pinned === false` by `createdAt` desc. The backend returns cards pre-sorted (§2.2); the
frontend re-applies the same sort after optimistic updates so the UI stays consistent.

### 4.4 Local component state (already noted in §1)

- `CreateBoardModal`: `title`, `category`, `imageUrl`, `author`, `submitting`, `errors`.
- `CreateCardModal`: `message`, `gifUrl`, `author`, `submitting`, `errors`.
- `GifPicker`: `query`, `results`, `status`.
- `SearchBar`: optional local input draft (if submitting on Enter rather than live filtering).
- `BoardCard` / `KudoCard` / `UpvoteButton`: transient `deleting` / `upvoting` / `animating` flags.

### 4.5 Update flows (who triggers what)

- **Create board:** `CreateBoardModal.onCreate` → `POST /api/boards` → on `201`, `HomePage`
  prepends to `boards` and closes the modal.
- **Delete board:** `BoardCard.onDelete` → `DELETE /api/boards/:id` → on `204`, `HomePage`
  removes it from `boards` (optimistic with rollback on failure).
- **Filter/search:** `activeFilter` / `searchQuery` change → refetch `GET /api/boards?filter&search`.
- **Create card:** `CreateCardModal.onCreate` → `POST …/cards` → on `201`, append + re-sort, close.
- **Upvote:** `UpvoteButton.onUpvote` → `PATCH …/upvote` → replace card with response (optimistic +1).
- **Pin/unpin:** `KudoCard.onPin` → `PATCH …/pin {pinned}` → replace card, re-sort so pins float up.
- **Delete card:** `KudoCard.onDelete` → `DELETE …/cards/:id` → remove from `cards` (optimistic).

---

## 5. Cross-cutting rules

- **Required-field validation** happens on both client (disable submit / inline errors) and server
  (`400` with `details`). Server is authoritative.
- **Optimistic UI** is used for upvote/pin/delete with rollback if the request fails.
- **Pin ordering invariant:** pinned cards always render above unpinned; among pinned, most
  recently pinned (`pinnedAt` desc) first; among unpinned, newest created first.
- **Theme persistence:** the chosen theme survives navigation and refresh via `localStorage`.

---

## 6. Deferred Stretch Features (spec-ahead, not yet built)

> Per the milestone rules, these are documented **before** implementation. Building any of them
> requires updating §1–§4 and committing the change.

### 6.1 User Accounts
- **New models:** `User { id, username @unique, passwordHash, createdAt }`; add `userId String?`
  to `Board` and `Card` (nullable → anonymous/guest content still allowed).
- **New endpoints:** `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`,
  `GET /api/auth/me`. Auth via session cookie or JWT.
- **New filter:** `filter=mine` on `GET /api/boards` → only the current user's boards.
- **Rule:** a board may be deleted only by its owner (`403` otherwise).
- **New components:** `LoginModal` / `SignupModal`, `AuthMenu` in `Header`.
- **New state:** `currentUser` (global, `App`).

### 6.2 Comments
- **New model:** `Comment { id, cardId (FK, cascade), message, author?, createdAt }`.
- **New endpoints:** `GET /api/cards/:cardId/comments`, `POST /api/cards/:cardId/comments`.
- **New components:** `CardDetailModal` (shows card message, GIF, author, and comment list +
  add-comment form), `CommentList`, `CommentForm`.
- **New state:** `isCardModalOpen`, `activeCardId`, `comments` on `BoardDetailPage`.

### 6.3 Deployment (Render)
- Backend web service + managed PostgreSQL; frontend static site. Env vars: `DATABASE_URL`,
  `GIPHY_API_KEY`, `VITE_API_BASE_URL`. Run `prisma migrate deploy` on release.

---

## Appendix A — Design tokens (front-end source of truth)

Implemented as CSS custom properties with a light set on `:root` and a dark set under
`[data-theme="dark"]`. Categories each have an accent / soft / tag / tag-text set (light + dark).

- **Base tokens:** `background`, `foreground`, `surface`, `surfaceHover`, `border`, `mutedText`,
  `inputBg` (light + dark values per the design JSON).
- **Category palettes:** `celebration` (pink `#F4628A`), `thankyou` (teal `#0EA5AC`),
  `inspiration` (violet `#8B5CF6`), plus view-only accents `recent` (amber `#F59E0B`) and
  `all` (indigo `#6366F1`).
- **Semantic:** `danger` `#EF4444`, `pinned` `#F59E0B`, `pinnedBorder` `#FCD34D`.
- **Typography:** headings `Poppins`, body `Inter`; scale from `displayXl` (3rem/800) down to
  `tag` (0.6875rem/600, uppercase). Google Fonts link in the design JSON.
- **Spacing:** 8px base scale (`0–24` → `0px–96px`).
- **Radii:** `sm 8 / md 12 / lg 16 / xl 20 / 2xl 24 / full 9999`.
- **Shadows:** `card`, `cardHover`, `modal`, `button`, `pinned`.
- **Transitions:** `fast 150ms`, `base 200ms`, `slow 300ms`.
- **Breakpoints:** mobile `0`, tablet `640`, desktop `1024`, wide `1280`.

> Grids: `BoardGrid` = 1 / 2 / 3 / 4 cols (mobile→wide); `CardGrid` = 1 / 2 / 3 cols. Gap `24px`.

---

## Appendix B — Type reference

```ts
type Category = 'celebration' | 'thankyou' | 'inspiration';
type FilterValue = 'all' | 'recent' | Category;   // 'all' & 'recent' are view-only

interface Board {
  id: string;
  title: string;
  category: Category;
  imageUrl?: string;
  author?: string;
  createdAt: number;     // epoch ms
  cardCount: number;     // derived
}

interface Card {
  id: string;
  boardId: string;
  message: string;
  gifUrl: string;
  author?: string;
  upvotes: number;
  pinned: boolean;
  pinnedAt: number | null;
  createdAt: number;     // epoch ms
}
```
