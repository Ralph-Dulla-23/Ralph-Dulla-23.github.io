# PR 05: Canonical Sessions (`diaryRepository`, Adapters, Hooks)

## 1. Executive Summary
This document specifies the implementation of **PR 05 (Canonical Sessions)** from `DIARY_STABILIZATION_IMPLEMENTATION.md` (Section 7 and Section 13), establishing a single live, deduplicated, and authoritative session source across the Books & Games Diary (`com.ralph.diary`):
- **Live Firestore Observers**: Added `observeSessions(filter, callback, onError)` to `diaryRepository.js`, enabling real-time subscriptions to `/users/{uid}/sessions` with `hasPendingWrites` and `fromCache` sync transparency.
- **Item-Specific Queries**: Added `getSessionsForItem(itemId)` and `deleteSession(sessionId)` to `diaryRepository.js`.
- **Legacy Reader Upgrade**: Upgraded `getAllSessions(uid)` in `src/lib/db.js` to query canonical `/users/{uid}/sessions` first with deterministic ID deduplication against legacy `books/{bookId}/sessions` and local storage mirrors.
- **Convenience Adapter**: Exported `observeCanonicalSessions(uid, callback)` from `src/lib/db.js`.
- **Reactive React Hook**: Created `src/hooks/useDiarySessions.js` providing live reactive session state, metadata, and error handling for diary consumers (`CalendarPage`, `InsightsPage`, `HomePage`).

---

## 2. Architecture & Data Flow

### 2.1 Authoritative Session Hierarchy
```
                   ┌────────────────────────────────────────┐
                   │        Canonical Storage Route         │
                   │     /users/{uid}/sessions/{id}         │
                   └───────────────────┬────────────────────┘
                                       │
                      ┌────────────────┴────────────────┐
                      ▼                                 ▼
             observeSessions()                   getAllSessions()
                      │                                 │
                      ▼                                 ▼
              useDiarySessions()               Deduplicated View
        (Reactive hook for pages)           (Canonical wins on ID collision;
                                             Legacy books subcollections +
                                             Local mirrors as fallback)
```

### 2.2 Deduplication Invariant
When querying sessions across canonical and legacy sources:
1. Canonical `/users/{uid}/sessions` records are populated first in an identity map keyed by `id`.
2. Legacy `/users/{uid}/books/{bookId}/sessions` documents are added only if `!sessionMap.has(d.id)`, ensuring canonical session properties and accurate active durations are never overwritten by legacy synthetic records.
3. Local storage entries from `diary_local_sessions_v1` are incorporated only if `!sessionMap.has(s.id)` as an offline safety fallback.

---

## 3. Component & API Additions

### 3.1 `diaryRepository.js`
- `observeSessions(filter = {}, callback, onError)`: Real-time listener on `users/{trimmedUid}/sessions`. Filters by `mediaType` and `libraryItemId`. Returns `unsubscribe` function. Emits `{ sessions, metadata: { hasPendingWrites, fromCache } }`.
- `getSessionsForItem(itemId)`: Retrieves sessions matching `libraryItemId === itemId || itemId === itemId`.
- `deleteSession(sessionId)`: Deletes canonical document at `users/{trimmedUid}/sessions/{sessionId}`.

### 3.2 `src/hooks/useDiarySessions.js`
- Custom hook taking optional `{ mediaType, libraryItemId }` filter.
- Subscribes to current user's canonical sessions.
- Exposes `{ sessions, loading, error, metadata }`.
- Fully satisfies React hook guidelines (`react-hooks/set-state-in-effect`), executing state changes strictly within asynchronous subscriber callbacks.

---

## 4. Verification & Testing Matrix
1. **Automated Unit Tests**: `tests/canonical-sessions.test.mjs` (6/6 PASS).
2. **Whole Repository Test Suite**: `node --test tests/*.test.mjs` (130/130 PASS).
3. **Static Analysis**: `npm run lint` (0 errors, 0 warnings across all files).
4. **Production Build**: `npm run build` (Clean Vite production bundle with code-splitting).
