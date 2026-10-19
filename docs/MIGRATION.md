# Migration Engine & Bookmory Pure Parser Documentation

## Overview
Ticket: **PR-06 / P1-02**
Specification Reference: `BOOKS_GAMES_DIARY_IMPLEMENTATION.md` (Sections 8, 14: P1-02)

The migration engine converts legacy Bookmory export markdown files into canonical v2 entities and provides an idempotent, side-effect-free dry-run preview engine before executing any cloud or local writes.

---

## 1. Pure Bookmory Parser (`src/domain/bookmoryParser.js`)

- **Pure Function**: `parseBookmoryMarkdownPure(markdownText, options)`
- **Zero Side-Effects**: Operates entirely in memory; makes no network requests or storage writes.
- **Canonical v2 Output**:
  - `item`: Canonical `LibraryItem` (`mediaType: 'book'`).
  - `attempts`: Array of canonical `Attempt` records (`ordinal`, `status`, `startedOn`, `completedOn`).
  - `historicalAggregates`: Array of canonical `HistoricalAggregate` records for reading logs with recorded read time.
  - `journalEntries`: Array of canonical `JournalEntry` records for reading log comments/reviews (`visibility: 'private'`).
  - `raw`: Full unparsed source fields for auditability.

### Key Behavioral Invariants
1. **Unknown Total Pages Remain `null` (`DATA-03`)**:
   - If `Total pages` is absent, blank, or 0, `progress.total` is strictly `null`. It never falls back to 350.
2. **Non-Daily Provenance for Range Logs (`DATA-05`, `DATA-06`)**:
   - Multi-day reading periods (e.g. `11/19/2025 ~ 12/02/2025`) are parsed into `HistoricalAggregate` records with `isDailySession: false`.
   - Start and end dates remain pure calendar dates (`YYYY-MM-DD`); no synthetic timestamps or arbitrary UTC clock times (such as `12:00:00Z`) are fabricated.
3. **Private Comment Preservation (`SEC-01`, `DATA-01`)**:
   - Reading log reviews and comments are converted into private `JournalEntry` records with provenance `bookmory`. They are never included in public projections.

---

## 2. Safe Migration & Dry-Run Preview Engine (`src/domain/migrationEngine.js`)

- **Pure Functions**:
  - `previewMigrationBatch(candidates, existingState)`: Generates a dry-run report without mutating storage or cloud state.
  - `detectCollisions(candidate, existingItem)`: Identifies metadata divergences (conflicting statuses, differing ISBNs, conflicting page counts).
  - `generateRollbackManifest(previewReport, existingState)`: Creates an immutable manifest detailing pre-migration snapshots for exact reversal.

### Idempotency & Collision Guarantees
- **Duplicate Prevention (`DATA-01`)**: When re-running migration on an already-migrated dataset, identical items are flagged as duplicates with `additions: 0` and `historicalAggregatesCount: 0`.
- **Legacy Session Supersession**: Identifies existing synthetic sessions (`bookmory_${id}_${j}`) in legacy state and marks them superseded so duration is never double-counted.
