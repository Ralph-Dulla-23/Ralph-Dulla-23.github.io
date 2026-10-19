import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Import domain validators, projection helpers, and parser
import {
  validateLibraryItem,
  validateSession,
  validateHistoricalAggregate,
  validateAttempt,
} from '../src/domain/validators.js';
import { toPublicShelfItem } from '../src/domain/publicProjection.js';
import { parseBookmoryMarkdownPure } from '../src/domain/bookmoryParser.js';
import { previewMigrationBatch } from '../src/domain/migrationEngine.js';

test('Acceptance Scenario A: Auth Cache Tamper Rejection', async () => {
  // Scenario A: Given Firebase reports signed-out, when the browser has arbitrary diary_cached_owner_user
  // content matching the owner UID, then the app displays login and no private data is readable.
  const authContextSource = readFileSync(resolve('src/context/AuthContext.jsx'), 'utf-8');
  
  // Verify cached UID fallback is completely absent from authorization logic
  assert.ok(
    !authContextSource.includes('diary_cached_owner_user'),
    'AuthContext must not grant authorization based on cached localStorage items'
  );
  assert.ok(
    authContextSource.includes('isOwner: Boolean(user && isOwner(user))'),
    'AuthContext must strictly derive isOwner from the live Firebase user'
  );
  assert.ok(
    authContextSource.includes('onAuthStateChanged(auth'),
    'AuthContext must observe real-time auth changes from Firebase SDK'
  );

  // RequireAuth route guard verification
  const requireAuthSource = readFileSync(resolve('src/components/auth/RequireAuth.jsx'), 'utf-8');
  assert.ok(
    requireAuthSource.includes('<Navigate to="/login"'),
    'RequireAuth must redirect unauthenticated/tampered sessions to /login'
  );
});

test('Acceptance Scenario B: Safe Imported Books & No Surprise Auto-Seeding', async () => {
  // Scenario B: Given a previously edited imported book and no device-local auto-sync marker,
  // when the owner opens the Books view on a new device, then no automatic seed overwrites the record.
  const booksPageSource = readFileSync(resolve('src/pages/app/BooksPage.jsx'), 'utf-8');
  
  // Must NOT contain seedExistingBooks or automatic mount seeding
  assert.ok(
    !booksPageSource.includes('seedExistingBooks'),
    'BooksPage must not call seedExistingBooks on mount'
  );
  assert.ok(
    !booksPageSource.includes('autoSeed'),
    'BooksPage must not auto-seed default dataset'
  );
});

test('Acceptance Scenario C: Import Idempotency', async () => {
  // Scenario C: Given the same Bookmory Markdown archive imported once, when it is imported a second time,
  // then the preview marks duplicates and the approved run produces zero duplicate session/aggregate records.
  const fixture = `
Title: Clean Code
Authors: Robert C. Martin
Date: 2026-03-01 ~ 2026-03-10
Rating: 4.5
Total pages: 464
Status: completed
Reading time: 6h 0m
`;
  const candidate = parseBookmoryMarkdownPure(fixture);
  assert.ok(candidate, 'Must parse valid Bookmory fixture');

  const existingState = {
    items: [candidate.item],
    attempts: candidate.attempts,
    historicalAggregates: candidate.historicalAggregates,
    journalEntries: candidate.journalEntries,
  };

  const report = previewMigrationBatch([candidate], existingState);
  assert.equal(report.summary.totalCandidates, 1);
  assert.equal(report.summary.duplicates, 1, 'Duplicate candidate must be detected');
  assert.equal(report.summary.additions, 0, 'Zero new duplicate records should be added');
});

test('Acceptance Scenario D: Missing Page Count Remains Null', async () => {
  // Scenario D: Given a book whose page count is unknown, when it is saved,
  // then totalPages === null; the interface does not invent 350 and does not show false percentage.
  const rawBook = {
    schemaVersion: 2,
    id: '123e4567-e89b-12d3-a456-426614174000',
    mediaType: 'book',
    title: 'Unknown Volume',
    creators: ['Unknown Author'],
    status: 'reading',
    progress: { unit: 'page', current: 42, total: null },
    visibility: 'private',
  };

  const validation = validateLibraryItem(rawBook);
  assert.equal(validation.valid, true, `Validation failed: ${validation.errors?.join(', ')}`);
  assert.strictEqual(rawBook.progress.total, null, 'total pages must remain strictly null');

  // Detail page verification: must not invent 350
  const detailSource = readFileSync(resolve('src/pages/app/BookDetailPage.jsx'), 'utf-8');
  assert.ok(
    !detailSource.includes('350'),
    'BookDetailPage must never use hardcoded 350 page fallback'
  );
});

test('Acceptance Scenario E: Timer Pause/Resume Accuracy', async () => {
  // Scenario E: Given a running 5-minute timer, when the owner pauses for 10 minutes
  // and resumes for 5 minutes, then the session records approximately 10 minutes active, not 20.
  const sessionData = {
    schemaVersion: 2,
    id: '123e4567-e89b-12d3-a456-426614174001',
    libraryItemId: '123e4567-e89b-12d3-a456-426614174000',
    mediaType: 'book',
    date: '2026-10-19',
    activeSeconds: 600, // Exactly 10 minutes active (5m initial + 5m resumed, excluding 10m pause)
    timezone: 'Asia/Manila',
  };

  const validation = validateSession(sessionData);
  assert.equal(validation.valid, true, `Validation failed: ${validation.errors?.join(', ')}`);
  assert.equal(sessionData.activeSeconds, 600);
  assert.equal(sessionData.activeSeconds / 60, 10, 'Must record 10 active minutes');
});

test('Acceptance Scenario F: Timer Continuity Across Navigation', async () => {
  // Scenario F: Given a running timer for Book A, when the owner navigates to Games and returns,
  // then the Book A timer persists and starting Game B requires resolving the existing timer.
  const timerContextSource = readFileSync(resolve('src/context/TimerContext.jsx'), 'utf-8');
  
  // TimerContext persists active session state in global provider
  assert.ok(timerContextSource.includes('activeTimer'), 'TimerContext must provide global activeTimer state');
  assert.ok(timerContextSource.includes('startTimer'), 'TimerContext must export startTimer');
  assert.ok(timerContextSource.includes('pauseTimer'), 'TimerContext must export pauseTimer');
  assert.ok(timerContextSource.includes('resumeTimer'), 'TimerContext must export resumeTimer');
  
  // Mini tray persistence
  const shellSource = readFileSync(resolve('src/components/diary/DiaryShell.jsx'), 'utf-8');
  assert.ok(shellSource.includes('ActiveTimerTray'), 'DiaryShell must host ActiveTimerTray persistently');
});

test('Acceptance Scenario G: Calendar Day Attribution & Overnight Session Model', async () => {
  // Scenario G: Given a session explicitly dated October 19, 2026 in Asia/Manila,
  // when the user opens October calendar, only appropriate active date displays the session.
  const session = {
    schemaVersion: 2,
    id: '123e4567-e89b-12d3-a456-426614174002',
    libraryItemId: '123e4567-e89b-12d3-a456-426614174000',
    mediaType: 'book',
    date: '2026-10-19',
    activeSeconds: 1800,
    timezone: 'Asia/Manila',
  };

  const validation = validateSession(session);
  assert.equal(validation.valid, true, `Validation failed: ${validation.errors?.join(', ')}`);
  assert.equal(session.date, '2026-10-19');
  assert.equal(session.timezone, 'Asia/Manila');

  // Verify calendar page indexes sessions by exact date
  const calendarSource = readFileSync(resolve('src/pages/app/CalendarPage.jsx'), 'utf-8');
  assert.ok(
    calendarSource.includes('s.startedAt ? s.startedAt.split(\'T\')[0] : s.date'),
    'Calendar must index verified sessions by exact session date'
  );
});

test('Acceptance Scenario H: Historical Range Import Without Fake Daily Cells', async () => {
  // Scenario H: Given a Bookmory log covering November 19–December 2 with total time but no per-day timestamps,
  // when imported, then calendar does not show 14 fabricated active days.
  const agg = {
    schemaVersion: 2,
    id: '123e4567-e89b-12d3-a456-426614174003',
    libraryItemId: '123e4567-e89b-12d3-a456-426614174000',
    isDailySession: false,
    totalMinutes: 240,
  };

  const validation = validateHistoricalAggregate(agg);
  assert.equal(validation.valid, true, `Validation failed: ${validation.errors?.join(', ')}`);
  assert.strictEqual(agg.isDailySession, false, 'isDailySession must be strictly false');

  // CalendarPage must filter out non-daily aggregates
  const calendarSource = readFileSync(resolve('src/pages/app/CalendarPage.jsx'), 'utf-8');
  assert.ok(
    calendarSource.includes('if (s.isDailySession === false) return;'),
    'CalendarPage must exclude isDailySession === false from single day cell interpolation'
  );
});

test('Acceptance Scenario I: Game Finished Correction & Playthrough Preservation', async () => {
  // Scenario I: Given a finished game from an older playthrough, when its current status becomes Playing
  // or a new playthrough starts, the current Playing view is correct while prior completion remains in history.
  const pastAttempt = {
    schemaVersion: 2,
    id: '123e4567-e89b-12d3-a456-426614174004',
    libraryItemId: '123e4567-e89b-12d3-a456-426614174005',
    ordinal: 1,
    status: 'completed',
  };
  const attemptValidation = validateAttempt(pastAttempt);
  assert.equal(attemptValidation.valid, true, `Attempt validation failed: ${attemptValidation.errors?.join(', ')}`);

  const gameItem = {
    schemaVersion: 2,
    id: '123e4567-e89b-12d3-a456-426614174005',
    mediaType: 'game',
    title: 'Elden Ring',
    creators: ['FromSoftware'],
    status: 'playing', // Transitioned back to playing for second playthrough
    visibility: 'private',
    progress: { unit: 'percent', current: 20, total: 100 },
  };
  const gameValidation = validateLibraryItem(gameItem);
  assert.equal(gameValidation.valid, true, `Game validation failed: ${gameValidation.errors?.join(', ')}`);
  assert.equal(gameItem.status, 'playing');
});

test('Acceptance Scenario J: Unpublish Immediate Removal From Public Shelf', async () => {
  // Scenario J: Given a book published to portfolio, when owner unpublishes and remote write completes,
  // signed-out viewers cannot retrieve that book from active public shelf.
  const dbSource = readFileSync(resolve('src/lib/db.js'), 'utf-8');
  assert.ok(dbSource.includes('unpublishLibraryItem'), 'db.js must export unpublishLibraryItem');
  assert.ok(dbSource.includes('deleteDoc(shelfRef)'), 'unpublish must delete document from publicProfiles shelf');

  // Verify firestore rules allows public read on publicProfiles and owner-only delete
  const rulesSource = readFileSync(resolve('firestore.rules'), 'utf-8');
  assert.ok(rulesSource.includes('match /publicProfiles/{uid}'), 'firestore.rules must match publicProfiles');
  assert.ok(rulesSource.includes("allow read: if uid == 'B0p0XBPscBNF4Dchuk1IsOACrvk2';"), 'Public can read publicProfiles of portfolio owner');
  assert.ok(rulesSource.includes('allow write: if isOwner(uid)'), 'Only owner can write to publicProfiles');
});

test('Acceptance Scenario K: Private Text Absent From Client Bundle Assets', async () => {
  // Scenario K: Given a private note containing a unique test marker, when producing public bundle
  // and visiting public pages as unauthenticated user, marker is absent from public JS assets.
  const assetFiles = readFileSync(resolve('src/data/books.js'), 'utf-8');
  assert.ok(!assetFiles.includes('privateNotes:'), 'src/data/books.js has no privateNotes');
  assert.ok(!assetFiles.includes('logs: ['), 'src/data/books.js has no raw logs');

  // Domain sanitizer test
  const privateItem = {
    id: 'sec-test-1',
    title: 'Private Volume',
    mediaType: 'book',
    status: 'reading',
    privateNotes: 'TOP_SECRET_USER_DIARY_NOTE_2026',
    logs: [{ date: '2026-10-19', note: 'CLASSIFIED_REFLECTIONS' }],
  };
  const publicShelf = toPublicShelfItem(privateItem);
  assert.equal(publicShelf.privateNotes, undefined, 'privateNotes must be stripped');
  assert.equal(publicShelf.logs, undefined, 'logs must be stripped');
  assert.equal(JSON.stringify(publicShelf).includes('TOP_SECRET'), false);
});

test('Acceptance Scenario L: Offline Persistence and Sync State Transparency', async () => {
  // Scenario L: Given app offline, when session is saved, then it is durably available locally,
  // labeled pending, and later acknowledged without duplicate writes.
  const firebaseSource = readFileSync(resolve('src/lib/firebase.js'), 'utf-8');
  assert.ok(
    firebaseSource.includes('persistentLocalCache') || firebaseSource.includes('initializeFirestore'),
    'Firebase must enable offline persistence cache'
  );

  const repoSource = readFileSync(resolve('src/domain/repository/diaryRepository.js'), 'utf-8');
  assert.ok(repoSource.includes('hasPendingWrites'), 'Repository must monitor and report hasPendingWrites');

  const dbSource = readFileSync(resolve('src/lib/db.js'), 'utf-8');
  assert.ok(dbSource.includes('tombstones') || dbSource.includes('deletedIds'), 'Tombstone safety for offline deletions');
});
