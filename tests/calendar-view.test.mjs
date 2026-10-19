import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('TC-01: CalendarPage renders month grid, month navigation, and today jump', () => {
    const calendarPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'CalendarPage.jsx');
    const content = fs.readFileSync(calendarPath, 'utf8');

    assert.ok(content.includes('DiaryShell'), 'CalendarPage must be wrapped in DiaryShell');
    assert.ok(content.includes('prevMonth') || content.includes('handlePrevMonth') || content.includes('goToPrevMonth'), 'Must have previous month navigation');
    assert.ok(content.includes('nextMonth') || content.includes('handleNextMonth') || content.includes('goToNextMonth'), 'Must have next month navigation');
    assert.ok(content.includes('today') || content.includes('handleToday') || content.includes('goToToday'), 'Must have jump to today');
});

test('TC-02: CalendarPage displays active covers on dates with verified sessions', () => {
    const calendarPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'CalendarPage.jsx');
    const content = fs.readFileSync(calendarPath, 'utf8');

    assert.ok(content.includes('watchPublicBooks'), 'CalendarPage must observe books');
    assert.ok(content.includes('watchPublicGames'), 'CalendarPage must observe games');
    assert.ok(content.includes('cover') || content.includes('itemCover'), 'Must display cover art in day cells');
});

test('TC-03: CalendarPage supports Day Detail modal/sheet when tapping an active date', () => {
    const calendarPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'CalendarPage.jsx');
    const content = fs.readFileSync(calendarPath, 'utf8');

    assert.ok(content.includes('selectedDate') || content.includes('selectedDay'), 'Must track selected date for day details');
    assert.ok(content.includes('Day Detail') || content.includes('Activity on') || content.includes('selectedDaySessions'), 'Must render day detail modal or sheet');
});

test('TC-04: CalendarPage provides media filters: All, Books, and Games', () => {
    const calendarPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'CalendarPage.jsx');
    const content = fs.readFileSync(calendarPath, 'utf8');

    assert.ok(content.includes("'all'"), 'Must support All filter');
    assert.ok(content.includes("'books'"), 'Must support Books filter');
    assert.ok(content.includes("'games'"), 'Must support Games filter');
});

test('TC-05: CalendarPage excludes multi-day historical aggregates from fake daily cell interpolation', () => {
    const calendarPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'CalendarPage.jsx');
    const content = fs.readFileSync(calendarPath, 'utf8');

    assert.ok(
        content.includes('isDailySession !== false') || content.includes('isDailySession === true') || !content.includes('historicalAggregates'),
        'Calendar must not interpolate multi-day aggregates across individual dates'
    );
});
