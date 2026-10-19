import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('Phase 3 Exit Gate - P3-01: Calendar delivers month grid with cover-based markers', () => {
    const calendarPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'CalendarPage.jsx');
    const content = fs.readFileSync(calendarPath, 'utf8');

    assert.ok(content.includes('DiaryShell'), 'Calendar must use DiaryShell');
    assert.ok(content.includes('watchPublicBooks'), 'Calendar must observe books');
    assert.ok(content.includes('watchPublicGames'), 'Calendar must observe games');
    assert.ok(content.includes('cover'), 'Must display cover art in day cells');
});

test('Phase 3 Exit Gate - P3-02: Journal delivers private reflection and quote timeline', () => {
    const journalPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'JournalPage.jsx');
    const content = fs.readFileSync(journalPath, 'utf8');

    assert.ok(content.includes('DiaryShell'), 'Journal must use DiaryShell');
    assert.ok(content.includes('reflection'), 'Journal must support reflection type');
    assert.ok(content.includes('book_quote') || content.includes('Quote'), 'Journal must support quote type');
});

test('Phase 3 Exit Gate - P3-03: Insights delivers transparent media analytics', () => {
    const insightsPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'InsightsPage.jsx');
    const content = fs.readFileSync(insightsPath, 'utf8');

    assert.ok(content.includes('DiaryShell'), 'Insights must use DiaryShell');
    assert.ok(content.includes("'combined'"), 'Must support Combined insights');
    assert.ok(content.includes("'books'"), 'Must support Books insights');
    assert.ok(content.includes("'games'"), 'Must support Games insights');
});

test('Phase 3 Exit Gate - Privacy and Integrity invariant verification', () => {
    const journalPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'JournalPage.jsx');
    const journalContent = fs.readFileSync(journalPath, 'utf8');
    assert.ok(journalContent.includes('useAuth'), 'Journal must require authentication');

    const calendarPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'CalendarPage.jsx');
    const calendarContent = fs.readFileSync(calendarPath, 'utf8');
    assert.ok(!calendarContent.includes('totalPages + totalHours'), 'Calendar must not synthesize fake metrics');
});
