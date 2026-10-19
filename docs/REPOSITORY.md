# Canonical v2 DiaryRepository Documentation

## Overview
Ticket: **PR-07 / P1-03**
Specification Reference: `BOOKS_GAMES_DIARY_IMPLEMENTATION.md` (Sections 5.1, 5.4, 6.4, 7, 14: P1-03)

The canonical v2 `DiaryRepository` acts as the single source of truth for all data mutations and queries across books, games, attempts, sessions, historical aggregates, and private journal entries.

---

## 1. Architecture & Factory

Factory function: `createDiaryRepository({ db, uid, firestoreOps })`
Exported via:
- `src/domain/repository/diaryRepository.js`
- `src/lib/db.js` (`getDiaryRepository(uid)`)

### Authentication & Fail-Closed Security (`SEC-01`)
- Throws an error immediately if `uid` is missing, empty, or unverified.
- Never reads or writes from unauthenticated contexts.

---

## 2. Firestore Document Paths (Owner Hierarchy)

All private data is partitioned under `users/{uid}/`:
- `users/{uid}/libraryItems/{itemId}` — Books and games (`LibraryItem`)
- `users/{uid}/attempts/{attemptId}` — Reading & gaming attempts (`Attempt`)
- `users/{uid}/sessions/{sessionId}` — Timed and manual sessions (`Session`)
- `users/{uid}/historicalAggregates/{aggregateId}` — Multi-day summary logs (`HistoricalAggregate`)
- `users/{uid}/journalEntries/{entryId}` — Private reflections & reviews (`JournalEntry`)

---

## 3. Schema Validation & Domain Enforcement

Every mutating call executes domain validators before touching storage:
- `saveLibraryItem`: `validateLibraryItem` (enforces `currentPage <= total`, `ratingScale: 5 | 10`, `schemaVersion: 2`).
- `createAttempt`: `validateAttempt` (enforces `ordinal >= 1`, valid attempt statuses).
- `createSession`: `validateSession` (enforces non-negative integer `activeSeconds`).
- `createHistoricalAggregate`: `validateHistoricalAggregate` (strictly enforces `isDailySession === false` per `DATA-05`).
- `createJournalEntry`: `validateJournalEntry` (enforces `visibility: 'private'`).

---

## 4. Real-Time Observables & Sync Metadata

- `observeLibraryItems(filter, callback)`:
  - Listens to snapshot changes on `users/{uid}/libraryItems`.
  - Callback receives: `{ items: [...], metadata: { hasPendingWrites, fromCache } }`.
- `determineSyncState({ isOnline, hasPendingWrites, error })`:
  - Maps to: `'synced'`, `'saving_offline'`, `'offline'`, `'permission_denied'`, or `'error'`.
