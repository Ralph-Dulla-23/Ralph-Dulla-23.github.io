# PR 09: Journal v2 Cutover

## Overview
This pull request implements PR 09 of the Books & Games Diary stabilization initiative as defined in `DIARY_STABILIZATION_IMPLEMENTATION.md` (Sections 7, 8 & 13). It integrates the private journal system directly with canonical `users/{uid}/journalEntries` and `diaryRepository`, establishes sync metadata transparency across reflection timelines, and enforces strict private storage and sanitized public highlight projections.

---

## Key Changes

### 1. Canonical Journal Repository & Real-Time Observer (`db.js`, `diaryRepository.js`)
- `watchJournalEntries(ownerUid, onUpdate)`:
  - Subscribes to canonical `users/{uid}/journalEntries` in real-time.
  - Transparently tracks `hasPendingWrites` and `fromCache` sync metadata.
  - Gracefully falls back to local storage mirror and in-memory fallback when offline.
- `saveJournalEntry(uid, entry)`:
  - Validates entry with `validateJournalEntry` ensuring `schemaVersion === 2`, `type` in allowlist (`reflection`, `book_quote`, `game_moment`, `session_note`, `review`), and private visibility.
  - Writes to canonical `users/{uid}/journalEntries/{id}` with `serverTimestamp()`.
  - Unmarks tombstones on save.
- `deleteJournalEntry(uid, entryId)`:
  - Marks deleted ID in tombstones (`markDeletedId`) to prevent resurrection.
  - Deletes from canonical Firestore collection `users/{uid}/journalEntries/{id}`.

### 2. Journal Timeline Sync Status Transparency (`JournalPage.jsx`)
- Integrated real-time sync status badge into header:
  - Displays `"Live Sync"` with `BsCloudCheck` when in sync.
  - Displays `"Syncing offline..."` with `BsCloudArrowUp` when `hasPendingWrites` is active.
- Connects `watchJournalEntries` with dual `(entries, metadata)` callback.

### 3. Highlights & Privacy Isolation Preserved
- Private reflections and notes are strictly confined to owner-private collection `users/{uid}/journalEntries`.
- When an owner shares a quote, `publishHighlight()` projects allowlisted fields through `toPublicHighlight()` to `publicProfiles/{uid}/highlights`, completely omitting private journal bodies and personal draft notes.

---

## Verification & Test Results
- **Automated Tests**:
  - `tests/journal-v2-cutover.test.mjs`: 6/6 PASS
  - Full test suite: **154/154 PASS** across 27 test suites
- **Static Analysis**: `npm run lint` exited 0 (0 errors, 0 warnings).
- **Production Build**: Clean Vite v7.3.7 build, 749 modules transformed.
