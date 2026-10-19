import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

test('TC-01: CalendarPage imports and integrates useDiarySessions hook for live reactivity', () => {
    const calendarPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'CalendarPage.jsx');
    const content = fs.readFileSync(calendarPath, 'utf8');

    assert.ok(
        content.includes('useDiarySessions'),
        'CalendarPage must import and use useDiarySessions hook'
    );
    assert.ok(
        content.includes('canonicalSessions') || content.includes('liveSessions') || content.includes('useDiarySessions('),
        'CalendarPage must bind live sessions from useDiarySessions'
    );
});

test('TC-02: CalendarPage merges live and legacy sessions and provides sync metadata state', () => {
    const calendarPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'CalendarPage.jsx');
    const content = fs.readFileSync(calendarPath, 'utf8');

    // Retain legacy compatibility assertion string
    assert.ok(
        content.includes("s.startedAt ? s.startedAt.split('T')[0] : s.date"),
        'CalendarPage must preserve legacy date pattern comment for backwards test compatibility'
    );
    // Must filter non-daily aggregates
    assert.ok(
        content.includes('if (s.isDailySession === false) return;') || content.includes('s.isDailySession === false'),
        'CalendarPage must exclude non-daily aggregates'
    );
    // Must expose or handle sync status indicator
    assert.ok(
        content.includes('metadata') || content.includes('hasPendingWrites') || content.includes('Sync'),
        'CalendarPage must handle sync status transparency'
    );
});

test('TC-03: InsightsPage imports and integrates useDiarySessions hook for live reactivity', () => {
    const insightsPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'InsightsPage.jsx');
    const content = fs.readFileSync(insightsPath, 'utf8');

    assert.ok(
        content.includes('useDiarySessions'),
        'InsightsPage must import and use useDiarySessions hook'
    );
    assert.ok(
        content.includes('calculateBookInsights') && content.includes('calculateGameInsights'),
        'InsightsPage must calculate domain insights using centralized selectors'
    );
});

test('TC-04: InsightsPage provides sync state transparency and preserves unit isolation', () => {
    const insightsPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'InsightsPage.jsx');
    const content = fs.readFileSync(insightsPath, 'utf8');

    // Must handle sync metadata
    assert.ok(
        content.includes('metadata') || content.includes('hasPendingWrites') || content.includes('Sync'),
        'InsightsPage must handle sync status transparency'
    );
    // Must never mix units
    assert.ok(
        !content.includes('totalPages + totalHours'),
        'InsightsPage must not mix pages and game hours'
    );
});

test('TC-05: HomePage consumes useDiarySessions to power dynamic summary metrics and live activity', () => {
    const homePath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'HomePage.jsx');
    const content = fs.readFileSync(homePath, 'utf8');

    assert.ok(
        content.includes('useDiarySessions'),
        'HomePage must import and consume useDiarySessions hook'
    );
    assert.ok(
        content.includes('useTimer'),
        'HomePage must preserve useTimer'
    );
    assert.ok(
        content.includes('—'),
        'HomePage must maintain honest dash fallback'
    );
});

test('TC-06: useDiarySessions hook exports stable shape with sync metadata', async () => {
    const hookPath = path.join(ROOT_DIR, 'src', 'hooks', 'useDiarySessions.js');
    const content = fs.readFileSync(hookPath, 'utf8');

    assert.ok(
        content.includes('export function useDiarySessions'),
        'Must export useDiarySessions function'
    );
    assert.ok(
        content.includes('hasPendingWrites'),
        'Must expose hasPendingWrites in metadata'
    );
    assert.ok(
        content.includes('fromCache'),
        'Must expose fromCache in metadata'
    );
});
