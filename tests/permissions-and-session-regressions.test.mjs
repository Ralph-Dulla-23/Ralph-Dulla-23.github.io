import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateBookInsights, calculateGameInsights } from '../src/domain/selectors/insightsSelectors.js';
import { toLocalDateKey } from '../src/domain/dates.js';

const code = (name) => readFileSync(name, 'utf8');

test('Public shelf never pulls private browser game records, static book fixtures, or legacy user collections', () => {
    const source = code('src/services/publicShelfService.js');
    assert.ok(source.includes("'publicProfiles'"));
    assert.ok(!source.includes('localStorage.getItem')); 
    assert.ok(!source.includes('fallbackBooks'));
    assert.ok(!source.includes('fallbackGames'));
    assert.ok(!source.includes("'users',"));
});

test('Private game saves and cloud pulls do not implicitly publish games', () => {
    const source = code('src/lib/db.js');
    const save = source.split('export async function saveGame(')[1].split('export async function deleteGame(')[0];
    const pull = source.split('export async function pullGamesFromCloud(')[1].split('/* =========================================================================')[0];
    assert.ok(!save.includes('await publishLibraryItem('));
    assert.ok(!pull.includes('publishLibraryItem('));
    assert.ok(!code('src/pages/app/GamesPage.jsx').includes('publishLibraryItem('));
});

test('Game session duration is read from canonical activeSeconds', () => {
    const result = calculateGameInsights([{ id: 'g1', hoursPlayed: 4, status: 'finished' }], [
        { id: 's1', mediaType: 'game', libraryItemId: 'g1', activeSeconds: 3600, date: '2026-10-20', isDailySession: true },
    ], 'all');
    assert.equal(result.verifiedMinutes, 60);
    assert.equal(result.totalPlaytimeHours, '5.0');
    assert.equal(result.completedCount, 1);
});

test('Book sessions with canonical start/end pages and activeSeconds appear in insights', () => {
    const result = calculateBookInsights([{ id: 'b1', status: 'reading' }], [
        { id: 's2', mediaType: 'book', libraryItemId: 'b1', activeSeconds: 1800, startPage: 20, endPage: 40, pagesRead: 20, date: '2026-10-20' },
    ], 'all');
    assert.equal(result.totalMinutes, 30);
    assert.equal(result.totalPagesRead, 20);
});

test('Manila midnight activity is assigned to local calendar day', () => {
    assert.equal(toLocalDateKey('2026-10-19T16:30:00.000Z'), '2026-10-20');
});

test('Timer builds page payload for books only, with local date and no anonymous UID fallback', () => {
    const source = code('src/context/TimerContext.jsx');
    assert.ok(source.includes("currentTimer.mediaType === 'book'"));
    assert.ok(source.includes('getCurrentLocalDateKey()'));
    assert.ok(!source.includes("'anonymous-owner'"));
});
