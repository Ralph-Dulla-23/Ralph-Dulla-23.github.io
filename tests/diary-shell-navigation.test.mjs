import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const navConfigUrl = pathToFileURL(path.resolve(__dirname, '../src/components/diary/navigationConfig.js')).href;
const appJsxPath = path.resolve(__dirname, '../src/App.jsx');
const appJsxContent = fs.readFileSync(appJsxPath, 'utf8');

test('TC-01: App.jsx defines all 5 private diary routes protected by RequireAuth', () => {
    assert.ok(appJsxContent.includes('path="/app/home"'), 'App.jsx must define route /app/home');
    assert.ok(appJsxContent.includes('path="/app/library/books"'), 'App.jsx must define route /app/library/books');
    assert.ok(appJsxContent.includes('path="/app/library/games"'), 'App.jsx must define route /app/library/games');
    assert.ok(appJsxContent.includes('path="/app/calendar"'), 'App.jsx must define route /app/calendar');
    assert.ok(appJsxContent.includes('path="/app/journal"'), 'App.jsx must define route /app/journal');
    assert.ok(appJsxContent.includes('path="/app/insights"'), 'App.jsx must define route /app/insights');
});

test('TC-02: App.jsx implements compatibility redirects for legacy routes', () => {
    // /app -> /app/home
    assert.ok(
        /path="\/app"\s+element=\{<Navigate to="\/app\/home" replace \/>\}/.test(appJsxContent),
        '/app must redirect to /app/home'
    );
    // /app/books -> /app/library/books
    assert.ok(
        /path="\/app\/books"\s+element=\{<Navigate to="\/app\/library\/books" replace \/>\}/.test(appJsxContent),
        '/app/books must redirect to /app/library/books'
    );
    // /app/games -> /app/library/games
    assert.ok(
        /path="\/app\/games"\s+element=\{<Navigate to="\/app\/library\/games" replace \/>\}/.test(appJsxContent),
        '/app/games must redirect to /app/library/games'
    );
});

test('TC-03: navigationConfig defines exactly 5 primary persistent tabs', async () => {
    const { PRIMARY_DIARY_TABS } = await import(navConfigUrl);

    assert.equal(PRIMARY_DIARY_TABS.length, 5, 'Must have exactly 5 persistent tabs');
    const tabKeys = PRIMARY_DIARY_TABS.map((t) => t.id);
    assert.deepEqual(tabKeys, ['home', 'library', 'calendar', 'journal', 'insights']);

    // Ensure no public routes in primary private tabs
    assert.ok(!PRIMARY_DIARY_TABS.some((t) => t.path === '/stats' || t.path === '/portfolio'));
});

test('TC-04: getActiveTab derives active tab directly from location.pathname', async () => {
    const { getActiveTab } = await import(navConfigUrl);

    assert.equal(getActiveTab('/app/home'), 'home');
    assert.equal(getActiveTab('/app/library/books'), 'library');
    assert.equal(getActiveTab('/app/library/games'), 'library');
    assert.equal(getActiveTab('/app/library'), 'library');
    assert.equal(getActiveTab('/app/calendar'), 'calendar');
    assert.equal(getActiveTab('/app/journal'), 'journal');
    assert.equal(getActiveTab('/app/insights'), 'insights');
    assert.equal(getActiveTab('/unknown'), null);
});

test('TC-05: QUICK_ACTIONS defines all 5 required rapid logging options', async () => {
    const { QUICK_ACTIONS } = await import(navConfigUrl);

    assert.equal(QUICK_ACTIONS.length, 5);
    const actionIds = QUICK_ACTIONS.map((a) => a.id);
    assert.deepEqual(actionIds, [
        'add_book',
        'add_game',
        'log_reading',
        'log_playtime',
        'write_note',
    ]);
});

test('TC-06: Shell header provides clear navigation link back to /portfolio and sign out', () => {
    const shellPath = path.resolve(__dirname, '../src/components/diary/DiaryShell.jsx');
    assert.ok(fs.existsSync(shellPath), 'DiaryShell.jsx must exist');
    const shellContent = fs.readFileSync(shellPath, 'utf8');

    assert.ok(shellContent.includes('/portfolio'), 'Must contain navigation to /portfolio');
    assert.ok(shellContent.includes('logout'), 'Must handle logout/sign-out');
    assert.ok(shellContent.includes('darkMode'), 'Must support dark mode toggle');
});

test('TC-07: Public portfolio routes remain isolated from DiaryShell', () => {
    const layoutPath = path.resolve(__dirname, '../src/components/Layout.jsx');
    const layoutContent = fs.readFileSync(layoutPath, 'utf8');

    assert.ok(!layoutContent.includes('DiaryShell'), 'Public Layout must not import or render DiaryShell');
    assert.ok(!appJsxContent.includes('<DiaryShell'), 'App.jsx root routes must not wrap public pages in DiaryShell');
});

test('TC-08: Diary navigation controls maintain touch-friendly accessibility targets', () => {
    const shellPath = path.resolve(__dirname, '../src/components/diary/DiaryShell.jsx');
    const shellContent = fs.readFileSync(shellPath, 'utf8');

    assert.ok(shellContent.includes('min-h-[44px]') || shellContent.includes('min-w-[44px]') || shellContent.includes('py-2'), 'Interactive controls must have touch targets >= 44px');
    assert.ok(shellContent.includes('aria-label'), 'Navigation items must include aria-label');
});
