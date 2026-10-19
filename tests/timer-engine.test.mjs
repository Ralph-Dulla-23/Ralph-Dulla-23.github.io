import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('TC-01: TimerContext exports ActivityTimerProvider and useTimer', () => {
    const contextPath = path.join(ROOT_DIR, 'src', 'context', 'TimerContext.jsx');
    assert.ok(fs.existsSync(contextPath), 'TimerContext.jsx must exist');

    const content = fs.readFileSync(contextPath, 'utf8');
    assert.ok(content.includes('ActivityTimerProvider'), 'Must export ActivityTimerProvider');
    assert.ok(content.includes('useTimer'), 'Must export useTimer');
    assert.ok(content.includes('startTimer'), 'Must support startTimer');
    assert.ok(content.includes('pauseTimer'), 'Must support pauseTimer');
    assert.ok(content.includes('resumeTimer'), 'Must support resumeTimer');
    assert.ok(content.includes('discardTimer'), 'Must support discardTimer');
});

test('TC-02: ActiveTimerTray component exists and displays running/paused timer', () => {
    const trayPath = path.join(ROOT_DIR, 'src', 'components', 'timer', 'ActiveTimerTray.jsx');
    assert.ok(fs.existsSync(trayPath), 'ActiveTimerTray.jsx must exist');

    const content = fs.readFileSync(trayPath, 'utf8');
    assert.ok(content.includes('useTimer'), 'ActiveTimerTray must consume useTimer');
    assert.ok(content.includes('pauseTimer') || content.includes('resumeTimer'), 'Must support pause/resume toggle');
});

test('TC-03: DiaryShell integrates ActiveTimerTray for persistent timer visibility', () => {
    const shellPath = path.join(ROOT_DIR, 'src', 'components', 'diary', 'DiaryShell.jsx');
    const content = fs.readFileSync(shellPath, 'utf8');

    assert.ok(content.includes('ActiveTimerTray'), 'DiaryShell must render ActiveTimerTray');
});

test('TC-04: App.jsx wraps protected diary routes with ActivityTimerProvider', () => {
    const appPath = path.join(ROOT_DIR, 'src', 'App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(content.includes('ActivityTimerProvider'), 'App.jsx must wrap routes with ActivityTimerProvider');
});

test('TC-05: Timer state contract supports both book and game media types', () => {
    const contextPath = path.join(ROOT_DIR, 'src', 'context', 'TimerContext.jsx');
    const content = fs.readFileSync(contextPath, 'utf8');

    assert.ok(content.includes("'book'") || content.includes('"book"'), 'Must handle book timer');
    assert.ok(content.includes("'game'") || content.includes('"game"'), 'Must handle game timer');
    assert.ok(content.includes('accumulatedActiveMs') || content.includes('accumulatedSeconds'), 'Must preserve accumulated time');
});
