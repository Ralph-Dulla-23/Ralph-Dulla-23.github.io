import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('TC-01: InsightsPage provides segmented switcher for Combined, Books, and Games analytics', () => {
    const insightsPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'InsightsPage.jsx');
    const content = fs.readFileSync(insightsPath, 'utf8');

    assert.ok(content.includes('DiaryShell'), 'InsightsPage must be wrapped in DiaryShell');
    assert.ok(content.includes("'combined'"), 'Must support Combined insights');
    assert.ok(content.includes("'books'"), 'Must support Books insights');
    assert.ok(content.includes("'games'"), 'Must support Games insights');
});

test('TC-02: InsightsPage supports date range filters: Month, Year, and All Time', () => {
    const insightsPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'InsightsPage.jsx');
    const content = fs.readFileSync(insightsPath, 'utf8');

    assert.ok(content.includes("'month'"), 'Must support Month filter');
    assert.ok(content.includes("'year'"), 'Must support Year filter');
    assert.ok(content.includes("'all'"), 'Must support All Time filter');
});

test('TC-03: InsightsPage distinguishes verified session time from baseline historical hours', () => {
    const insightsPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'InsightsPage.jsx');
    const content = fs.readFileSync(insightsPath, 'utf8');

    assert.ok(content.includes('hoursPlayed') || content.includes('baselineHours'), 'Must handle manual baseline hours');
    assert.ok(content.includes('watchPublicBooks'), 'Must watch public books');
    assert.ok(content.includes('watchPublicGames'), 'Must watch public games');
});

test('TC-04: InsightsPage avoids adding reading pages and game hours into a mixed total', () => {
    const insightsPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'InsightsPage.jsx');
    const content = fs.readFileSync(insightsPath, 'utf8');

    // Make sure we never compute totalPages + totalHours directly into one single unit
    assert.ok(!content.includes('totalPages + totalHours'), 'Must not mix pages and game hours into a meaningless mixed total');
});
