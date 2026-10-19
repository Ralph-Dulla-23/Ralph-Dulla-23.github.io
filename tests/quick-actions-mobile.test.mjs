import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const booksPagePath = path.resolve(__dirname, '../src/pages/app/BooksPage.jsx');
const gamesPagePath = path.resolve(__dirname, '../src/pages/app/GamesPage.jsx');
const journalPagePath = path.resolve(__dirname, '../src/pages/app/JournalPage.jsx');
const diaryShellPath = path.resolve(__dirname, '../src/components/diary/DiaryShell.jsx');
const timerTrayPath = path.resolve(__dirname, '../src/components/timer/ActiveTimerTray.jsx');

test('TC-01: BooksPage consumes ?action=add and ?action=log, clearing URL parameter via replace (UX-01)', async () => {
    const content = fs.readFileSync(booksPagePath, 'utf8');

    assert.ok(
        content.includes('useSearchParams'),
        'BooksPage must import and use useSearchParams from react-router-dom'
    );
    assert.ok(
        content.includes("action === 'add'"),
        'BooksPage must inspect searchParams for action === "add"'
    );
    assert.ok(
        content.includes("action === 'log'"),
        'BooksPage must inspect searchParams for action === "log"'
    );
    assert.ok(
        content.includes('replace: true') || content.includes('setSearchParams'),
        'BooksPage must clear action query param with replace: true to prevent repeated execution'
    );
});

test('TC-02: GamesPage consumes ?action=add and ?action=log, clearing URL parameter via replace (UX-01)', async () => {
    const content = fs.readFileSync(gamesPagePath, 'utf8');

    assert.ok(
        content.includes('useSearchParams'),
        'GamesPage must import and use useSearchParams from react-router-dom'
    );
    assert.ok(
        content.includes("action === 'add'"),
        'GamesPage must inspect searchParams for action === "add"'
    );
    assert.ok(
        content.includes("action === 'log'"),
        'GamesPage must inspect searchParams for action === "log"'
    );
    assert.ok(
        content.includes('replace: true') || content.includes('setSearchParams'),
        'GamesPage must clear action query param with replace: true'
    );
});

test('TC-03: JournalPage consumes ?action=new, opening composer and clearing URL parameter via replace (UX-01)', async () => {
    const content = fs.readFileSync(journalPagePath, 'utf8');

    assert.ok(
        content.includes('useSearchParams'),
        'JournalPage must import and use useSearchParams from react-router-dom'
    );
    assert.ok(
        content.includes("action === 'new'"),
        'JournalPage must inspect searchParams for action === "new"'
    );
    assert.ok(
        content.includes('openWriteModal') || content.includes('setIsWriteModalOpen'),
        'JournalPage must open compose modal when ?action=new is provided'
    );
    assert.ok(
        content.includes('replace: true') || content.includes('setSearchParams'),
        'JournalPage must clear action query param with replace: true'
    );
});

test('TC-04: DiaryShell includes safe-area-inset-top and safe-area-inset-bottom support (UX-02)', async () => {
    const content = fs.readFileSync(diaryShellPath, 'utf8');

    assert.ok(
        content.includes('safe-area-inset-top') || content.includes('env(safe-area-inset-top'),
        'DiaryShell header must support safe-area-inset-top for notched devices'
    );
    assert.ok(
        content.includes('safe-area-inset-bottom') || content.includes('env(safe-area-inset-bottom'),
        'DiaryShell bottom nav bar must support safe-area-inset-bottom for home indicator bars'
    );
});

test('TC-05: ActiveTimerTray accounts for bottom tab height and safe areas (UX-02)', async () => {
    const content = fs.readFileSync(timerTrayPath, 'utf8');

    // Timer tray must have safe bottom placement above nav
    assert.ok(
        content.includes('bottom-') || content.includes('env(safe-area-inset-bottom'),
        'ActiveTimerTray must position itself above bottom tabs without obscuring controls'
    );
    assert.ok(
        content.includes('aria-label') && content.includes('role='),
        'ActiveTimerTray must maintain accessible landmarks'
    );
});

test('TC-06: Bottom navigation controls maintain minimum 44x44px touch targets (UX-02)', async () => {
    const content = fs.readFileSync(diaryShellPath, 'utf8');

    assert.ok(
        content.includes('min-h-[44px]') && content.includes('min-w-[44px]'),
        'Navigation controls must specify 44x44px minimum touch targets'
    );
});
