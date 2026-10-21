import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getAvailableGenres } from '../src/domain/selectors/availableGenres.js';
import { calculateDailyReadingTimeline } from '../src/domain/selectors/dailyReadingTimeline.js';

const root = new URL('../', import.meta.url);
const source = (file) => readFileSync(new URL(file, root), 'utf8');

test('web genre choices contain only saved published-book genres, sorted by frequency', () => {
  const result = getAvailableGenres([
    { genres: ['Romance', 'Fantasy', 'Fantasy'] },
    { genres: ['Romance', ' Mystery '] },
    { genres: [] },
  ]);
  assert.deepEqual(result, [
    { name: 'Romance', count: 2 },
    { name: 'Fantasy', count: 1 },
    { name: 'Mystery', count: 1 },
  ]);
});

test('daily stats do not invent dates for historical aggregates or game sessions', () => {
  const date = '2026-10-20';
  const result = calculateDailyReadingTimeline([{ id: 'b1' }], [
    { id: 's1', mediaType: 'book', bookId: 'b1', startedAt: '2026-10-20T10:00:00+08:00', activeSeconds: 1200, pagesRead: 12 },
    { id: 's2', mediaType: 'game', startedAt: '2026-10-20T10:00:00+08:00', activeSeconds: 4000 },
    { id: 'aggregate', mediaType: 'book', bookId: 'b1', startedAt: '2026-10-19T10:00:00+08:00', isDailySession: false, minutes: 100 },
  ], 3, 'Asia/Manila', date);
  assert.equal(result.totalMinutes, 20);
  assert.equal(result.totalPages, 12);
  assert.equal(result.streak, 1);
  assert.equal(result.daily[2].sessions, 1);
});

test('private edits refresh only previously published records and public web listens in realtime', () => {
  const sync = source('src/services/publishedItemSync.js');
  const db = source('src/lib/db.js');
  const publicService = source('src/services/publicShelfService.js');
  assert.match(sync, /if \(publicSnapshot\.exists\(\)\)/);
  assert.match(sync, /await updateDoc\(shelfRef/);
  assert.doesNotMatch(sync, /setDoc\(shelfRef/);
  assert.match(db, /queuePublishedItemRefresh\(safeUid, 'book', bookId\)/);
  assert.match(db, /queuePublishedItemRefresh\(safeUid, 'game', gameId\)/);
  assert.match(publicService, /onSnapshot\(/);
});

test('legacy push/pull buttons are not shown on books or games pages', () => {
  for (const page of ['src/pages/app/BooksPage.jsx', 'src/pages/app/GamesPage.jsx']) {
    assert.doesNotMatch(source(page), /Push to Cloud|Pull from Database|Sync to Cloud/);
  }
});
