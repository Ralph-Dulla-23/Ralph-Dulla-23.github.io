import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('header has no permanent sync dot and retains backup, theme, portfolio and sign out', () => {
  const shell = source('components/diary/DiaryShell.jsx');
  assert.doesNotMatch(shell, /bg-emerald-500 inline-block animate-pulse/);
  assert.match(shell, /aria-label="Open diary menu"|Close diary menu/);
  for (const required of ['handleBackup', 'setDarkMode', '/portfolio', 'handleLogout']) assert.ok(shell.includes(required));
});

test('diary main pages do not advertise Live Sync', () => {
  for (const page of ['HomePage', 'CalendarPage', 'JournalPage', 'InsightsPage']) {
    const content = source(`pages/app/${page}.jsx`);
    assert.doesNotMatch(content, /Live Sync|Syncing offline/);
  }
});

test('reading and gaming share one timer while reading has immersive and results flow', () => {
  const shell = source('components/diary/DiaryShell.jsx');
  const books = source('pages/app/BooksPage.jsx');
  const context = source('context/TimerContext.jsx');
  assert.match(shell, /<ImmersiveReadingTimer\s*\/>/);
  assert.match(shell, /<ReadingSessionResult\s*\/>/);
  assert.match(books, /handleStartReading/);
  assert.doesNotMatch(books, /<ReadingTimerModal/);
  assert.match(context, /repository\.createSession\(sessionData\)/);
  assert.match(context, /setLastSessionResult/);
  assert.doesNotMatch(context, /setInterval\(/);
});

test('book session count uses merged sessions and untimed logs are marked as progress', () => {
  const detail = source('pages/app/BookDetailPage.jsx');
  assert.match(detail, /Sessions \(\{displaySessions\.length\}\)/);
  assert.match(detail, /Progress log/);
});

test('clock uses real timestamps not number of interval ticks', () => {
  const hook = source('hooks/useElapsedDisplay.js');
  assert.match(hook, /Date\.now\(\)/);
  assert.match(hook, /accumulatedActiveMs/);
  assert.match(hook, /runningSinceEpochMs/);
});
