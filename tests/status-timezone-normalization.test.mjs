import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

test('TC-01: toLocalDateKey converts UTC ISO timestamp across midnight to Manila date (DATA-04)', async () => {
    const { toLocalDateKey, DEFAULT_TIMEZONE } = await import('../src/domain/dates.js');
    assert.equal(DEFAULT_TIMEZONE, 'Asia/Manila');

    // 2026-10-19T16:30:00Z is 00:30 on October 20 in Manila (UTC+8)
    const manilaDate = toLocalDateKey('2026-10-19T16:30:00Z', 'Asia/Manila');
    assert.equal(manilaDate, '2026-10-20', '16:30 UTC must cross midnight into Oct 20 Manila');

    // 2026-10-19T15:59:59Z is 23:59:59 on October 19 in Manila (UTC+8)
    const manilaDateBeforeMidnight = toLocalDateKey('2026-10-19T15:59:59Z', 'Asia/Manila');
    assert.equal(manilaDateBeforeMidnight, '2026-10-19', '15:59 UTC must remain Oct 19 Manila');
});

test('TC-02: toLocalDateKey gracefully handles plain date strings and invalid inputs', async () => {
    const { toLocalDateKey } = await import('../src/domain/dates.js');

    assert.equal(toLocalDateKey('2026-10-19'), '2026-10-19');
    assert.equal(toLocalDateKey(null), null);
    assert.equal(toLocalDateKey(undefined), null);
    assert.equal(toLocalDateKey(''), null);
    assert.equal(toLocalDateKey('invalid-date'), null);
});

test('TC-03: normalizeGameStatus maps legacy finished and replaying to canonical states', async () => {
    const { normalizeGameStatus } = await import('../src/domain/status.js');

    assert.equal(normalizeGameStatus('finished'), 'completed');
    assert.equal(normalizeGameStatus('Finished'), 'completed');
    assert.equal(normalizeGameStatus('replaying'), 'replay');
    assert.equal(normalizeGameStatus('playing'), 'playing');
    assert.equal(normalizeGameStatus('backlog'), 'backlog');
    assert.equal(normalizeGameStatus('paused'), 'paused');
    assert.equal(normalizeGameStatus('dropped'), 'dropped');
    assert.equal(normalizeGameStatus(null), 'backlog');
});

test('TC-04: normalizeBookStatus maps legacy aliases to canonical states', async () => {
    const { normalizeBookStatus } = await import('../src/domain/status.js');

    assert.equal(normalizeBookStatus('want_to_read'), 'want-to-read');
    assert.equal(normalizeBookStatus('to-read'), 'want-to-read');
    assert.equal(normalizeBookStatus('finished'), 'completed');
    assert.equal(normalizeBookStatus('read'), 'completed');
    assert.equal(normalizeBookStatus('reading'), 'reading');
    assert.equal(normalizeBookStatus('abandoned'), 'dropped');
    assert.equal(normalizeBookStatus('on-hold'), 'paused');
    assert.equal(normalizeBookStatus(null), 'want-to-read');
});

test('TC-05: calculateGameInsights accurately tallies legacy finished games under completedCount', async () => {
    const { calculateGameInsights } = await import('../src/domain/selectors/insightsSelectors.js');

    const sampleGames = [
        { id: 'g1', title: 'Game 1', status: 'finished', hoursPlayed: 25 },
        { id: 'g2', title: 'Game 2', status: 'completed', hoursPlayed: 15 },
        { id: 'g3', title: 'Game 3', status: 'playing', hoursPlayed: 10 },
        { id: 'g4', title: 'Game 4', status: 'backlog', hoursPlayed: 0 },
        { id: 'g5', title: 'Game 5', status: 'replaying', hoursPlayed: 8 },
    ];

    const result = calculateGameInsights(sampleGames, [], 'all', 'Asia/Manila');
    assert.equal(result.completedCount, 2, 'Both finished and completed must count as completed');
    assert.equal(result.playingCount, 1, 'Only playing games count as playing');
    assert.equal(result.backlogCount, 1, 'Only backlog games count as backlog');
    assert.equal(result.replayCount, 1, 'replaying must count as replay');
});

test('TC-06: calculateGameInsights clearly separates verified session time from baseline historical hours', async () => {
    const { calculateGameInsights } = await import('../src/domain/selectors/insightsSelectors.js');

    const sampleGames = [
        { id: 'g1', title: 'Cyberpunk', status: 'playing', hoursPlayed: 40 },
    ];
    const sampleSessions = [
        { id: 's1', mediaId: 'g1', mediaType: 'game', minutes: 90, startedAt: '2026-10-19T10:00:00Z', isDailySession: true },
        { id: 's2', mediaId: 'g1', mediaType: 'game', minutes: 30, startedAt: '2026-10-19T14:00:00Z', isDailySession: true },
    ];

    const result = calculateGameInsights(sampleGames, sampleSessions, 'all', 'Asia/Manila');
    assert.equal(result.baselineHours, '40.0', 'Baseline hours must match metadata');
    assert.equal(result.verifiedHours, '2.0', '120 minutes must equal 2.0 verified hours');
    assert.equal(result.totalPlaytimeHours, '42.0', 'Total must be sum of baseline and verified');
});

test('TC-07: groupSessionsByLocalDate groups sessions by Manila date and excludes historical aggregates', async () => {
    const { groupSessionsByLocalDate } = await import('../src/domain/selectors/activitySelectors.js');

    const sampleSessions = [
        // 16:30 UTC on Oct 19 is Oct 20 Manila
        { id: 's1', startedAt: '2026-10-19T16:30:00Z', isDailySession: true, minutes: 45 },
        // 08:00 UTC on Oct 20 is Oct 20 Manila
        { id: 's2', startedAt: '2026-10-20T08:00:00Z', isDailySession: true, minutes: 30 },
        // Multi-day aggregate: MUST BE EXCLUDED from daily grouping
        { id: 'agg1', startedAt: '2026-10-20T08:00:00Z', isDailySession: false, minutes: 300 },
    ];

    const grouped = groupSessionsByLocalDate(sampleSessions, 'Asia/Manila');
    assert.ok(grouped.has('2026-10-20'), 'Must contain 2026-10-20');
    assert.equal(grouped.get('2026-10-20').length, 2, 'Must include only the 2 verified daily sessions');
    assert.equal(grouped.has('2026-10-19'), false, '16:30 UTC must not map to Oct 19');
});

test('TC-08: InsightsPage and CalendarPage consume toLocalDateKey and domain selectors', () => {
    const insightsPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'InsightsPage.jsx');
    const calendarPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'CalendarPage.jsx');

    assert.ok(fs.existsSync(insightsPath));
    assert.ok(fs.existsSync(calendarPath));

    const insightsContent = fs.readFileSync(insightsPath, 'utf8');
    const calendarContent = fs.readFileSync(calendarPath, 'utf8');

    assert.ok(
        insightsContent.includes('toLocalDateKey') || insightsContent.includes('calculateGameInsights'),
        'InsightsPage must use toLocalDateKey or domain selectors'
    );
    assert.ok(
        calendarContent.includes('toLocalDateKey'),
        'CalendarPage must use toLocalDateKey for accurate timezone dates'
    );
});
