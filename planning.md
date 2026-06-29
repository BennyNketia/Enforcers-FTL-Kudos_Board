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
- **Deferred stretch (specced in §6):** User Accounts (login/logout **frontend built** — see §6.1;
  backend endpoints pending), Comments, Render deployment.

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
├── Header                          (sticky nav: brand · Create Board · ThemeToggle)
│   └── ThemeToggle
│
├── Route "/" → HomePage            (SaaS dashboard layout)
│   ├── Hero                        (gradient backdrop, headline, CTAs, 3 StatCards)
│   ├── QuickActions                (3 entry-point cards: create / inspiration / recent)
│   ├── HighlightedBoards           (2–3 newest boards as larger featured BoardCards)
│   │   └── BoardCard[] (featured)
│   ├── section#all-boards
│   │   ├── section-head            (title + "New board" button)
│   │   ├── home__toolbar
│   │   │   ├── FilterBar           (category pills only — controlled)
│   │   │   └── SearchBar
│   │   └── BoardGrid
│   │       ├── BoardGridSkeleton   (loading)
│   │       ├── EmptyState          (no results / no boards)
│   │       └── BoardCard[]         (populated)
│   └── CreateBoardModal            (portal; opened from Header / Hero / QuickActions / section-head / empty state)
│
├── Route "/boards/:boardId" → BoardDetailPage
│   ├── BoardDetailHeader           (back link, category badge, title, author, card-count, Add Card)
│   ├── CardGrid
│   │   ├── BoardGridSkeleton       (loading — reused)
│   │   ├── EmptyState              (empty — reused, polished panel)
│   │   └── KudoCard[]              (populated)
│   │       └── UpvoteButton
│   └── CreateCardModal             (portal, toggled from BoardDetailHeader)
│       └── GifPicker
│
└── Footer
```

`Header` and `Footer` are rendered once at the `App` level so they persist across routes.
The **Create Board** action is global: the `Header` button navigates to `/?new=1`; `HomePage`
detects that query param, opens `CreateBoardModal`, then strips the param (replace) so a refresh
doesn't reopen it. This keeps "create" reachable from the board detail page too.

> **Redesign note (dashboard polish pass):** the original `Banner` was replaced by `Hero`
> (now carries live stat cards), and `QuickActions` + `HighlightedBoards` were added. `FilterBar`
> no longer owns the create button. See **§7 Frontend Design System** for the styling system,
> tokens, and shared UI primitives introduced in this pass.

### 1.2 Component specs

#### `App`
- **Responsibility:** Root component — sets up routing and owns the global theme.
- **Renders:** `Header`, the active route (`HomePage` / `BoardDetailPage`), `Footer`.
- **Props:** none.
- **State:** `theme` (`'light' | 'dark'`) — read from `localStorage` (`kudos-theme`), default `'light'`.
- **Interactions:** toggles `theme`; applies `data-theme` / class to the root element; persists choice.

#### `Header`
- **Responsibility:** Sticky top navigation with the brand, a global **Create Board** button, and the theme toggle.
- **Renders:** gradient logo mark + "Kudos Board" heading (left); `Create Board` primary button +
  `ThemeToggle` (right). Translucent blurred backdrop; gains a border + subtle shadow once scrolled.
- **Props:** `theme`, `onToggleTheme` — from `App`.
- **State:** local `scrolled` boolean (for the backdrop border/shadow on scroll).
- **Interactions:** `Create Board` → `navigate('/?new=1')` (HomePage opens the modal); delegates the theme toggle.
- **Responsive:** below 560px the brand text and button label collapse to an icon-only button.

#### `ThemeToggle`
- **Responsibility:** Icon button that switches between light and dark mode.
- **Renders:** a circular button containing a Sun icon (dark mode) or Moon icon (light mode).
- **Props:** `theme`, `onToggle` — from `Header`.
- **State:** none.
- **Interactions:** `onClick` → `onToggle()`.

#### `Hero` *(replaces `Banner`)*
- **Responsibility:** Home dashboard hero — gradient backdrop, headline/subtitle, CTAs, and three
  live **StatCards** (Total Boards, Total Cards, Recent Boards).
- **Renders:** eyebrow chip, `displayXl` headline (with gradient-clipped accent word), `bodyLg`
  subtitle, two CTAs ("Create a board" / "Browse boards" → `#all-boards`), and a 3-up stat grid
  with category-tinted icon tiles. Soft blurred decorative blobs (purely decorative, `aria-hidden`).
- **Props:** `stats` (`{ boards, cards, recent }`), `loading`, `onPrimary()` — from `HomePage`.
- **State:** none.
- **Interactions:** primary CTA → `onPrimary` (opens create modal); secondary CTA anchors to the grid.

#### `QuickActions` *(new)*
- **Responsibility:** Three entry-point cards under the hero.
- **Renders:** "Create a board", "Browse inspiration", "View recent boards" — each an icon tile,
  title, description, and arrow that nudges right on hover.
- **Props:** `onCreate()`, `onBrowseInspiration()`, `onViewRecent()` — from `HomePage`.
- **State:** none.
- **Interactions:** create opens the modal; the other two set a filter (`inspiration` / `recent`),
  clear search, and smooth-scroll to the All Boards section.

#### `HighlightedBoards` *(new)*
- **Responsibility:** Feature strip of the 2–3 most recent boards as larger `BoardCard`s.
- **Renders:** a `section-head` + a grid of `BoardCard featured`. Renders `null` when there are no
  boards (and HomePage hides it whenever a filter/search is active).
- **Props:** `boards` (already sliced to ≤3), `onDeleteBoard(id)`.
- **State:** none.

#### `FilterBar`
- **Responsibility:** Category filter pills (controlled). The create entry point moved to the
  `Header` / section head, so this is now purely a filter group.
- **Renders:** a pill per filter value (`all`, `recent`, `celebration`, `thankyou`, `inspiration`);
  the active pill is filled with its category accent. Horizontally scrollable on small screens.
- **Props:** `activeFilter`, `onFilterChange(filter)` — from `HomePage`.
- **State:** none (controlled).
- **Interactions:** clicking a pill → `onFilterChange`.

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
- **Responsibility:** A single board tile on the home page (also used in `HighlightedBoards`).
- **Renders:** cover image (16:10, 16:9 when `featured`) with a gradient overlay; over the media a
  category pill (top-left) and a card-count badge (top-right); a corner **delete** icon button that
  fades in on hover/focus; below, the title (`h4`, `h3` when featured, clamped to 2 lines) and an
  author row with a circular initial **avatar**. Hover lifts the card, deepens the shadow, glows the
  border (primary), and zooms the image.
- **Props:** `id`, `title`, `category`, `imageUrl`, `author`, `cardCount`, `onDelete(id)`, `featured?`.
- **State:** local `deleting` boolean (dims + disables the card during the optimistic delete).
- **Interactions:** card click / Enter / Space → navigate to `/boards/:id`; delete button →
  `stopPropagation` then `onDelete` (never triggers navigation).

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
- **Renders:** overlay + elevated card with fields — title (required), category (required, rendered
  as a 3-up **pill/card selector** with emoji + label, not a plain `<select>`), image URL (optional),
  author (optional) — plus Cancel / Create. Inline polished validation errors; the Create button
  shows a spinner and "Creating…" while submitting.
- **Props:** `open`, `onClose()`, `onCreate(boardData)` — from `HomePage`.
- **State:** local form fields (`title`, `category`, `imageUrl`, `author`), `submitting`, `errors`.
- **Interactions:** input/category changes; submit → validate → `onCreate`; cancel/overlay/Esc → `onClose`.

#### `BoardDetailHeader`
- **Responsibility:** Header strip for a board's page.
- **Renders:** a pill-style back link, category chip, board title (`displayLg`), an author row with
  avatar, a card-count badge, and the "Add Card" button (themed to the board's category). Background
  is a soft category-tinted radial wash with a bottom border.
- **Props:** `board`, `cardCount` (live count from `BoardDetailPage`), `onAddCard()`.
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
- **Renders:** overlay + card with a large message textarea (required), `GifPicker` (required
  selection), author (optional), Cancel / Create. Create button uses the board category's accent
  gradient, shows a spinner while submitting, and is **disabled until both message and a GIF are
  set** (in addition to server validation).
- **Props:** `open`, `boardCategory`, `onClose()`, `onCreate(cardData)` — from `BoardDetailPage`.
- **State:** local `message`, `gifUrl` (selected), `author`, `submitting`, `errors`.
- **Interactions:** field changes; GIF select; submit → validate (message + gif required) → `onCreate`.

#### `GifPicker`
- **Responsibility:** Search GIPHY and select a GIF inside the Create Card modal.
- **Renders:** search input (with an inline spinner while searching) + a fixed-height scrollable
  3-col result grid. The selected GIF gets a primary ring + a checkmark badge. Distinct
  **loading**, **empty** ("No GIFs found"), and **error** states fill the grid area.
- **Props:** `onSelect(gifUrl)`, `selectedUrl`.
- **State:** local `query`, `results`, `status` (`idle | searching | results | error`).
- **Interactions:** typing → debounced GIPHY search; submit → immediate search; clicking a result → `onSelect`.

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
| `boards`        | `Board[]`           | `[]`      | `HomePage` | Filtered/searched grid set. Fetched on mount and after create/delete; refetched when filter/search change. |
| `allBoards`     | `Board[]`           | `[]`      | `HomePage` | Unfiltered snapshot powering hero **stats** (`{boards, cards, recent}`, derived via `useMemo`) and the **HighlightedBoards** strip (first 3). Kept in sync on create/delete. |
| `loading`       | `boolean`           | `true`    | `HomePage` | True while a boards request is in flight. |
| `error`         | `string \| null`    | `null`    | `HomePage` | Set when a request fails (grid surfaces it; stats are best-effort). |
| `activeFilter`  | `FilterValue`       | `'all'`   | `HomePage` | `FilterBar` pill click / QuickActions jump. Drives the `filter` query param. |
| `searchQuery`   | `string`            | `''`      | `HomePage` | `SearchBar` submit; clearing resets to all boards. |
| `isCreateOpen`  | `boolean`           | `false`   | `HomePage` | Opened by Header (`?new=1`), Hero, QuickActions, section-head, or empty-state; modal close/create closes. |

> **`?new=1` deep link:** `HomePage` reads `useSearchParams`; when `new=1` it opens the create modal
> once and removes the param with `replace` so refresh/back doesn't reopen it.

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
- **New components:** `AuthModal` (combined login/signup, tabbed), `AuthMenu` in `Header`.
- **New state:** `currentUser` (global, via `useAuth` hook in `App`).
- **Frontend status (built):** The login/logout UI is implemented. `AuthMenu` sits in the header
  (Sign in button → opens `AuthModal`; signed in → avatar dropdown with Log out). The `lib/auth.js`
  data layer mirrors `lib/api.js`: it calls the real `/api/auth/*` endpoints when `VITE_USE_API=true`
  (with `credentials: 'include'` for the session cookie) and otherwise falls back to a localStorage
  "session" so the flow works in the demo. **Backend (teammates):** implement the four endpoints
  above; the frontend already speaks this contract.

### 6.2 Comments
- **New model:** `Comment { id, cardId (FK, cascade), message, author?, createdAt }`.
- **New endpoints:** `GET /api/cards/:cardId/comments`, `POST /api/cards/:cardId/comments`.
- **New components:** `CardDetailModal` (shows card message, GIF, author, and comment list +
  add-comment form), `CommentList`, `CommentForm`.
- **New state:** `isCardModalOpen`, `activeCardId`, `comments` on `BoardDetailPage`.

### 6.3 Deployment (Render)
- Backend web service + managed PostgreSQL; frontend static site. Env vars: `DATABASE_URL`,
  `GIPHY_API_KEY`, `OPENROUTER_API_KEY`, `VITE_API_BASE_URL`. Run `prisma migrate deploy` on release.

---

## 7. Frontend Design System (dashboard polish pass)

> This section documents the visual redesign that turned the starter UI into a polished
> SaaS-style dashboard. It is additive — **no API contracts, DB fields, or response shapes changed**,
> and every required feature still works. Style direction: modern SaaS, clean but playful, soft
> shadows, rounded 16–24px cards, subtle gradients, a purple/blue primary accent, and per-category
> color for personality — no clutter, no random gradients.

### 7.1 Token layer (`styles/tokens.css`)

The original Figma tokens are kept as the base. A **dashboard layer** was added on top so older and
newer components share one source of truth:

- **Semantic aliases (requested names):** `--bg`, `--text-primary`, `--text-secondary`,
  `--celebration`, `--thank-you`, `--inspiration` map onto the existing base/category tokens.
- **Primary accent:** `--primary`, `--primary-hover`, `--primary-soft`, `--primary-contrast`
  (indigo→violet; brightens in dark mode for contrast).
- **Layered surfaces:** `--bg` (deepest) → `--surface` → `--surface-elevated` (brightest panel,
  used for modals) → `--surface-hover`. Dark mode is **layered charcoal, never pure black**
  (`#0E0E13` / `#17171F` / `#20202B`).
- **Shadow scale:** `--shadow-sm` / `--shadow-md` / `--shadow-lg` (+ legacy `--shadow-card*`,
  `--shadow-primary`, `--shadow-pinned`). Shadows deepen in dark mode.
- **Radii:** `--radius-md 12` / `--radius-lg 16` / `--radius-xl 20` / `--radius-2xl 24` / `--radius-full`.
- **Gradients (used sparingly):** `--gradient-primary`, `--gradient-hero` (layered radial washes),
  and per-category `--gradient-celebration|thankyou|inspiration`.
- **Media overlay:** `--overlay-media` keeps titles/badges legible over GIFs and cover images.
- **Motion:** `--transition-fast|base|slow` + `--ease-spring` for the modal pop.

### 7.2 Shared UI primitives (`styles/global.css`)

One reusable system so every surface uses consistent sizing, radius, focus, and motion:

- **Buttons `.ui-btn`** + variants `--primary` (gradient + shadow), `--ghost`, `--outline`,
  category accents `--cat-celebration|thankyou|inspiration`, plus `--sm` / `--block`. Fixed heights
  (44 / 38px), `:hover` lift, `:active` press, `:disabled` dim, and a white `.spinner` on filled buttons.
- **`.section-head`** (title + subtitle + optional trailing action), **`.avatar`** (gradient initial
  chip), **`.count-badge`**, **`.spinner`**, and **`.stack`** (vertical section rhythm).
- **Accessibility:** global `:focus-visible` ring uses `--primary`; all interactive controls are
  real buttons/links; decorative elements are `aria-hidden`; `prefers-reduced-motion` is respected.

### 7.3 Component styling notes

- **Header** — sticky, translucent blur, gradient logo mark, global Create Board button.
- **Hero** — `--gradient-hero` + blurred blobs, gradient-clipped accent word, 3 translucent StatCards.
- **QuickActions / HighlightedBoards** — gradient icon tiles; featured cards reuse `BoardCard`.
- **BoardCard / KudoCard** — overlay-on-media, category pill + count badge, avatar author row,
  hover lift + image zoom + primary border glow; corner delete fades in on hover/focus and stops
  propagation; `deleting` dims the card.
- **Modals** — `--surface-elevated`, spring pop-in, sticky header, shared `.field`/`.cat-select`
  form primitives; Create Board uses a pill category selector; GifPicker has loading/empty/error
  states and a checkmark on the selected GIF.
- **EmptyState** — soft dashed panel with a floating icon badge and a `--primary-soft` glow; used for
  no-results, no-boards, and no-cards.

### 7.4 Responsive system

- **BoardGrid:** 1 (mobile) → 2 (≥640) → 3 (≥1024) → 4 (≥1280) columns. **CardGrid:** 1 → 2 → 3.
  **QuickActions:** 3 → 1 (≤900). **Hero:** 2-col → stacked (≤1024); stats 3-up → 1-up (≤380).
- Header never overflows (brand/label collapse ≤560px). The All Boards toolbar (filters + search)
  stacks vertically ≤768px. Modals are width-capped, `max-height: 100dvh`, and scroll internally.

### 7.5 Guarantees

- Theme persists via `localStorage` (`kudos-theme`) across home and board pages (unchanged).
- All required features intact: browse/filter/search boards, create/delete board, board detail,
  create card (GIPHY), upvote, delete card, dark mode (+ the in-scope pin stretch).
- `npm run build` passes.

---

## 8. AI Features (OpenRouter)

> Differentiators that remove the "blank message box" problem. All AI calls go through the
> **backend proxy** so the `OPENROUTER_API_KEY` stays server-side (same rationale as the GIPHY
> proxy, §2.3). The boards/cards data layer is unchanged — these are additive endpoints, and the
> frontend reaches them through the existing Vite `/api` → `localhost:3001` dev proxy.

### 8.1 "Help me write" — AI kudos composer ✅ *implemented*
- **Where:** inside `CreateCardModal`, an inline `KudosComposer` on the Message field's label row.
- **Flow:** the user types a few keywords + picks a **tone** (`heartfelt`, `funny`, `professional`,
  `poetic`, `hype`) → the drafted message populates the Message field, fully editable, regenerate-able.
- **New component:** `KudosComposer` (`onResult(message)` lifts the draft into the modal's form state).
- **New frontend client:** `lib/ai.js` → `composeKudos({ keywords, tone, recipient })`, `TONES`.
- **New endpoint:** `POST /api/ai/compose`
  | Field       | Type   | Required | Notes |
  | ----------- | ------ | -------- | ----- |
  | `keywords`  | string | **yes**  | Non-empty, ≤ 500 chars. |
  | `tone`      | string | no       | One of the five tones above. Default `heartfelt`. |
  | `recipient` | string | no       | Optional name the kudos is addressed to. |
  - **Success `200`:** `{ "message": "…" }` (1–2 sentences, < 280 chars, no quotes/hashtags/emoji).
  - **Errors:** `400` if `keywords` missing/too long or `tone` invalid; `500` if the key isn't
    configured or OpenRouter fails.

### 8.2 AI-suggested GIF 🚧 *teammate — stubbed*
- **Plan:** feed the drafted `message` to the model, get 2–3 GIPHY search terms, run them through the
  existing GIF search to surface on-vibe GIFs.
- **New endpoint:** `POST /api/ai/suggest-gifs` → `{ "terms": string[] }`. Currently returns `501`
  (`backend/src/controllers/aiController.js → suggestGifs`) as a placeholder for the teammate to fill.

### 8.3 Backend shape
```
backend/
├── .env                      ← OPENROUTER_API_KEY (gitignored; copy from .env.example)
├── package.json              ← express, cors, dotenv
└── src/
    ├── index.js              ← Express app, CORS, /api/health, central error handler
    ├── lib/openrouter.js     ← shared chat() helper — the ONLY place the LLM is called
    ├── routes/ai.js          ← mounts /api/ai/compose + /api/ai/suggest-gifs
    └── controllers/aiController.js
```
- **Model:** `OPENROUTER_MODEL` env var; defaults to `meta-llama/llama-3.3-70b-instruct:free`.
- **Run:** `cd backend && npm install && npm run dev` (listens on `:3001`). `GET /api/health` →
  `{ ok, ai }` reports whether the key is loaded.

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
