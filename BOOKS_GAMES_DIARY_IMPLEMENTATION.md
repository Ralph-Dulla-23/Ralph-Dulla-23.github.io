# Books & Games Diary — Complete Implementation Specification

> **Project:** Ralph Dulla Portfolio & Private Diary (`com.ralph.diary`)  
> **Specification date:** 2026-10-19  
> **Implementation target:** Existing React/Vite/Tailwind/Firebase application wrapped by Capacitor; public portfolio on the web, private owner diary on web and native mobile.  
> **Basis:** `src(1).zip` (53 ZIP entries, source-only) and `CURRENT_UX.md`; informed by the preceding Bookmory product study.  
> **Status:** IMPLEMENTATION PLAN — **not an assertion that any proposed functionality is already implemented.**  
> **Principle:** Bookmory-inspired interaction patterns, not copied proprietary source, branding, assets, or exact screen designs.

---

## 0. Instructions for the Implementing Developer / Coding Agent

**Read the entire specification before making changes. Treat it as the target state, not as evidence that code already exists.** Work against the actual repository, not just the source ZIP; establish its current package versions, Firebase rules, deployment configuration, tests, and Git status before changing anything.

1. **Preserve the existing portfolio** (hero, about, experience, projects, certificates, contact, theme, responsive layout, animation behavior, and existing links). Do not redesign unrelated portfolio sections.
2. **Keep the existing stack**: React + Vite + Tailwind and React Router; Capacitor for mobile; Firebase Authentication and Firestore for identity/storage. Do **not** rewrite as Flutter or migrate to a new backend just to imitate Bookmory.
3. **Protect existing data**: imported 51-book legacy collection, manually edited records, game logs, notes, reading history, ratings, progress, timestamps, and public shelf. No destructive schema switch, reset, mass re-seed, or overwriting user edits.
4. **Solve Phase 0 security, backup, and sync hazards before implementing new diary screens**. A visual-only change cannot compensate for lost or exposed entries.
5. Implement in independently testable, reversible phases. No sweeping unrelated refactors. At each phase report exactly which files were added/changed and why.
6. Keep current public URLs and old diary URLs functional using redirects and compatibility adapters during migration. Old bookmarks must remain valid.
7. New entries are **private by default**. Only explicitly published, allowlisted fields may appear on the public portfolio. Never assume a document called `public` is secure merely because its private notes live in a subcollection.
8. Maintain offline data integrity. A button must not say **“Synced”** if the content has only been saved locally or the remote write failed.
9. Do not auto-invent page counts, hours, play dates, reading dates, book editions, authors, platforms, release years, or genres. Unknown values stay unknown (`null` or absent).
10. Respect platform constraints: web PWA/browser limitations versus native Capacitor features; verify the Android app package and runtime permissions from the complete repository.
11. Do not add social-network feeds, ebook piracy, game storefront checkout, subscriptions, AI content generation, or other scope expansions unless separately approved.
12. Run lint/build/tests when the full project is available. If the ZIP lacks needed configuration or rules, explicitly report that limitation instead of claiming a test passed.

### Definition of the product

A **private, offline-capable diary for both books and video games**, with Bookmory-like calm UX, intuitive searching and logging, timers, historical activity, a visual calendar, notes, goals, and insights. A distinct **public developer portfolio** showcases selected books/games and deliberately published highlights, never raw private diary data.

### Explicit non-goals for v1

- Multiple public social accounts or follower systems.
- Storing full copyrighted ebooks or distributing paid game content.
- Replacing existing React web/Capacitor app with Flutter.
- Automatic tracking of PC/console playtime through platform account integrations.
- Forcing users to start a timer to log a reading or gaming session.
- Artificially filling missing historical activities to make calendars look populated.

---

## 1. Verified Current Baseline

The following is grounded in inspected files; verify latest source revisions at implementation time.

### 1.1 Existing routes

| Current path | Actual component/behavior | Migration action |
|---|---|---|
| `/#/` | Public `HomePage`, native root redirects to `/app/games` (`src/App.jsx`) | Public home unchanged; native root goes to `/app/home` after authentication |
| `/#/portfolio` | Public `HomePage` | Preserve |
| `/#/library` | `LibraryPage` with initial Books tab | Redirect/alias to new public Books shelf |
| `/#/stats` | Same `LibraryPage` with initial Games tab | Redirect/alias to new public Games shelf; fix tab-state issue |
| `/#/login` | Email/password login | Preserve; update verified auth and return routing |
| `/#/app/games` | Owner-only `GamesPage` | Redirect to `/app/library/games` |
| `/#/app/books` | Owner-only `BooksPage` | Redirect to `/app/library/books` |

`src/App.jsx` uses `HashRouter`, lazy routes, and `RequireAuth`. Do not casually switch to `BrowserRouter` without first ensuring hosting SPA fallback and Capacitor deep links are configured.

### 1.2 Existing libraries/services and workflows

- `src/lib/firebase.js`: Firebase initialization, Firestore persistent cache with multi-tab manager, Auth persistence.
- `src/context/AuthContext.jsx`, `src/components/auth/RequireAuth.jsx`: login, owner protection, sign-out.
- `src/lib/db.js`: Firebase CRUD, localStorage mirrors, books/games subscriptions, reading sessions, import seeding, manual push/pull, backup, game stats.
- `src/lib/bookmory.js`: Markdown import of Bookmory book information, reading log sections, notes/comments, dates and status.
- `src/lib/openlibrary.js`: Open Library and iTunes Books metadata search.
- `src/lib/rawg.js`: RAWG with Wikipedia and CheapShark fallbacks.
- `src/components/books/ReadingTimerModal.jsx`: reading stopwatch, pause/resume, localStorage recovery, progress update, Firestore session persistence.
- `src/pages/app/BooksPage.jsx`: search/add/edit/delete books, status filters, notes, Bookmory import, seed and cloud buttons, timer launch.
- `src/pages/app/GamesPage.jsx`: search/add/edit/delete games, status/rating/platform/hours/review, manual cloud actions.
- `src/pages/LibraryPage.jsx`: public books and games cards, statistics, charts, and tabs.
- `src/components/navigation/BottomTabs.jsx`: diary header, backup button, theme, sign out and 4 bottom links.
- `src/data/books.js`: bundled historical collection, including fields that must be classified as private.
- `src/components/Layout.jsx` and portfolio components: preserve public site styling and navigation.

### 1.3 Baseline source issues to address (priority ordered)

| ID | Priority | Source/evidence | Required remediation |
|---|---|---|---|
| SEC-01 | P0 | `src/data/books.js` includes `logs` and `privateNotes`; public components import static books | Remove private history from client-shipped public bundle, migrate to private storage, sanitize public projection |
| SEC-02 | P0 | `AuthContext.jsx` reads cached user as real auth; restores cached UID on Firebase unauthenticated callback | Verified Firebase auth state only; block route while verification pending; server rules enforce UID |
| DATA-01 | P0 | `BooksPage.jsx` automatically calls `seedExistingBooks` based on device-local marker | Disable unsafe auto-seeding; replace with one-time idempotent migration |
| DATA-02 | P0 | `db.js` local mirrors + deleted ID list + Firestore + manual push/pull lack deterministic conflict handling | Choose authoritative persistence strategy; durable pending writes, explicit statuses, stable IDs/tombstones |
| DATA-03 | P1 | `db.js` uses `Number(bookData?.pages) || 350` and related hardcoded 350 fallbacks | Model unknown total pages as null; no fictional denominators |
| DATA-04 | P1 | `db.js` `addReadingSession` prepends sessions without upserting by ID | Idempotent session writes/imports |
| DATA-05 | P1 | `seedExistingBooks` and `bookmory.js` convert each summary reading log into a session spanning invented page ranges | Preserve historical aggregates with provenance; do not fabricate session dates/pages |
| DATA-06 | P1 | `bookmory.js` matches by title only | ISBN/edition/source ID matching and collision review UI |
| DATA-07 | P1 | `updateBookProgress` can keep stale `finishedOn` after un-completing | Explicit status/date consistency, corrections and event revisions |
| DATA-08 | P1 | `calculateGameStats` and public stats treat `finishedOn` as sufficient to count a game finished | Canonical current status/attempt-completion rules; clear stale finish dates |
| UX-01 | P1 | `LibraryPage.jsx` initializes `activeTab` from a prop only | Derive selected tab from URL or separate pages |
| UX-02 | P1 | Diary `BottomTabs` opens `/stats` and `/portfolio`, leaving the diary shell | Five-tab native diary shell; public site opened as explicit outbound view |
| UX-03 | P1 | One shared `active_reading_timer` localStorage key; timer state owned by modal | Global timer controller; one active activity policy; robust recovery |
| UX-04 | P2 | Current Add/Edit modals with long internal forms | Search-first, mobile-first full-screen/sheet workflows |
| UX-05 | P2 | Fixed bottom nav without explicit safe-area treatment | Handle `env(safe-area-inset-bottom)` and Capacitor layout |
| META-01 | P2 | CheapShark fallback fabricates some generic metadata | Mark unknown metadata as unknown; correct or allow manual override |

**Evidence limit:** The ZIP contains only `src/`, not Firestore security rules, full package manifests, lockfiles, Capacitor configuration, deployment settings, or runnable screenshot assets. This plan must not claim those were audited or that deployed rules are secure/unsafe without testing them.

---

## 2. Product Rules and Experience Principles

### 2.1 The two separate experiences

**Public portfolio**: a responsive web identity for visitors. Preserve the editorial style (DM Sans/Outfit per `CURRENT_UX.md`), hero, About/Experience/Projects/Certificates/Contact, dark/light support and existing interaction conventions. Add tasteful published shelf/highlights only.

**Private diary**: a mobile-first signed-in experience with the same visual family but warmer/friendlier accent treatment, comfortable book/game artwork, tactile cards, persistent controls, and a clear primary action to add or log activity. The journal is not a CMS admin panel.

### 2.2 Core mental model

```
Discover media → Add to personal library → Start an attempt/playthrough
    → Log real dated sessions and notes → Track progress
    → Finish / pause / drop / replay / reread
    → Review personal calendar and insights
    → Optionally publish selected highlights to portfolio
```

- **Catalog item:** What the work/edition/game is.
- **Library item:** Your relationship with it, including status, rating and visibility.
- **Attempt:** A particular reading attempt or game playthrough. Supports multiple rereads/replays.
- **Session:** An actual block of reading/playtime (timed or manually entered).
- **Journal entry:** A dated thought/quote/reflection, optionally attached to a media item and/or session.
- **Public projection:** Sanitized, approved copy of selected library information, never an uncontrolled live private document.

### 2.3 UX requirements shared by every screen

- Show meaningful loading, empty, error, offline, pending-sync and success states.
- Keep primary actions within comfortable reach on mobile and reachable by keyboard on web.
- Bottom navigation remains visible across private top-level screens but not over full-screen editors or native keyboard.
- Preserve scroll position for tab switches where appropriate; restore position returning from detail view.
- Confirm destructive operations with clear language; provide undo where feasible.
- Date display uses the owner's configured timezone (default `Asia/Manila`), not implicit UTC slicing.
- Avoid animated scroll effects inside diary lists/forms; continue using Lenis only where appropriate for the public portfolio.
- Respect `prefers-reduced-motion` and WCAG contrast/touch targets.

---

## 3. Target Information Architecture

### 3.1 Routes (keep `HashRouter` initially)

```
PUBLIC WEB
/#/                       → existing HomePage
/#/portfolio              → existing HomePage
/#/library                → compatibility alias /public/books
/#/stats                  → compatibility alias /public/games
/#/public/books           → published bookshelf
/#/public/games           → published games
/#/public/highlights      → selected public diary highlights (optional phase 4)
/#/login                  → owner sign-in

PRIVATE DIARY (RequireAuth + DiaryLayout)
/#/app                    → /app/home
/#/app/home               → diary dashboard
/#/app/library            → library view (remember Books/Games preference)
/#/app/library/books      → book library
/#/app/library/games      → game library
/#/app/books/:id          → book details
/#/app/games/:id          → game details
/#/app/calendar           → reading + gaming activity calendar
/#/app/journal            → journal timeline/search/filter
/#/app/journal/:entryId   → journal detail/editor
/#/app/insights           → analytics hub (books/games/combined)
/#/app/settings           → theme, visibility defaults, goals, export/import, backup, sync, reminders
/#/app/books              → compatibility redirect to /app/library/books
/#/app/games              → compatibility redirect to /app/library/games
```

Separate public page components or derive active media tab from `location.pathname`. **Do not initialize a route-dependent tab with `useState(initialTab)` and leave it unsynchronized.**

### 3.2 Private primary navigation

Five persistent tabs:

| Tab | Route | Icon suggestion | Core function |
|---|---|---|---|
| Home | `/app/home` | House | Resume and overview |
| Library | `/app/library/books` or last selected | Books | Books/Games collection |
| Calendar | `/app/calendar` | Calendar | History by date |
| Journal | `/app/journal` | Notebook | Notes and reflections |
| Insights | `/app/insights` | Chart | Analytics and goals |

The global `+` action should be a prominent **accessible** add/log control in the app header or floating action button (not an unexplained sixth tab). It opens a small chooser: **Add Book**, **Add Game**, **Log Reading**, **Log Playtime**, **Write Note**. Settings and Portfolio are in an avatar/menu drawer or profile sheet; tapping Portfolio must provide a clear route back to Diary.

### 3.3 Public navigation

Preserve existing header/anchor menus and project/certificate links. Public Books and Games have separate route-accurate headers/tabs so deep linking and back behavior are deterministic. Never include private shell controls, account email, backups or admin actions on public pages.

---

## 4. Screen-by-Screen UX Functional Specification

### 4.1 Private Diary Home (`/app/home`)

**Visual structure (top-down)**

1. Top app bar: greeting/date, subtle personal avatar, search/quick-add and settings.
2. Currently Active: horizontal book/game cards with cover, status, progress, last session and **Continue** action.
3. Today Summary: reading minutes, pages recorded, gaming minutes, total activities for today; show `—` when unknown rather than 0 for missing historical data.
4. Quick Actions: Add Book, Add Game, Log Session, Write Note.
5. Activity Calendar preview: last 7 dates with miniature cover art or restrained markers.
6. Recent Journal: latest real saved entries, truncated previews; mark private/public visibly.
7. Goal Progress: relevant current reading/gaming goals; hide elegantly when none created.
8. Recent Completions: recent finished books/games; optional short celebration on actual completion event only.

**Behaviors:** Selecting current media navigates to detail; Continue resumes an eligible active timer or opens a new session flow; dashboard reacts immediately to persisted changes (without page refresh); private data never loads from public shelf adapters.

**Empty state:** Friendly illustrations/icons and separate CTA for logging first book/game; no fake 0% charts.

**Acceptance:** With no items, screen still navigable; with only books, no blank game widgets; recently saved activity appears once, across home/calendar/journal/insights.

### 4.2 Library (`/app/library/books`, `/app/library/games`)

**Structure:** Search field; segmented Books/Games switch; sort/filter; status chips; cover-grid/list toggle; optional collections/tags; mobile FAB for adding media.

**Book statuses:** `want-to-read`, `reading`, `completed`, `paused`, `dropped`, `rereading` (display aliases may vary). Legacy `dropped` remains supported. Current status is distinct from an attempt's status. Do not retroactively rewrite historic attempt statuses.

**Game statuses:** `backlog`, `playing`, `finished`, `paused`, `dropped`, `replaying`; optional `wishlist` as an explicit state/collection rather than guessing from backlog.

**Card:** Artwork, title, creator, single primary status, progress appropriate to media type, optional rating, last activity date, and 1 direct action. Long-press/context menu for edit, favorite, visibility and delete; avoid tiny cluttered edit/trash buttons on every card.

**Filters:** Status, genres/tags, favorites, public/private, platform (games), reading format (books); combinable with search; clear-all; persist last selections per device if useful. Search should inspect title and creator; do not search private note bodies unless inside authenticated diary.

**Empty states:** New collection, no filter matches, search provider offline, no internet; always preserve manual add.

**Acceptance:** Status/filter counts equal displayed entities; `dropped` can be found; switching Books/Games preserves scroll and valid filters independently; 100+ covers remain responsive.

### 4.3 Add Book flow

1. Choose **Add Book**.
2. Search-first page/sheet, supporting title/author and ISBN. Debounce (~300–400 ms), cancel or ignore stale requests, show source/provider and edition identifiers where known.
3. Choose a result; show preview with cover, title, authors, edition, language/publisher/ISBN if provided, and page count if known.
4. Confirm/edit information. Permit manual-only entry and personal cover upload where supported by storage/licensing.
5. Choose initial status (default Want to Read), optionally started date, collection, tags, favorite. Private visibility by default.
6. Save locally/offline when supported; clearly display pending sync or failure.
7. Open Book Detail with contextual action: Start Reading, Update Progress, Add Note.

**Do not:** auto-fabricate 350 pages; collapse different ISBN editions based on title alone; show selection success if saving actually failed; silently replace a user-edited cover.

### 4.4 Book Detail (`/app/books/:id`)

- Header with cover, title/author, format/edition, status, rating/favorite, safe options menu.
- Progress card: page/percentage/chapter depending on tracking unit; goal of current attempt; optional remaining estimate only with reliable speed samples.
- Strong **Start/Resume Reading** button; manual **Log Reading** secondary action.
- Tabs/sections: **Overview**, **Sessions**, **Notes & Quotes**, **Attempts**; edit action.
- Session history with date, actual active duration, page interval, notes, source/provenance.
- Mark completed, paused, dropped, reread; allow manual completion date and corrections.
- Public visibility settings with preview; private notes are not automatically included.
- Delete with confirmation specifying history impact; default soft-delete where appropriate.

### 4.5 Game Detail (`/app/games/:id`)

- Header with artwork, title/developer, chosen platform, status, rating, favorite.
- Playtime card clearly distinguishes **verified session time** from **manually entered historic baseline time**.
- **Start/Resume Gaming** + **Log Play Session** buttons.
- Tabs/sections: **Overview**, **Sessions**, **Journal**, **Playthroughs**, optionally milestones/screenshots.
- Completion date belongs to the appropriate playthrough; reopening a game must not overwrite the original finish history.
- Game platform represents the user's actual selected platform, while API-supported platforms can be separate metadata.
- Manual progress (optional) should not claim universal game % completion unless the owner explicitly enters it.

### 4.6 Timer experience (books + games)

**Reusable service, separate UI labels**: One global `ActivityTimerProvider`, `timerEngine`, and `ActiveTimerTray`. Book and game timers use the same reliable state machine but different finish forms. The service can support one active timer at a time for v1.

States: `idle` → `running` ↔ `paused` → `review` → `saved`, and `discarded`. Distinguish user closing the screen from ending the timer.

UI behavior:

- Full-screen, distraction-free time screen; large `HH:MM:SS`, artwork/title, pause/resume button, Finish/Log Session.
- Persistent mini-tray/banner on other private screens if an activity is still active.
- Starting another media timer prompts to **Resume Existing / Finish Existing / Discard Existing**; never silently overwrite `active_reading_timer`.
- When review opens, freeze elapsed time; book form shows from/to page and optional notes; game form shows hours/minutes and optional milestones/notes.
- Explicit save status: `Saved on this device`, `Syncing`, `Synced`, or `Needs attention`.
- Avoid `Math.max(1, Math.round(seconds/60))` as the authoritative duration: store integer **active seconds**, present rounded minutes only for display. Permit valid short sessions; optionally prompt for accidental 1–5s sessions.
- Support manual session entry without timer; include source = `manual` / `timer` / `import_aggregate`.
- Android background/kill behavior must be tested; scheduled notifications or foreground-service claims require separate native implementation and permission review.

**Timer state contract:**

```
activeTimer = {
  timerId,
  mediaType: "book" | "game",
  libraryItemId,
  attemptId,
  state: "running" | "paused" | "review",
  startedAtISO,
  timezone: "Asia/Manila",
  accumulatedActiveMs,
  runningSinceEpochMs: number | null,
  fromPage?: number | null,
  updatedAtISO
}
```

On resume, compute time from real elapsed timestamps; use monotonic timing during one continuous foreground process where appropriate. Persist only at state transitions and safe checkpoints. Use `Date.now()` fallback after app/webview restart; handle clock jumps sensibly and allow adjustment. Active elapsed duration must exclude paused intervals. For calendar allocation across midnight, store active intervals if you want correct per-day distribution; do not treat a whole overnight session as occurring at a single timestamp without an explicit product rule.

**Acceptance:** Refresh during Running keeps accurate duration; refresh during Paused adds zero; navigating to another tab does not stop timer; native background/resume works according to documented limitations; completing twice does not duplicate session; changing books does not erase timer.

### 4.7 Calendar (`/app/calendar`)

**Key Bookmory-inspired feature:** A visually pleasant month grid that uses small **real book/game covers** on dates where verified activity took place. Use visually distinguishable small markers or cover positioning for book vs game. A month/day can contain multiple media items.

- Month navigation arrows/swipe (only when swipe does not conflict with scrolling); jump to today; accessible month picker.
- Day cell: date, up to 2 mini covers, `+N` if overflow, readable active-day state, today highlight.
- Tap a date: bottom sheet/day-detail route with ordered sessions, notes, totals and media items; tap a session to edit/view.
- Filters: All / Books / Games; optional Show Sessions / Completions / Notes. Filter state persists through month navigation.
- Month totals: verified sessions, active minutes, completion counts; totals distinguish known from imported aggregate data.
- Calendar export: optional image export in later phase, with private/public preview and explicit consent before sharing.
- Use local calendar date derived from `occurredAt` + owner's timezone; store UTC instant plus timezone for factual events. For historic date-only entries, keep `YYYY-MM-DD` without synthesizing midday UTC as actual activity.
- Never interpolate reading/gaming on days between a logged start and completion just because a period spans those dates.

**Acceptance:** A timed reading session and a timed game session on the same date both appear; taps show exactly those records; daylight/timezone boundaries behave; backdated manual entries show on chosen day; imported multi-day aggregate records do not fake daily entries.

### 4.8 Journal (`/app/journal`)

Journal types: `reflection`, `book_quote`, `game_moment`, `session_note`, `review`, `milestone`, and `general_note` (type selection optional to simplify first release). Fields: date/time, title optional, body, linked media optional, linked session optional, location optional **only if deliberately entered**, privacy, tags, attachments, created/updated timestamps, provenance.

- Timeline view grouped by local date; search, Book/Game/All, media selector, tag and entry-type filters.
- Full-screen mobile editor with autosave **draft** and explicit Publish/Save. Drafts remain private.
- Rich text optional after plain-text reliability. For quotes, preserve exact quote text and page reference without inventing metadata.
- Images/screenshots optional; compress images and sanitize metadata as appropriate; native photo permissions only when needed.
- Deletion undo; edit history optional; public excerpt is **separately selected**, not the full underlying entry.
- On the Book/Game detail page, show entries filtered to media ID; the same record appears in global Journal.

### 4.9 Insights (`/app/insights`)

Sections: Combined, Books, Games. Date range selectors: month, year, all time and optional custom. Cards and charts must be based on the same canonical queries that drive Calendar, not separately stored drifting counters.

**Books:** count in library, completed reads/attempts, currently reading, actual pages logged (when page interval known), verified reading minutes, active days, average ratings (rated only), formats, top genres/authors, goals/streaks.

**Games:** unique games, finished playthroughs vs unique finished titles, active gaming minutes, historic manual baseline hours **reported separately**, genres/platforms, ratings distribution (0–10), finished by year, current backlog/playing.

**Combined:** combined activity days, session time by media type, calendar trend, recent completions, private yearly recap. Don't add reading pages and game hours into meaningless mixed numerical totals.

**Metric semantics:**

- Reading pages = sum of valid, positive page deltas from actual sessions; dedupe overlapping edits/import records; when only current page is known, show progress, not invented historical `pagesRead`.
- Active minutes = sum of `activeSeconds` / 60 for verified sessions; aggregated historical durations have separately labeled totals.
- Finished games = current `status === 'finished'` for unique titles, or completed attempts when reporting playthroughs. Old `finishedOn` alone is not authoritative if current status changed.
- Rating averages exclude missing/null ratings, not just zero if zero has legitimate meaning on chosen scale.
- Streak = qualifying distinct local dates with genuine dated activity. Specify whether manual logs count (recommended yes, if explicitly dated) and whether zero-minute notes count (recommended no for timer streak, optional separate journaling streak).
- Time-to-finish predictions only when page count and representative reading speed exist; otherwise display unavailable.
- All charts must display units, date ranges, time-zone interpretation and empty states.

### 4.10 Settings / Import / Backup (`/app/settings`)

Subsections: Appearance; Default visibility; Reminder settings; Reading and gaming goals; Data & Storage; Export/Import; Sync diagnostics; Security and Sign Out; About.

Provide a prominent **Export Full Backup** action with schema version, local/cloud sync state and selected destination. Native file creation/sharing must use reliable Capacitor/browser capabilities with actual verification, not assume `navigator.share` can send `File` on all platforms. Provide a **Restore Preview** in later phase (counts, duplicates, conflicts) and confirmation before applying. No blanket replacement of live data on import.

---
## 5. Data Model and Firestore Schema (Target v2)

### 5.1 Rules for entities and identifiers

- Generate stable opaque IDs (e.g., `crypto.randomUUID()` where supported) for user-created library items, sessions, attempts and journal entries. Do not use `Date.now()` as a unique identifier; concurrency and repeat imports can collide.
- Keep external metadata IDs in separate fields (`openLibraryWorkKey`, `openLibraryEditionKey`, `isbn13`, `rawgId`, `itunesTrackId`, `cheapSharkId`, `wikiPageId`) with provider namespaces. Do not use an external cover ID as a universal document identity.
- Catalog items and personal library entries are conceptually separate; implementation can store a small catalog snapshot inside an item initially to reduce queries, provided ownership/identity remains explicit.
- Capture `createdAt` and `updatedAt` as Firestore timestamps where possible, and a local ISO timestamp for optimistic/offline display. Distinguish timestamp of the activity (`occurredAt`) from timestamp of entry (`createdAt`).
- Use `schemaVersion: 2` in migrated/new documents. Preserve `legacyId`, `importSource`, `sourceFileHash`, and migration version for traceability.
- Never require unknown metadata fields to contain invented values. Favor `null` with well-defined optional-field validation.
- Store monetary values or external provider identifiers only as optional fields; not a target for v1 UI.

### 5.2 Proposed private Firestore layout

```
users/{OWNER_UID}
  preferences/main
  mediaCatalog/{catalogId}                  # owner's cached normalized provider metadata
  libraryItems/{libraryItemId}              # personal book/game record
  attempts/{attemptId}                     # book reread or game playthrough
  sessions/{sessionId}                     # actual sessions, for cross-media day queries
  historicalAggregates/{aggregateId}       # imported multi-day time, not a dated session
  journalEntries/{entryId}                 # private source entry and optional publication marker
  collections/{collectionId}
  goals/{goalId}
  milestones/{milestoneId}                 # optional later
  syncMetadata/{key}                        # migration metadata, public projection version
  migrationRuns/{migrationRunId}            # manifest and status, no sensitive full backups

publicProfiles/{OWNER_UID}
  profile/main                               # public profile fields only
  shelf/{publicItemId}                      # explicitly published sanitized snapshot
  highlights/{highlightId}                 # deliberately published safe excerpt
  aggregates/{aggregateId}                 # explicitly enabled and privacy-reviewed stats
```

The public tree must be readable without authentication while the private tree must not. A Firestore collection name does **not** grant access control; security comes from **deployed Firestore rules** (and any trusted backend performing administrative writes).

### 5.3 Canonical item shapes (examples, not actual current documents)

**Library item**

```json
{
  "schemaVersion": 2,
  "mediaType": "book",
  "catalogId": "openlibrary:edition:OL12345M",
  "title": "Example Title",
  "creators": ["Example Author"],
  "coverUrl": null,
  "status": "reading",
  "favorite": false,
  "rating": null,
  "ratingScale": 5,
  "progress": { "unit": "page", "current": 42, "total": null },
  "tags": [],
  "collectionIds": [],
  "visibility": "private",
  "activeAttemptId": "attempt-uuid",
  "legacyId": null,
  "origin": "manual",
  "createdAt": "<Firestore Timestamp>",
  "updatedAt": "<Firestore Timestamp>"
}
```

For a game, use `mediaType: "game"`, `ratingScale: 10`, `playedPlatform`, optional `historicPlaySeconds`, and a `progress` unit such as `percent` only if the owner explicitly tracks it. Display total reported hours as `historicPlaySeconds + verifiedSessionSeconds` **only when historic baseline covers periods before the verified sessions**. If not known, show baseline and tracked time as separate figures to avoid double counting.

**Attempt/playthrough**

```json
{
  "schemaVersion": 2,
  "libraryItemId": "item-uuid",
  "mediaType": "book",
  "ordinal": 1,
  "status": "in_progress",
  "startedOn": "2026-10-19",
  "completedOn": null,
  "abandonedOn": null,
  "progress": { "unit": "page", "current": 42, "total": null },
  "createdAt": "<Firestore Timestamp>",
  "updatedAt": "<Firestore Timestamp>"
}
```

**Dated session**

```json
{
  "schemaVersion": 2,
  "libraryItemId": "item-uuid",
  "attemptId": "attempt-uuid",
  "mediaType": "book",
  "source": "timer",
  "startedAt": "2026-10-19T12:00:00.000Z",
  "endedAt": "2026-10-19T12:28:45.000Z",
  "timezone": "Asia/Manila",
  "activeSeconds": 1590,
  "activeIntervals": [
    { "start": "2026-10-19T12:00:00.000Z", "end": "2026-10-19T12:26:30.000Z" }
  ],
  "progressBefore": 25,
  "progressAfter": 39,
  "progressUnit": "page",
  "note": null,
  "importId": null,
  "deletedAt": null
}
```

The example is illustrative; ensure `activeSeconds` agrees with actual active intervals in real data. If the user edits the duration, record the manual override and provenance rather than silently changing the intervals.

For manual sessions, `startedAt` and `endedAt` can be optional or synthesized only when the user explicitly provides times. A `localDate` can be stored when the user supplied a date but not a clock time. Calendar attribution must use the correct representation.

**Imported multi-day aggregate**

```json
{
  "schemaVersion": 2,
  "mediaType": "book",
  "libraryItemId": "item-uuid",
  "source": "bookmory_markdown",
  "periodStartDate": "2025-11-19",
  "periodEndDate": "2025-12-02",
  "totalMinutes": 920,
  "pagesRead": null,
  "datePrecision": "range",
  "sourceRecordKey": "sha256-file-hash:log-1",
  "rawImportedComment": "<private field, actual value stored only in owner data>",
  "isDailySession": false
}
```

This type **may contribute to historical aggregate totals** but must not be assigned to individual dates or falsely counted as a verified timed session. Avoid double-counting if the same imported aggregate previously created synthetic sessions in v1; mark those old records as superseded in the migration map rather than simply retaining both.

**Journal entry**

```json
{
  "schemaVersion": 2,
  "type": "reflection",
  "mediaType": "game",
  "libraryItemId": "item-uuid",
  "attemptId": "attempt-uuid",
  "sessionId": null,
  "title": "",
  "body": "My personal reflection",
  "occurredOn": "2026-10-19",
  "occurredAt": null,
  "timezone": "Asia/Manila",
  "tags": [],
  "attachmentRefs": [],
  "visibility": "private",
  "publicExcerpt": null,
  "importSource": null,
  "createdAt": "<Firestore Timestamp>",
  "updatedAt": "<Firestore Timestamp>"
}
```

### 5.4 Required entity relationships

```
Catalog metadata 1 ── N Library items (editions and user records)
Library item    1 ── N Attempts / playthroughs
Attempt         1 ── N Sessions
Library item    1 ── N Journal entries
Session         0 ── N Journal entries
Library item    N ── N Collections
Library item    0 ── 1 Public shelf projection (or multiple approved versions)
Journal entry   0 ── 1 Explicit public highlight
```

Support rendering a deleted item's historical activities as **unlinked/deleted media** when retention is requested, or cascade intentionally with an explicit deletion policy. Do not silently leave orphaned public projections.

### 5.5 Queries and necessary indexes

- `libraryItems` by `mediaType`, `status`, `updatedAt`.
- `sessions` by `startedAt` (range by month), optionally `mediaType` + `startedAt` and `libraryItemId` + `startedAt`.
- `journalEntries` by `occurredAt`/`occurredOn` and by `libraryItemId` + event date.
- `attempts` by `libraryItemId` + `startedOn`.
- `publicProfiles/{uid}/shelf` by `mediaType` + `publishedAt`.
- `historicalAggregates` by media ID and source identity for imports.

Create Firestore composite indexes only where query plans require them; capture exact index specs in `firestore.indexes.json` once the complete repo is available. Page/limit lists and query within a bounded date range; avoid downloading every session to draw a single calendar month.

### 5.6 Schema validation

Create shared `domain` validation helpers or Zod schemas if a compatible dependency can be added safely. Validate at UI and persistence boundaries:

- Media types must be known values.
- Book page totals: null or positive integer; current page: nonnegative and ≤ total when total known.
- Rating: null or number 0–5 for books (with configured allowed increments), 0–10 for games; do not treat 0 as missing automatically.
- Active seconds: integer ≥ 0; no infinite/NaN values.
- Start/end times: valid ISO instants with end ≥ start; date-only strings validated separately.
- Status transitions: explicit and reversible; don't keep a finished date on a currently unfinished attempt without retaining it in previous attempt history.
- Visibility: `private | public_shelf | public_highlight` (or equivalent deterministic model); public excerpts must be opt-in.
- External image links must use safe HTTP(S) URLs; URLs from providers can fail and require placeholders.

---

## 6. Security, Owner Authorization, and Public/Private Isolation

### 6.1 Fix authentication state first

Current problem: `AuthContext.jsx` uses a `localStorage` cached UID as user authority before and even after Firebase confirms no current user. Replace this with:

```js
// Conceptual pattern — adapt to actual existing AuthProvider.
const [user, setUser] = useState(null);
const [loading, setLoading] = useState(true);
useEffect(() => {
  if (!auth) { setUser(null); setLoading(false); return; }
  return onAuthStateChanged(auth, verifiedUser => {
    setUser(verifiedUser ?? null);
    setLoading(false);
  });
}, []);
const isOwner = !!user && !!OWNER_UID && user.uid === OWNER_UID;
```

- A cached non-secret display email may be shown in a temporary skeleton, but **never** authorize private routes or data access.
- If Firebase is missing/unconfigured, fail closed for diary routes. The current `!OWNER_UID` owner fallback should not be a production permission bypass.
- On sign-out, stop authenticated listeners, clear in-memory owner state, and prevent rendering prior-user cache contents to the signed-out UI.
- Firebase auth persistence can support returning signed-in owner offline where the SDK has authenticated persisted state, but offline UI permissions must never be inferred from a manually editable cached object.
- Do not display or log password, access token, private notes or backup contents in diagnostics.

### 6.2 Firestore security rules — illustrative target

**These are a starting template requiring review, testing and adjustment to your deployed collections. They are not claims about the current production rules.** Replace `OWNER_UID_TO_CONFIGURE` using a controlled deployment process, not from an untrusted client-provided request field. Example assumes dedicated public projections and an owner-only private tree:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isOwner() {
      return request.auth != null &&
             request.auth.uid == 'OWNER_UID_TO_CONFIGURE';
    }

    match /users/{uid} {
      allow read, write: if isOwner() && request.auth.uid == uid;
      match /{document=**} {
        allow read, write: if isOwner() && request.auth.uid == uid;
      }
    }

    match /publicProfiles/{uid} {
      allow read: if true;
      allow write: if isOwner() && request.auth.uid == uid;
      match /{document=**} {
        allow read: if true;
        allow write: if isOwner() && request.auth.uid == uid;
      }
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Additional hardening before deployment:

- Validate public document fields, sizes, and media types via rules and/or a trusted backend publisher. **Restricting writes to the owner does not stop the owner's own buggy code from publishing private fields.** Prefer a single `publishSnapshot()` sanitizer with explicit allowlist and integration tests; for higher assurance, perform publication via a trusted backend/Cloud Function that enforces an approved schema.
- Deny public access to legacy `users/{uid}/books` and `users/{uid}/games` **only after** public pages have been migrated to the new published shelf. Stage rule changes to avoid breaking the website.
- Use Firebase Emulator tests to confirm: unauthenticated private reads denied; other authenticated UID denied; actual owner allowed; public projection readable; attempted private-field publication blocked by validation where enforced; writes to other top-level paths denied.
- Firebase client `VITE_*` keys and `VITE_OWNER_UID` are compiled into bundles and **not security secrets**. Do not embed admin/service-account credentials in client code.
- Reassess raw media provider keys and their quota/origin restrictions if used directly from the browser.

### 6.3 Remove private legacy data from public assets

1. Locate all imports of `src/data/books.js` (`db.js`, public `Library.jsx`, and others). Inventory private fields `logs`, `privateNotes`, imported comments and future session data.
2. Export a complete encrypted or securely stored owner backup before deletion or transformation.
3. Replace public bundled data with a **sanitized public-only projection** if a build-time fallback is still needed; never include private notes or history.
4. Move historical logs/notes into owner-only storage via one-time migration; use source/provenance markers.
5. Verify production **JavaScript bundles and sourcemaps** no longer contain previously bundled private note text. Do not publish private source maps to a public server.
6. Assume old published assets may have been cached or archived; removing from current builds cannot retroactively revoke past downloads. If the notes are sensitive, treat this as prior exposure and decide whether further action is appropriate.

### 6.4 Local data and device privacy

- Browser localStorage is readable by scripts running under the origin and by users with local browser profile access; it is not secure storage for sensitive private notes.
- Prefer Firestore's documented persistent cache for ordinary offline data after evaluating its behavior, or an owner-scoped IndexedDB store where stronger query/mutation control is required. Do not maintain uncontrolled anonymous mirrors of private records.
- On shared web browsers, show a clear warning if private notes are retained offline; optionally clear persistence on sign-out (after synchronizing confirmed pending changes or offering export). Encryption at rest requires a realistic key management plan; simply hardcoding a key in JavaScript is not meaningful protection.
- On native Capacitor, evaluate secure storage plugins for tokens/keys and platform backup policies. Do not claim full local encryption without testing.
- For camera/photo attachment features, ask platform permissions only at use time.

---

## 7. Offline-first Persistence and Synchronization

### 7.1 Architectural decision (implement one, not both)

**Preferred first path: Firebase Firestore SDK's offline persistence**, already initialized in `src/lib/firebase.js`, plus reactive listeners and `snapshot.metadata.hasPendingWrites` / `fromCache` indicators. This may satisfy local-first writes for the current single-owner application without the custom `localStorage` book/game mirrors. Verify actual SDK persistence behavior in both browsers and Capacitor WebView on each supported OS/version.

**Alternative if stronger control is needed:** one canonical IndexedDB/SQLite-like local store + durable `outbox` mutation queue + cloud synchronization. This is significantly more work. Avoid building an independent outbox **and** using Firestore's transparent write queue without defining which queue owns mutations; duplicate layers invite conflicts.

**Recommended progression:**

1. Audit live Firestore listener and cache behavior in a sandbox project.
2. Fix auth; remove `seedExistingBooks()` from automatic lifecycle.
3. Introduce a repository abstraction returning records with sync metadata, keeping legacy adapters during migration.
4. Move new writes through the repository; confirm Firestore offline persistence can cover create/edit/delete.
5. Remove old local mirror write paths **only after** all local-only records have been detected, exported and migrated.
6. Treat save as successful locally only if the SDK confirms local enqueue/persistence; show pending remote confirmation separately.
7. If the SDK cannot meet native offline requirements, implement a **single** explicit durable outbox and test it under app process termination.

### 7.2 Minimum repository contract

```ts
// TypeScript-style interface specification; the existing app can remain JSX/JS.
interface DiaryRepository {
  observeLibraryItems(filter): Unsubscribe;
  getLibraryItem(id): Promise<LibraryItem | null>;
  saveLibraryItem(item): Promise<SaveResult>;
  deleteLibraryItem(id): Promise<DeleteResult>;
  observeMonthActivities(month, timezone, filters): Unsubscribe;
  createSession(session): Promise<SaveResult>;
  listSessions(libraryItemId, options): Promise<Session[]>;
  createJournalEntry(entry): Promise<SaveResult>;
  updateJournalEntry(id, patch): Promise<SaveResult>;
  observeJournalEntries(filter): Unsubscribe;
  publishLibraryItem(id, options): Promise<PublishResult>;
  unpublishLibraryItem(id): Promise<void>;
  exportData(): Promise<ExportPayload>;
  getSyncStatus(): SyncStatus;
}
```

`SaveResult` should distinguish `savedLocal`, `queuedForRemote`, `remoteConfirmed`, and `error`. Do not present remote confirmation until observed. On conflicting updates from another device, use an explicit policy (see below), not silently trust whichever observer callback fired last.

### 7.3 Conflict policy

- **Sessions and journal entries:** immutable stable IDs on creation; edits update the same ID with monotonically tracked revisions where possible. Distinct IDs are separate events. Retries of one event must be idempotent.
- **Deletion:** mark deleted with a tombstone or maintain a reliable deleted-state record. Remote delete must not be resurrected by a stale local snapshot.
- **Library item metadata:** personal edits win over provider search refreshes; provider metadata updates must not overwrite user-modified status/rating/cover.
- **Conflicting journal edits:** preserve both conflicting versions or show a resolution UI if the backend cannot safely merge. Never discard one side silently.
- **Time/session correction:** maintain a revision/updated timestamp and an edit event when accuracy matters; prevent repeated completion callbacks from creating duplicate sessions.
- **Public projection:** new approved snapshot reflects the current selected fields, and unpublish removes the snapshot even if the phone is offline (mark pending until cloud confirms).

### 7.4 What to remove from `db.js` once migrated

The v1 `LS_GAMES_KEY`, `LS_BOOKS_KEY`, `LS_SESSIONS_KEY`, `LS_GAME_NOTES_KEY`, `LS_BOOK_NOTES_KEY`, and shared `LS_DELETED_IDS_KEY` mirror system must not stay as a second source of truth. Migration should explicitly identify local-only data and tombstones first. A single deleted-ID set across books and games can also collide when IDs overlap. Retire manual **Pull from Cloud / Push to Cloud** as everyday UX when reliable automatic sync is in place; keep an advanced diagnostics screen for failures.

### 7.5 Sync states shown in UI

| State | UI label | Allowed action |
|---|---|---|
| Durable local save, remote pending | Saved offline / Syncing | Continue working; retry automatically |
| Remote acknowledged | Synced | Normal operation |
| Offline cache only, no new mutation | Offline | Browse/edit local data |
| Permission denied or invalid auth | Sign in again / Permission issue | Do not keep claiming syncing |
| Conflict requiring intervention | Needs review | Open conflict resolver |
| Migration running | Importing X of Y | View progress, cancel safe staging |

Do not log user note bodies or private titles unnecessarily in production error telemetry.

---

## 8. Historical Data Migration — Mandatory Non-Destructive Procedure

### 8.1 Before migration

- Create Git tag and backup branch, and a full snapshot of production Firestore using appropriate administrative tooling (requires backend/project-owner access; not available in the ZIP).
- Export the current owner's client data using the existing `exportUserData()` **and** capture any browser-local-only records from each device. Because the existing export merges fallbacks and local data, **it is not by itself a guaranteed authoritative cloud snapshot**.
- Save `src/data/books.js` outside the shipped app bundle as a restricted migration source; preserve hashes of input data files.
- Record counts before changes: library books, games, private notes, reading sessions, deleted IDs, historical logs, and completed statuses; collect checksums/identifiers so post-migration diffs are reviewable.
- Test in a **staging Firebase project** first. Do not use production for iteration.
- Freeze automatic seeding and disable destructive cloud push/pull during migration; retain read-only export support.

### 8.2 Migration version and identity matching

Define a deterministic `migrationRunId`, `migrationVersion: "v2.0"`, and source ID mapping.

Preferred book match order:

1. Existing stable internal `legacyId` mapping from an earlier dry run.
2. Exact validated ISBN13 **plus compatible edition metadata**.
3. Exact external edition key (Open Library edition, iTunes track) with source namespace.
4. Work key plus edition-independent matching only when safe and explicitly reviewed.
5. Normalized title **plus compatible author**, shown as a proposed match in the review UI.
6. Otherwise create a separate item, preserving source identifiers.

For games: prefer existing internal ID mapping, then namespaced RAWG ID, then provider-specific IDs, then normalized title + developer/release/platform information if sufficient, and manual resolution for ambiguous hits.

**Never merge on title alone** as current `importBookmoryBooks()` does.

### 8.3 Importing Bookmory Markdown safely

The existing importer recognizes `### Book information`, `### Reading log`, and purchase sections in its description; parser code specifically extracts status, author, ISBN, total pages, tags, log dates, ratings, comments and total reading time. Expand parsing with fixtures representing actual export variants before changing it.

**Correct conversion rules:**

| Source field | Target | Preservation rule |
|---|---|---|
| Title/authors/ISBN | Catalog/library snapshot | Preserve original strings and corrected metadata separately |
| Total pages | `progress.total` | Unknown remains null; no 350 fallback |
| Reading status | Library/attempt status | Normalize with reversible mapping |
| Start/end dates | Attempt `startedOn` / `completedOn` | Keep dates as dates, no invented clock times |
| Reading log time total | `historicalAggregates.totalMinutes` | Label as aggregate, not daily verified session |
| Reading-log comment | Owner-private journal entry or aggregate note | Preserve full text privately and provenance |
| Rating | Personal rating | Use appropriate book scale and original value |
| Favorite collection | `favorite` + optionally original collection | Preserve without guessing genres |
| Tags | Tags/collections | Preserve original tags even when not treated as genres |
| Purchase logs | Optional imported metadata/legacy attachment | Do not silently discard fields; out-of-scope fields may be retained in restricted raw import archive |

**Key rule:** A log recording an overall reading period and total minutes does NOT prove the user read every day in that period, nor that the whole book was read in a single session. Do not put all that time on the first date or assign every log `0→totalPages`. Older synthetic v1 sessions must be identified by their `bookmory_...` pattern **and validated against source/provenance**, then superseded/mapped without double-counting. Never delete source history before verifying the replacement.

### 8.4 Migration execution algorithm

```text
1. Validate backup and input schemas.
2. Create isolated candidate dataset; NO production writes yet.
3. Build old→new ID map for books/games/attempts/sessions.
4. Detect and display collisions, duplicates, invalid ISBNs, unknown pages, ambiguous editions.
5. Dry-run: output counts, sample transformed records, warnings, diff report.
6. Approve staged result; write in bounded idempotent batches.
7. Tag each migrated record with origin/source key and schemaVersion.
8. Verify count, private-note preservation, session deduplication, rating/status/progress parity.
9. Re-run migration on staging to prove it is idempotent (no extra records).
10. Update app readers to new model behind feature flag; verify UI on web/Android.
11. Migrate public shelf projections; test signed-out view.
12. Only now disable legacy reads and retire bundled private source.
13. Keep immutable backups and rollback/migration manifest for the agreed retention period.
```

Firestore batch writes have service limits; partition writes conservatively (e.g., fewer than 400 document operations per batch where applicable) and handle quotas/retries. Ensure the migration is resumable after partial failure.

### 8.5 Rollback criteria

Do not launch if there are missing private notes, unexplained book/game count differences, duplicated or lost sessions, missing cover identifiers, changed statuses or ratings, or a discrepancy between published and intended public-only records. Rollback should restore the previous client version **and** retain an export of v2-only data created after launch; do not replace production with an old backup and discard new user entries.

---
## 9. Metadata Search, Normalization, and External Integrations

### 9.1 Books — preserve working adapters

Existing: `src/lib/openlibrary.js` requests Open Library and iTunes Books, merges and normalizes responses. Keep these integrations where permitted and add a provider adapter interface rather than duplicating fetch logic in components. Optional Google Books support can be evaluated separately for edition accuracy; it is **not** verified as a current dependency and is not mandatory for the MVP.

```ts
interface BookSearchProvider {
  search(query: string, options: { limit: number; signal?: AbortSignal }): Promise<BookCandidate[]>;
  lookupByIsbn?(isbn: string, options): Promise<BookCandidate | null>;
}

type BookCandidate = {
  source: "openlibrary" | "itunes" | "google_books" | "manual";
  workId?: string | null;
  editionId?: string | null;
  isbn10?: string | null;
  isbn13?: string | null;
  title: string;
  authors: string[];
  coverUrl?: string | null;
  totalPages?: number | null;
  publisher?: string | null;
  publicationDate?: string | null;
  language?: string | null;
};
```

Search behavior: local catalog/cache first → provider queries (parallel where sensible) → normalize → rank by exact title/author/ISBN/edition → show distinct editions clearly → user confirmation. Debounce 300–400ms. Cancel or guard against outdated response race; cache only within provider terms. Always offer manual creation. Do not automatically download or distribute full copyrighted book texts.

**Barcode/ISBN scanning** is optional later. In Capacitor, verify a maintained supported scanner/plugin and platform camera permissions; do not install a browser-only package assuming native support.

### 9.2 Games — preserve RAWG, improve fallback

Existing: `src/lib/rawg.js` supports RAWG, Wikipedia and CheapShark fallback. RAWG and alternate provider images/metadata have API terms; review commercial, display, caching and attribution requirements before production. Never infer that a CheapShark result is necessarily played on PC or belongs to a genre merely because a fallback mapping creates generic values.

```ts
type GameCandidate = {
  source: "rawg" | "wikipedia" | "cheapshark" | "manual";
  externalId?: string | null;
  title: string;
  developers?: string[];
  releaseDate?: string | null;
  platformOptions?: string[];
  genres?: string[];
  coverUrl?: string | null;
  metadataConfidence: "exact" | "partial" | "unverified";
};
```

The user selects **their played platform**, separately from the game's general supported platforms. Provide `Edit metadata` in details for wrong art, mislabeled game, duplicate game versions or missing release year. Do not use generated generic genres as objective source data.

### 9.3 Media cover handling

- Preserve artwork aspect ratio without stretch; stable placeholders if URL fails.
- Handle providers returning tiny or missing images; avoid changing a manually overridden cover during metadata refresh.
- Images should lazy-load in long lists; use responsive sizing/`srcSet` where actual image provider supports it.
- Public covers can be displayed only in ways consistent with provider terms, licensing and permitted caching.
- Avoid storing third-party image content in your own CDN without legal and provider-policy review.

---

## 10. Public Portfolio Integration and Publishing Workflow

### 10.1 What stays on public website

Keep `Hero`, `About`, `Experience`, `Projects`, `Certificates`, `Contact`, design tokens, typewriter and touch-safe pixel-trail behavior exactly functioning as before. Portfolio content must **not** require visitor login, and public components must not import or call private diary repositories.

### 10.2 New approved publishing modes

| State | Meaning | Public content |
|---|---|---|
| `private` | Default, diary only | None |
| `public_shelf` | Explicitly approved shelf entry | Title, creator, cover, chosen status, selected rating, chosen tags, published dates as approved |
| `public_highlight` | Shelf + approved reflection | Shelf data plus specific, sanitized, deliberately published excerpt |

Granular options may let the user hide exact activity dates, rating or duration while still showing the item publicly. **Never** make full note text, private session timestamps, private attachment paths, contact email, access tokens or entire book/game records part of public output.

### 10.3 Publish / unpublish flow

1. Owner opens Book/Game Detail → **Share on Portfolio**.
2. Preview exactly which fields will be visible; unchecked private fields do not appear.
3. Confirm → sanitize via allowlisted mapper → write a dedicated public shelf document.
4. If journal excerpt selected, create a separately sanitized `publicProfiles/{uid}/highlights/{highlightId}`. Do not automatically publish all notes tied to the media.
5. Public page observes/query only dedicated public projection collections.
6. Owner edits private diary record → either refresh approved fields automatically (if intended) or show **Update Public Version**. Do not silently leak newly added private fields when schema evolves.
7. Unpublish → delete/disable projection; show `Unpublishing…` until cloud confirms. If offline, clearly label pending.
8. A deleted private item should also remove or mark inactive its public projection through reliable synchronization; test failure/retry behavior.

### 10.4 Explicit safe mapper

```js
// Conceptual example; validate shape and types on publisher/backend as well.
function toPublicShelfItem(item, publishOptions) {
  return {
    schemaVersion: 1,
    mediaType: item.mediaType,
    title: item.title,
    creators: item.creators ?? [],
    coverUrl: item.coverUrl ?? null,
    status: publishOptions.showStatus ? item.status : null,
    rating: publishOptions.showRating ? item.rating : null,
    ratingScale: publishOptions.showRating ? item.ratingScale : null,
    tags: publishOptions.showTags ? item.tags ?? [] : [],
    publishedAt: /* serverTimestamp() on write */ null,
  };
}
```

Do not spread private objects (`{...item}`) into public writes. A trusted callable function or equivalent server publisher provides the strongest policy boundary. In a pure owner-only client architecture, strictly allowlisted mappers plus rules and public-schema tests are the minimum.

### 10.5 Public Books and Games pages

**Books:** Overview tiles based on public shelf only, published reading-status distribution, favorite reel where approved, filter by status/genre/author, card detail with public data only, graceful handling of no public books.

**Games:** Published game count, finished titles and ratings where approved, public genre/platform charts only when sufficient data exists, card detail and filters. Distinguish personal historic hours from accurate timed sessions if showing time at all.

**Portfolio homepage shelf preview:** up to 6–10 selected cover cards, optional top favorites, link to public Books/Games. Do not execute owner-only query from `src/components/Library.jsx` to power this.

---

## 11. Visual Design System and Motion Specification

### 11.1 Preserve recognizable brand

Public current look (from `CURRENT_UX.md`): warm-light gray canvas `#f9f9f9`, near-black dark canvas `#030712`, DM Sans body, Outfit display, minimal borders, restrained cards and a 768px editorial main column. Preserve these values for the public portfolio unless specifically requested otherwise.

**Private diary proposal (not audited existing tokens):** a warmer variant with soft neutral page background, white cards, subtle teal accent and sparse gold completion highlights. Keep the same font families initially; avoid two unrelated brand identities.

| Token | Proposed diary value | Rationale |
|---|---|---|
| `--diary-bg` | `#F9F7F4` | Quiet warm canvas |
| `--diary-surface` | `#FFFFFF` | Legible content cards |
| `--diary-text` | `#252525` | Primary readable text |
| `--diary-muted` | `#696E73` | Secondary text with tested contrast |
| `--diary-accent` | `#3B8990` | Calm teal, subject to contrast check |
| `--diary-accent-soft` | `#E7F3F2` | Status background |
| `--diary-divider` | `#E9E5DF` | Low emphasis |
| `--diary-radius-card` | `16px` | Soft non-gimmicky cards |
| `--diary-page-gutter` | `16px–20px` | Mobile-safe horizontal padding |
| `--diary-touch-target` | `44–48px minimum` | Mobile usability |

Dark theme should use the existing near-black palette with readable contrast; do not simply invert the light theme's book-cover images.

### 11.2 Component interaction patterns

- Cover cards: 2:3 ratio for books where possible; preserve artwork ratios for game covers (often landscape); do not force games into a book-like portrait card without a considered art treatment.
- Mobile full-screen edit flows: top cancel/back, fixed Save within safe area, content scrolls naturally, keyboard behavior tested on Android/iOS.
- Bottom sheets: used for quick actions, filter/sort, day details, confirmation; trap focus where appropriate and restore focus on dismiss.
- Desktop: centered max-width content (e.g., 900–1100px for diary), appropriate grids; no overscaled full-screen mobile bottom sheets.
- Skeletons match card shape; no layout shift; empty cards have thoughtful actions.
- Floating timer tray: supports resume/pause/open; never obscures bottom navigation or device gesture area.

### 11.3 Motion map (recommended; NOT measured Bookmory timings)

| Event | Technique | Target duration | Accessibility |
|---|---|---|---|
| Button press | Small scale/opacity | 100–160ms | No movement when reduced motion |
| Sheet open/close | Transform + fade | 220–320ms | Instant/fade-only alternative |
| Cover → detail | Shared-element illusion or card expand | 240–350ms | Optional, never delay route |
| Calendar month change | Horizontal slide or crossfade | 220–300ms | Instant swap available |
| Progress update | Width interpolation, small count-up | 300–500ms | Static progress |
| Chart entrance | Opacity/stagger | 300–550ms | Render chart without movement |
| Save toast | Opacity/translate | 160–250ms | Screen-reader announcement |
| Completion confetti | Lightweight burst | ≤2s | Disable on reduced motion; never loops |

You already have CSS transitions, scroll reveal, `active:scale-95`, Lenis and animated headings. Favor lightweight CSS for routine UI; if adopting Motion for React or another library, verify current React compatibility/version and keep it local to diary features. Only add Lottie/Rive if a real illustrated animation asset is necessary. Don't import Bookmory's copyrighted animation files or visuals.

### 11.4 Haptics and sound (optional)

On supported Capacitor native builds, a subtle haptic response on timer start/stop and completion can improve tactility. Make it opt-in/disableable and call it only after confirming the event. Do not trigger haptics on every scroll/tap; web should gracefully no-op.

---

## 12. Client Architecture and File-by-File Refactor Map

### 12.1 Target folder structure

```
src/
  app/
    routes/
      AppRoutes.jsx
      ProtectedRoutes.jsx
      LegacyRedirects.jsx
    layouts/
      PortfolioLayout.jsx
      DiaryLayout.jsx
    providers/
      DiaryProviders.jsx
      ActivityTimerProvider.jsx
    theme/
      diaryTokens.css

  features/
    home/
      pages/DiaryHomePage.jsx
      components/CurrentMediaCard.jsx
      components/TodaySummary.jsx
    library/
      pages/DiaryLibraryPage.jsx
      components/MediaGrid.jsx
      components/MediaCard.jsx
      components/MediaFilters.jsx
      components/AddMediaChooser.jsx
    books/
      pages/BookDetailPage.jsx
      components/BookEditor.jsx
      components/BookProgress.jsx
      components/ReadingSessionForm.jsx
      services/bookRepository.js
      services/bookSearch.js
    games/
      pages/GameDetailPage.jsx
      components/GameEditor.jsx
      components/PlaySessionForm.jsx
      services/gameRepository.js
      services/gameSearch.js
    activityTimer/
      components/TimerScreen.jsx
      components/ActiveTimerTray.jsx
      hooks/useActivityTimer.js
      services/timerEngine.js
    calendar/
      pages/DiaryCalendarPage.jsx
      components/MonthGrid.jsx
      components/DayActivitySheet.jsx
      services/calendarSelectors.js
    journal/
      pages/JournalPage.jsx
      pages/JournalEntryPage.jsx
      components/JournalEditor.jsx
      services/journalRepository.js
    insights/
      pages/InsightsPage.jsx
      components/ReadingInsights.jsx
      components/GamingInsights.jsx
      services/insightSelectors.js
    publishing/
      components/PublishPreview.jsx
      services/publicProjection.js
    importExport/
      components/ImportPreview.jsx
      services/bookmoryImporter.js
      services/backupService.js
      services/migrations/
    settings/
      pages/DiarySettingsPage.jsx

  shared/
    components/
      AppIcon.jsx
      BottomNavigation.jsx
      SafeAreaContainer.jsx
      LoadingState.jsx
      EmptyState.jsx
      SyncStatus.jsx
      MediaCover.jsx
      ConfirmDialog.jsx
    hooks/
    utils/
      dates.js
      durations.js
      validation.js

  services/
    firebase/
      firebaseClient.js
      auth.js
      firestoreRepositories.js
    persistence/
      diaryRepository.js
      legacyReadAdapter.js
    metadata/
      normalizeBook.js
      normalizeGame.js

  components/                  # Existing portfolio components retained
  context/                     # Existing auth context migrated safely
  pages/                       # Legacy route compatibility until removal
  data/                        # No private notes in bundle
  main.jsx
```

This is a target layout, not a mandate to create dozens of empty files immediately. Keep JSX/JS consistency with the current repository unless TypeScript migration is separately approved.

### 12.2 Exact existing-file responsibilities

| Existing file | What to do | Do not do |
|---|---|---|
| `src/App.jsx` | Add clear public/private route groups, protected `DiaryLayout`, compatibility aliases, native default `/app/home` | Break `/portfolio`, `/library`, `/stats` or HashRouter unintentionally |
| `src/context/AuthContext.jsx` | Remove cached-user authorization, verified auth init and owner check, proper sign-out | Treat `localStorage` user as trusted |
| `src/components/auth/RequireAuth.jsx` | Keep loading block and real UID enforcement; improve error/return flow | Grant owner privileges when env UID absent |
| `src/lib/config.js` | Validate required public config; document `VITE_OWNER_UID` deployment requirement | Put administrative secret in Vite env |
| `src/lib/firebase.js` | Preserve existing offline cache; test and centralize listeners | Initialize a second Firestore instance accidentally |
| `src/lib/db.js` | Wrap legacy functions in compatibility adapter; extract repositories/selectors; retire mirrors after verified migration | Delete old code before backed-up migration completes |
| `src/lib/bookmory.js` | Convert to pure parser + dry-run import pipeline, stable matching, provenance | Create fake dated sessions or overwrite edited books |
| `src/lib/openlibrary.js` | Preserve provider search; normalize editions and unknown fields | Infer page counts or replace manual covers |
| `src/lib/rawg.js` | Preserve RAWG/Wikipedia/CheapShark; improve confidence/unknown metadata handling | Treat store platform as played platform |
| `src/data/books.js` | Restricted migration input; remove private data from shipped public assets | Lose legacy notes/logs before safe transfer |
| `src/pages/app/BooksPage.jsx` | Extract library/search/editor/timer launch components; remove automatic seed and manual sync UI after new system proven | Rewrite all behavior in one change |
| `src/pages/app/GamesPage.jsx` | Extract list/search/editor; later route to game sessions/playthroughs | Discard existing game records/reviews |
| `src/components/books/ReadingTimerModal.jsx` | Reuse display/form logic while moving timer state into global controller | Reset running timer when modal unmounts |
| `src/components/navigation/BottomTabs.jsx` | Replace private top-level tabs with Home/Library/Calendar/Journal/Insights plus safe areas | Navigate Stats to a route that loses the shell |
| `src/pages/LibraryPage.jsx` | Split into stable public Books/Games views or route-derived tab; public queries only | Reuse private Firestore collection in signed-out app |
| `src/components/Library.jsx` | Show selected public projection on portfolio | Import raw `books.js` with private fields |
| `src/components/Layout.jsx` | Preserve public portfolio look and functionality | Make portfolio depend on private diary provider |
| `src/index.css` | Add scoped diary tokens, safe-area helpers, reduced-motion support | Globally override portfolio typography/spacing |
| `src/main.jsx` | Integrate providers only as necessary | Cause duplicate auth listeners/providers |

### 12.3 State management

Do not introduce a global state library solely because there are more screens. Use React context for durable single-instance state (authentication and active timer), custom hooks for repository observables, and local component state for editor inputs. If a data fetching/state library is added, ensure it plays well with Firestore snapshots and invalidation. Avoid keeping parallel copies of books/games in both context and global stores without well-defined ownership.

### 12.4 Public/private code splitting

Lazy-load private diary routes so unauthenticated public portfolio users do not receive private feature chunks unnecessarily. **Code splitting is a performance aid, not authorization**: never put private note data inside the JavaScript bundle regardless of route lazy-loading. Guard backend reads with security rules.

---

## 13. Automation and Derived State Event Map

This section means product automation (data updates, notifications and state changes), distinct from UI animations.

| Event | Automatic action | Data source | Failure/duplicate protection |
|---|---|---|---|
| Book added | Appear in private library/home | Library item | Stable ID, immediate local observer |
| Game added | Appear in private library/home | Library item | Stable ID, immediate local observer |
| Reading session saved | Update book progress, calendar, journal links, insights | Session + attempt | Atomic/transactional or idempotent update; one session ID |
| Play session saved | Update tracked seconds, calendar, insights | Session + attempt | Prevent duplicated duration on retry |
| Book reaches valid final page | Offer/perform completion per setting | Attempt progress | Unique completion event and undo |
| Game marked Finished | Set completed date/attempt history | User action | Do not infer from old stale `finishedOn` |
| User creates note | Show in journal and matching media | Journal entry | Durable save state and privacy default |
| Date changes | New day/week goal and streak view recalculated | Valid activity dates | Owner timezone; no fake activity |
| Reminder due | Optional local notification | User-selected schedule | Permissions, cancellation, idempotency |
| Public visibility changed | Update or remove sanitized public snapshot | Publication intent | Pending/unpublish state and retry |
| Imported archive processed | Add only missing mapped records | Import manifest | Hash + deterministic IDs + dry-run |
| Cloud reconnect | Retry/flush pending writes | Chosen persistence queue | Backoff, conflict policy, clear UI |

Do **not** put essential data integrity updates exclusively in a React `useEffect` tied to whichever page happens to be open. Business invariants belong in repository/service operations or trusted backend transactions.

### 13.1 Example reading-save transaction semantics

```text
User presses Save Session
  ├─ Validate ownership, attempt, page range, duration
  ├─ Generate stable session ID once
  ├─ Persist session and progress correction as a single logical operation
  ├─ Mark pending remote confirmation if offline
  ├─ Emit new derived calendar/insight data from canonical persisted records
  ├─ Confirm remote write when acknowledged
  └─ On failure/conflict: keep safe local entry, show actionable state
```

If using Firestore transaction semantics, remember that transactions may fail offline; for an offline-first save use an approach compatible with cached writes and ensure remote reconciliation of derived progress is well-defined. Prefer deriving most statistics from sessions instead of transactionally writing many counters per session.

### 13.2 Reminder policy

Reminder examples: user-selected daily reading reminder, game/backlog review, optional borrowed-book due reminder if loans are implemented. There should be no surprise reminders or automated emails. Notification schedules must respect permission denial, device local timezone changes, and user opt-out. Skip push notifications for v1 if local notifications meet needs.

---
## 14. Phase-by-Phase Implementation Backlog

Treat phase order as a dependency graph. Feature flags and parallel work are allowed only when they cannot expose private data, fork persistence, or cause destructive migrations.

### Phase 0 — Security, Backup, and Correctness Gate (**must precede redesign**)

**P0-01: Audit and back up current owner data**

- [ ] Confirm latest Git revision, Firebase project, package versions, deployed rules, hosting behavior, Capacitor config.
- [ ] Create Git tag; export cloud snapshot and every important device's local-only data; retain secure recovery copies.
- [ ] Record pre-migration counts/hashes (books, games, notes, sessions, public fields).
- [ ] Verify backup can be read and restored to staging.

**P0-02: Fix owner authentication**

- [ ] Remove cached UID fallback for authorization in `AuthContext.jsx`.
- [ ] Require actual Firebase SDK auth user + exact configured owner UID.
- [ ] Fail closed when Firebase/owner UID unavailable.
- [ ] Verify protected redirects, back navigation and pending-auth loading.
- [ ] Run signed-out/foreign-UID/cache-tampering tests.

**P0-03: Verify backend rules and private data exposure**

- [ ] Add Firestore rules tests for all current/private/public paths.
- [ ] Plan migration to dedicated public projections.
- [ ] Stop bundling `logs`/`privateNotes` inside visitor-delivered JS.
- [ ] Audit output JS/sourcemaps after a clean production build.
- [ ] Ensure future journal records are owner-only by rule.

**P0-04: Stop unsafe imports**

- [ ] Remove `seedExistingBooks` from `BooksPage` automatic mount effect.
- [ ] Preserve current imported data in cloud/device; do not force reset.
- [ ] Convert seed/import to dry-run, versioned and idempotent operation.
- [ ] Fix duplicate and title-only collision behavior.
- [ ] Keep pre-migration export functional throughout change.

**P0-05: Choose canonical offline architecture**

- [ ] Prototype Firestore offline persistence on web and Capacitor Android.
- [ ] Document one source of truth and real sync statuses.
- [ ] Resolve old local mirror/deletion conflicts before disabling old paths.
- [ ] Prove reconnect and delete persistence under retries.

**Phase 0 exit gate:** Zero known public private-note exposure in current build, no auth-cache owner bypass, a verified recovery backup, no surprise automatic re-seeding, and test-proven sync/migration strategy. **Do not proceed on aesthetic work alone.**

### Phase 1 — Canonical Media and Activity Domain

**P1-01: Domain schemas**

- [ ] Implement `LibraryItem`, `Attempt`, `Session`, `HistoricalAggregate`, `JournalEntry`, `PublicShelfItem` validators.
- [ ] Separate media catalog metadata from personal fields and from dated activity.
- [ ] Add stable IDs, schema versions, provenance and timezone-aware dates.
- [ ] Add book/game status definitions and transition tests.

**P1-02: Safe migration**

- [ ] Build Bookmory Markdown fixtures and pure parser.
- [ ] Build migration dry-run preview/diff and source ID map.
- [ ] Preserve all old review/notes/log strings privately.
- [ ] Detect old generated synthetic sessions; avoid double counts.
- [ ] Rerun staging import twice and verify no extra records.
- [ ] Support rollback without losing post-launch v2 entries.

**P1-03: Repository layer**

- [ ] Add v2 Firestore reads/writes and observables.
- [ ] Wrap legacy read paths during transition.
- [ ] Implement deletion/public projection cleanup policy.
- [ ] Expose saved/offline/pending/failed status to UI.
- [ ] Ensure no simultaneous mirror and Firestore independent writes after switch-over.

**P1-04: Baseline metric corrections**

- [ ] Unknown pages stay null.
- [ ] Current page cannot exceed valid known total.
- [ ] A game set back to Playing is not counted Finished.
- [ ] Historical manual hours and tracked hours are separate.
- [ ] Completion state and date remain consistent; old attempts preserved.

**Phase 1 exit gate:** Existing 51-book legacy dataset (if that remains the verified source count), user-edited changes, and all real game records/notes survive migration with documented exceptions only. All new records use v2 schemas and tests pass.

### Phase 2 — Diary Shell and High-Frequency Logging

**P2-01: Unified diary navigation**

- [ ] `/app/home`, Library, Calendar, Journal, Insights routes exist.
- [ ] Five-tab bottom bar with safe areas, desktop layout and back behavior.
- [ ] Old diary routes redirect correctly.
- [ ] Public portfolio remains unchanged.

**P2-02: Unified Library and detail pages**

- [ ] Books/Games segmented switch; persistent search/filter/sort.
- [ ] Search-first Add Book/Game with manual fallback.
- [ ] Separate Book Detail and Game Detail, editing and safe deletion.
- [ ] Book reread and game replay attempts represented correctly.

**P2-03: Timer engine and manual session logging**

- [ ] Extract existing ReadingTimerModal state into global timer engine/provider.
- [ ] Book and Game timer modes with their own completion forms.
- [ ] Persistent mini-tray when navigating away.
- [ ] Start/pause/resume/review/save/discard tested across refresh/background.
- [ ] Manual backdated sessions and duplicate-write protections.

**P2-04: Home dashboard**

- [ ] Currently reading/playing cards.
- [ ] Today summary and recent genuine activity.
- [ ] Quick add/log actions and goal/card placeholders if empty.
- [ ] No fake dates/zero charts when history is unknown.

**Phase 2 exit gate:** Owner can add/search a book or game, start/log a session, navigate away and back, and find the exact persisted session in the media detail—all while offline (within tested platform limits).

### Phase 3 — Bookmory-Inspired Calendar, Journal, Insights

**P3-01: Calendar**

- [ ] Month grid with actual book/game mini covers and overflow count.
- [ ] Local-date attribution, activity filters and day detail sheet.
- [ ] Day-to-session/media navigation.
- [ ] Correct behavior for imported date ranges vs real dated sessions.

**P3-02: Journal**

- [ ] Dated reflections, quotes, game moments and session notes.
- [ ] Linked media and private-by-default editor.
- [ ] Search/tag/date filters; empty state and safe draft saving.
- [ ] Optional attachments only after secure storage design.

**P3-03: Insights and goals**

- [ ] Books/Games/Combined dashboard with transparent units.
- [ ] Month/year/all-time filters and appropriate charts.
- [ ] Verified versus historical aggregate time shown distinctly.
- [ ] Daily/weekly streak calculations and optional goals.
- [ ] Recompute after a session edit/delete without stale counts.

**P3-04: Polish/animation**

- [ ] Smooth but restrained tab/card/sheet transitions.
- [ ] Progress animations, meaningful completion event, reduced motion.
- [ ] Mobile/desktop/dark-mode responsive review.

**Phase 3 exit gate:** Every real dated activity appears consistently in Calendar, media detail and Insights; no imported aggregate falsely populates individual dates; journal data remains private unless separately published.

### Phase 4 — Portfolio Publication and Advanced Features

**P4-01: Approved public shelves**

- [ ] Implement `publicProfiles` projections and server/rules validation.
- [ ] Book/Game Publish Preview, Unpublish and pending state.
- [ ] Move public components to read only public projection.
- [ ] Preserve public portfolio layout and old `/library`/`stats` compatibility.

**P4-02: Shareable highlights**

- [ ] Explicit excerpt selection, preview and publish.
- [ ] Public highlights page/portfolio cards.
- [ ] Edit/unpublish and removal flows tested.

**P4-03: Optional extras**

- [ ] ISBN scan, attached game screenshots, book quotes OCR.
- [ ] Local reminders, overdue borrowed books, custom accent themes.
- [ ] Calendar image share, year-in-review and goal summaries.
- [ ] Full backup restore preview and conflict resolution UI.

**Phase 4 exit gate:** Signed-out browser shows only content individually approved for public display, and private entries are inaccessible through direct Firestore reads, bundles, UI routes and public snapshot payloads.

---

## 15. Testing, QA, and Acceptance Matrix

### 15.1 Mandatory environments

1. Desktop public web: Chromium plus at least one other modern engine where possible, light/dark.
2. Mobile web: ~390×844 and 360×800, visible keyboard and safe-area simulations where supported.
3. Real Android Capacitor build: fresh install, upgrade from existing installed app, app background/kill/restart and offline tests.
4. iOS Capacitor only if/when an iOS target is actually configured; never claim it works based solely on Android/browser testing.
5. Firebase Emulator or staging project with deployed-equivalent auth/rules/indexes.
6. Slow network, failed provider API, offline start, reconnect, quota errors, empty database and existing legacy data.

### 15.2 Automated test levels

**Unit tests**

- Progress math: unknown/zero totals, valid page boundaries, completed/uncompleted transitions.
- Game time: manual baseline and tracked sessions cannot double count.
- Rating averages: correct game/book scales, null handling and valid zeros.
- Timer pause/resume and multi-interval duration (use fake clock).
- Calendar local day and month behavior, including sessions across midnight.
- Bookmory Markdown parser fixtures and collision detection.
- Mapping of old status, notes, logs and provenance to v2.
- Public projection whitelist: private note fields can never pass.
- Idempotent sessions/import keys, duplicate prevention and tombstones.

**Integration tests**

- Firebase Auth + route guard with no, real owner and foreign-UID sessions.
- Firestore rules read/write matrix with and without authentication.
- Repository observers update Home/Calendar/Journal/Insights after saves.
- Import twice → same counts and no duplicate historical totals.
- Offline create/edit/delete → reconnect → same result across devices.
- Unpublish item → public document removed after cloud confirmation.
- Edit journal on two devices → deterministic documented conflict handling.

**E2E (Playwright/web; mobile device runs separately)**

- New book search/manual add → detail → reading timer → save → calendar/insights.
- New game search/manual add → playtime log → finish → insights.
- Navigation `/app/books`/`/app/games` old aliases → correct new screens.
- Public `/library`/`/stats` routes consistently show intended media type.
- Sign out → private screens hidden, no stale cached user bypass.
- Public visitor cannot see notes through card DOM, network responses or JS assets.
- Long title, no cover, missing ISBN, poor connectivity, book/gaming-only collections.

### 15.3 Functional acceptance scenarios (Given/When/Then)

**A. Auth cache tamper**  
Given Firebase reports signed-out, when the browser has arbitrary `diary_cached_owner_user` content matching the owner UID, then the app displays login and no private data is readable.

**B. Safe imported books**  
Given a previously edited imported book and no device-local auto-sync marker, when the owner opens the Books view on a new device, then no automatic seed overwrites the record.

**C. Import idempotency**  
Given the same Bookmory Markdown archive imported once, when it is imported a second time, then the preview marks duplicates and the approved run produces zero duplicate session/aggregate records.

**D. Missing page count**  
Given a book whose page count is unknown, when it is saved, then `totalPages === null`; the interface does not invent 350 and does not show a mathematically false percentage.

**E. Pause accuracy**  
Given a running 5-minute timer, when the owner pauses for 10 minutes and resumes for 5 minutes, then the session records approximately 10 minutes active, not 20.

**F. Timer continuity**  
Given a running timer for Book A, when the owner navigates to Games and returns, then the Book A timer persists and starting Game B requires resolving the existing timer.

**G. Calendar day**  
Given a session explicitly dated October 19, 2026 in Asia/Manila, when the user opens October's month calendar, then only the appropriate active date(s) display the session, reflecting active-interval split rules for overnight activity.

**H. Historical range import**  
Given a Bookmory log covering November 19–December 2 with total time but no per-day timestamps, when imported, then the calendar does not show 14 fabricated active days and the time is labeled historical aggregate.

**I. Game finished correction**  
Given a finished game from an older playthrough, when its current status becomes Playing or a new playthrough starts, then the current Playing view is correct while the prior completion remains in history and the unique-title completion count follows the defined policy.

**J. Unpublish**  
Given a book published to the portfolio, when the owner unpublishes and the remote write completes, then signed-out viewers cannot retrieve that book from the active public shelf query, while private history remains intact.

**K. Private text**  
Given a private note containing a unique test marker, when producing the public bundle and visiting public pages as an unauthenticated user, then the marker is absent from public JS assets and public Firestore responses.

**L. Offline + reconnect**  
Given the Android app offline, when a session is saved, then it is durably available locally, labeled pending, and later acknowledged or clearly shown failed after reconnect; there is no silent loss or duplicate.

### 15.4 Accessibility acceptance

- Minimum practical 44×44px tap targets for all major navigation/edit actions; tiny chips enlarged or padded.
- Inputs have labels; icon-only controls have accessible names.
- Proper dialog semantics, focus trap and focus return for sheets/modals; Escape on web.
- Screen-reader label for timer status (`Running`, `Paused`) without announcing every second.
- Visible keyboard focus; keyboard navigation works through lists/forms.
- WCAG AA target contrast for body text and control states, including accent-on-cream.
- Reduced-motion setting eliminates confetti and major movement.
- Screen rotation and dynamic font scaling do not hide Save/Cancel or active timer controls.

### 15.5 Performance targets (engineering budgets, not existing measurements)

| Interaction | Initial budget / criterion |
|---|---|
| Tab switch with cached data | Immediate visible response, no full-page spinner |
| Timer button | Immediate responsive feedback; logical timestamp recorded first |
| Add/edit save | Immediate local acknowledgement when durable, separate sync state |
| Library first view | Show skeleton quickly; virtualize/paginate large collections |
| Calendar month | Bounded query; no loading every historical session for one month |
| Search input | 300–400ms debounce; stale results ignored |
| Images | Lazy-loaded and placeholder-backed; no scroll jank |
| Charts | Derived selectors memoized; no recomputation per timer tick |

Record real performance on representative devices/network before deciding absolute SLA thresholds. Avoid arbitrary latency promises for third-party APIs.

### 15.6 Build/release checks

- [ ] Package lock and dependency review before new package installs.
- [ ] ESLint, build, unit/integration/E2E suite pass where configured.
- [ ] Firebase rules emulator tests and staging deploy pass.
- [ ] Production output bundle scanned for private fixture markers.
- [ ] Capacitor `sync` and Android build tested using existing project setup.
- [ ] Existing portfolio and contact form regression tests pass.
- [ ] Dark/light, mobile/desktop, network offline, sign-in/out states reviewed.
- [ ] Release notes list all migrated/changed records and any limitations.

---

## 16. Deployment and Rollout Plan

### 16.1 Feature flags (recommended)

Use deployment- or owner-scoped flags with safe defaults:

- `diaryV2ReadEnabled`
- `diaryV2WriteEnabled`
- `calendarEnabled`
- `journalEnabled`
- `publicProjectionEnabled`

Do not blindly enable two independent write paths at once. Read shadowing can compare old/new result counts without changing existing data; production dual-write must be carefully justified or avoided.

### 16.2 Safe rollout sequence

1. **Preparation:** backup, establish staging, auth fix, security rules tests, disable auto-seeding.
2. **Compatibility release:** introduce v2 repository/validators and safe read adapters behind flags while old UX stays active.
3. **Migration:** owner runs staging dry-run, approves resolved matches; production migration with checkpoints and diagnostics.
4. **Private diary release:** enable Home/Library/Timer on staging; validate existing data parity and correct offline behavior; then deploy to production.
5. **Activity release:** enable Calendar/Journal/Insights only after valid session data is available.
6. **Public publication release:** build sanitized projections, validate signed-out read behavior, migrate public UI away from private collections, then tighten legacy rules.
7. **Cleanup:** remove legacy private public bundle, old local mirror logic, old manual push/pull buttons and deprecated routes' components after compatibility is verified.

### 16.3 Monitoring and diagnostics

Instrument **counts, errors, schema versions and timings only**, not note text:

- Migration processed/added/updated/duplicate/conflict/failed counts.
- Sync pending/failed/retry/confirmed aggregate counts.
- Book/game search provider failure rates and request timings.
- Timer recovery events and duplicate session prevention.
- Public publish/unpublish success and denied access attempts.
- Client crashes and route errors where monitoring SDK exists or is explicitly introduced.

Use the existing React error boundary approach if present; do not claim crash monitoring services are already connected when not visible in source.

### 16.4 Rollback plan

- Keep previous deployed bundle and previous Firestore schema readers available temporarily.
- Maintain v1→v2 ID maps and versioned migration logs.
- On failure, disable v2 flags and read from compatible legacy source; protect any v2-only writes for later replay/export.
- Never restore stale cloud backup over newly created owner entries without a three-way reconciliation plan.
- Publish failed migration report and affected records rather than silently dropping them.

---

## 17. Suggested Implementation Order at the PR Level

These PRs are intentionally small enough to review independently. PR numbers describe order, not GitHub issue IDs.

| PR | Title | Primary affected areas | Required proof |
|---|---|---|---|
| 01 | Verified Auth and Route Protection | `AuthContext`, `RequireAuth`, config | Cache tampering cannot authorize |
| 02 | Safe Backup and Remove Auto-Seed | `BooksPage`, `db`, migration tooling | Existing records unchanged on fresh device |
| 03 | Public/Private Data Isolation | public Library and Shelf, `books.js`, rules | No private fixture marker in visitor bundle |
| 04 | V2 Domain Schemas and IDs | new domain models/validators | All unit tests, no fake 350 pages |
| 05 | Historical Import Dry-Run | Bookmory parser/importer/migration scripts | Reimport idempotent, aggregates preserved |
| 06 | Canonical Offline Repository | Firebase/persistence services, adapters | Reconnect and deletion tests |
| 07 | Diary Shell and Navigation | App routes, DiaryLayout, navigation | Five-tab shell; old aliases redirect |
| 08 | Books Library and Detail | book components, metadata adapter | Add/search/edit/read status preserved |
| 09 | Games Library and Detail | game components, search adapter | Add/search/edit/finished history preserved |
| 10 | Shared Activity Timer | timerEngine/provider/tray, forms | Background/pause correctness |
| 11 | Diary Home | dashboard components/selectors | Real events show immediately |
| 12 | Calendar | month grid, day view, selectors | No invented historical days |
| 13 | Journal | CRUD, linking, private editor | Owner-only note privacy |
| 14 | Insights and Goals | statistics selectors/charts/goals | Totals match real sessions |
| 15 | Portfolio Publishing | projection service, public pages, rules | No private leakage; unpublish works |
| 16 | Polish and Cutover | motion, accessibility, old code cleanup | Responsive, dark-mode, full regression |

Where dependencies require, combine PRs logically, but do not combine unrelated site redesigns with data migrations.

---

## 18. Handoff Prompt for Antigravity / Other Coding IDE Agent

Copy the following into the coding agent **along with this Markdown specification and the current complete repository** (not only the `src` folder). The agent should proceed incrementally rather than claiming to implement every phase in one unsafe patch.

> **Task:** Implement `BOOKS_GAMES_DIARY_IMPLEMENTATION.md` in my current React/Vite/Tailwind/Firebase/Capacitor portfolio + diary project. This is a personal Bookmory-inspired books-and-games diary, with an independent public portfolio. Do not rewrite frameworks. Preserve all existing portfolio functionality and all existing book/game data.
>
> **First action:** Inspect current repo, Firebase rules/config, all references to `src/data/books.js`, auth, Firestore persistence, Bookmory importer, timer and existing routes. Compare current source to the documented baseline, identify any changes since the supplied ZIP, and output exact affected files and the Phase 0 implementation plan.
>
> **Non-negotiable:** Never auto-seed or overwrite existing 51 Bookmory records, erase historical notes, fabricate reading dates/pages or game hours, expose private notes in bundles/public Firestore, trust cached UID for access, or maintain uncontrolled conflicting local/cloud stores. Export/verify a recoverable backup before destructive migration. Rules and public projections must be tested in staging.
>
> **Implementation order:** Phase 0 security/backups/auth/auto-seeding/sync first; Phase 1 v2 domain/migration; Phase 2 five-tab mobile diary and media sessions; Phase 3 combined cover-based calendar, journal and insights; Phase 4 explicit public portfolio publishing. Respect acceptance criteria and existing URL compatibility.
>
> **Output for each PR:** (1) diagnosis and exact issue fixed, (2) list of changed/added files, (3) complete source diff or full affected files, (4) migrations and required Firestore indexes/rules, (5) tests executed and results, (6) known risks, (7) rollback steps. Keep unrelated changes minimal. Stop before destructive production data operations and state exactly which owner action/backup is required.
>
> **UI target:** Calm, warm, visually rich but restrained mobile diary inspired by Bookmory. Keep public portfolio editorial visual identity. Provide Home, Library (Books/Games), Calendar, Journal, Insights; persistent timer, offline-safe saving, publishing preview, reduced motion and safe-area support. Do not clone branded Bookmory visuals/assets.

---

## 19. Project Completion / Definition of Done

The project is **not complete** simply because all tabs render. It is complete for the approved scope when all of these conditions hold:

- [ ] Public portfolio still shows all original sections and links, on desktop and mobile.
- [ ] Owner authentication requires verified Firebase identity and matching owner UID.
- [ ] No visitor-readable JS or Firestore path exposes private notes/logs.
- [ ] All original books, games, ratings, notes, session data and relevant timestamps have a backed-up, reviewed migration outcome.
- [ ] A second import or a fresh device cannot overwrite changes or multiply historical logs.
- [ ] Books and games have separate domain states, details, real sessions and optional attempts/playthroughs.
- [ ] Reading and gaming timers are correct, persistent and clearly save offline/sync state.
- [ ] Manual logs work for people who don't use timers.
- [ ] Calendar displays actual recorded activity with real cover art and accurate local-date behavior.
- [ ] Journal reflects linked/private notes and can be edited without unintended publication.
- [ ] Insights derive from canonical data; unknown/historical aggregate values are labeled honestly.
- [ ] Publishing requires deliberate preview; public site only reads sanitized snapshots; unpublishing is reliable.
- [ ] Old URLs continue to work; native launch opens private dashboard appropriately.
- [ ] No keyboard/safe-area navigation breakage; dark/light and reduced motion work.
- [ ] Automated tests, rules tests, full build, and supported native smoke tests pass.
- [ ] A backup, migration manifest and rollback plan are documented and verified.

### Recommended first concrete work package

**Implement only PRs 01–03 first**: verified auth, safe backup/no automatic seed, and private/public data isolation. These fix the highest-risk source issues. Next establish the v2 activity schema and idempotent migration before redesigning screens. This minimizes risk of losing your already-imported Bookmory collection while building your personal books-and-games diary.

---

## 20. Source Attribution and Unverified Areas

**Source-derived information**: route names, filenames, Firestore/localStorage patterns, login/owner mechanism, current metadata providers, Bookmory Markdown importer behavior, timer state, book/game fields, and portfolio UX were read from the user-supplied `src(1).zip` and `CURRENT_UX.md`.

**Proposed implementation**: v2 document structure, new routes, visual tokens, screen flows, animations, state machine, public projection model, migration approach, tests and rollout strategy are **recommendations**, not assertions about existing source or Bookmory's private code.

**Not available in the provided ZIP**: Firestore production security rules, package manifests/lockfile, complete deployment settings, actual APK, native Capacitor settings, native device test logs, full screenshots referenced by the UX report, backend administrative access, live owner cloud records, and signed-out production network traces. These must be verified against the complete repository/environment before finalizing production migrations or making claims of deployed security.

**Final design directive:** Build a unique personal diary inspired by Bookmory's usability, not a clone. The app should remember **what you read/played, when, how long, what changed, and what you thought**, and let you choose what visitors can see on your public developer portfolio.
