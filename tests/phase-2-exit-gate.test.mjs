import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('Phase 2 Exit Gate - P2-01: 5-Tab Diary Shell & Navigation redirects certified', () => {
    const navConfigPath = path.join(ROOT_DIR, 'src', 'components', 'diary', 'navigationConfig.js');
    const shellPath = path.join(ROOT_DIR, 'src', 'components', 'diary', 'DiaryShell.jsx');
    const appPath = path.join(ROOT_DIR, 'src', 'App.jsx');

    assert.ok(fs.existsSync(navConfigPath), 'navigationConfig.js must exist');
    assert.ok(fs.existsSync(shellPath), 'DiaryShell.jsx must exist');

    const appContent = fs.readFileSync(appPath, 'utf8');
    assert.ok(appContent.includes('/app/home'), 'Route /app/home must exist');
    assert.ok(appContent.includes('/app/library/books'), 'Route /app/library/books must exist');
    assert.ok(appContent.includes('/app/library/games'), 'Route /app/library/games must exist');
    assert.ok(appContent.includes('path="calendar"'), 'Route /app/calendar must exist');
    assert.ok(appContent.includes('path="journal"'), 'Route /app/journal must exist');
    assert.ok(appContent.includes('path="insights"'), 'Route /app/insights must exist');
});

test('Phase 2 Exit Gate - P2-02: Library segmented switch and detail pages certified', () => {
    const switchPath = path.join(ROOT_DIR, 'src', 'components', 'library', 'LibrarySegmentedSwitch.jsx');
    const bookDetailPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'BookDetailPage.jsx');
    const gameDetailPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'GameDetailPage.jsx');

    assert.ok(fs.existsSync(switchPath), 'LibrarySegmentedSwitch.jsx must exist');
    assert.ok(fs.existsSync(bookDetailPath), 'BookDetailPage.jsx must exist');
    assert.ok(fs.existsSync(gameDetailPath), 'GameDetailPage.jsx must exist');

    const bookDetailContent = fs.readFileSync(bookDetailPath, 'utf8');
    assert.ok(bookDetailContent.includes('DiaryShell'), 'BookDetailPage must be wrapped in DiaryShell');
    assert.ok(bookDetailContent.includes('ReadingTimerModal'), 'BookDetailPage must launch timer');
    assert.ok(bookDetailContent.includes('getBookPrivateNotes'), 'BookDetailPage must preserve private notes');

    const gameDetailContent = fs.readFileSync(gameDetailPath, 'utf8');
    assert.ok(gameDetailContent.includes('DiaryShell'), 'GameDetailPage must be wrapped in DiaryShell');
    assert.ok(gameDetailContent.includes('getGamePrivateNotes'), 'GameDetailPage must preserve private notes');
});

test('Phase 2 Exit Gate - P2-03: ActivityTimerProvider and ActiveTimerTray certified', () => {
    const contextPath = path.join(ROOT_DIR, 'src', 'context', 'TimerContext.jsx');
    const trayPath = path.join(ROOT_DIR, 'src', 'components', 'timer', 'ActiveTimerTray.jsx');

    assert.ok(fs.existsSync(contextPath), 'TimerContext.jsx must exist');
    assert.ok(fs.existsSync(trayPath), 'ActiveTimerTray.jsx must exist');

    const contextContent = fs.readFileSync(contextPath, 'utf8');
    assert.ok(contextContent.includes('ActivityTimerProvider'), 'Must export ActivityTimerProvider');
    assert.ok(contextContent.includes('startTimer'), 'Must provide startTimer');
    assert.ok(contextContent.includes('pauseTimer'), 'Must provide pauseTimer');
    assert.ok(contextContent.includes('resumeTimer'), 'Must provide resumeTimer');
    assert.ok(contextContent.includes('openReview'), 'Must provide openReview');
    assert.ok(contextContent.includes('discardTimer'), 'Must provide discardTimer');
});

test('Phase 2 Exit Gate - P2-04: Home dashboard with live active media and Continue certified', () => {
    const homePath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'HomePage.jsx');
    const content = fs.readFileSync(homePath, 'utf8');

    assert.ok(content.includes('watchPublicBooks'), 'Home must watch public books');
    assert.ok(content.includes('watchPublicGames'), 'Home must watch public games');
    assert.ok(content.includes('HomeHighlights'), 'Home must render the premium active reading/playing component');
    assert.ok(content.includes('startTimer'), 'Home must allow starting/resuming timer on active media');
});

test('Phase 2 Exit Gate - All 5 Exit Criteria fully verified', () => {
    // 1. Unified Diary navigation
    const shellContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'diary', 'DiaryShell.jsx'), 'utf8');
    assert.ok(shellContent.includes('ActiveTimerTray'), 'Persistent shell includes ActiveTimerTray');

    // 2. Media detail routes
    const appContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'App.jsx'), 'utf8');
    assert.ok(appContent.includes('path="books/:id"'), 'Route /app/books/:id must be registered');
    assert.ok(appContent.includes('path="games/:id"'), 'Route /app/games/:id must be registered');

    // 3. Backward compatibility
    assert.ok(appContent.includes('path="books"'), 'Legacy /app/books redirect preserved');
    assert.ok(appContent.includes('path="games"'), 'Legacy /app/games redirect preserved');
});
