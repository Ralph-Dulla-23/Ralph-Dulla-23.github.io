import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

// These tests check the new contract rather than legacy per-screen markup.
test('premium layout keeps a single authenticated persistent diary shell', () => {
  const app = source('App.jsx');
  const shell = source('components/diary/DiaryShell.jsx');
  assert.match(app, /path="\/app"[\s\S]*?<RequireAuth>[\s\S]*?<DiaryShell[\s\S]*?<Outlet \/>/);
  assert.match(shell, /createContext\(null\)/);
  assert.match(shell, /if \(existingFrame\) return <DiaryScreen/);
  for (const overlay of ['ActiveTimerTray', 'ActivityTimerReviewModal', 'ImmersiveReadingTimer', 'ReadingSessionResult']) {
    assert.match(shell, new RegExp(`<${overlay}\\s*/>`));
  }
});

test('five destinations and distinct FAB, without decorative sync pulse', () => {
  const shell = source('components/diary/DiaryShell.jsx');
  assert.match(shell, /PRIMARY_DIARY_TABS\.map/);
  assert.match(shell, /className="diary-fab/);
  assert.doesNotMatch(shell, /animate-pulse|Live Sync/);
  assert.match(shell, /safe-area-inset-bottom/);
});

test('reading-first home uses actual session records and preserves unknown state', () => {
  const home = source('pages/app/HomePage.jsx');
  const highlights = source('components/home/HomeHighlights.jsx');
  assert.match(home, /sessions=\{liveSessions\}/);
  assert.match(home, /sessionError \|\| sessionLoading \? '—'/);
  assert.match(highlights, /session\.isDailySession !== false/);
  assert.match(highlights, /Resume reading/);
  assert.match(highlights, /Continue playing/);
  assert.match(highlights, /role="progressbar"/);
});

test('quick action dialog traps focus, closes with Escape and respects motion preferences', () => {
  const sheet = source('components/diary/QuickActionModal.jsx');
  const styles = source('index.css');
  assert.match(sheet, /aria-modal="true"/);
  assert.match(sheet, /event\.key !== 'Tab'/);
  assert.match(sheet, /event\.key === 'Escape'/);
  assert.match(sheet, /returnFocus\?\.focus/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /diary-sheet-enter/);
});

test('calendar selection exposes keyboard-accessible date and session count', () => {
  const calendar = source('pages/app/CalendarPage.jsx');
  assert.match(calendar, /aria-pressed=\{isSelected\}/);
  assert.match(calendar, /aria-label=\{`\$\{dateKey\}: \$\{daySessions\.length\}/);
  assert.match(calendar, /diary-month-enter/);
});
