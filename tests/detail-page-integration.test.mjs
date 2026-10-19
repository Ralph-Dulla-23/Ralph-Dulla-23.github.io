import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('TC-01: BookDetailPage does not render duplicate ReadingTimerModal engine', async () => {
    const bookDetailPath = resolve('src/pages/app/BookDetailPage.jsx');
    assert.ok(existsSync(bookDetailPath), 'BookDetailPage.jsx must exist');

    const content = readFileSync(bookDetailPath, 'utf-8');
    assert.ok(
        !content.includes('<ReadingTimerModal'),
        'BookDetailPage must NOT render <ReadingTimerModal /> (unified timer replaces it)'
    );
});

test('TC-02: BookDetailPage integrates useDiarySessions for live canonical sessions', async () => {
    const bookDetailPath = resolve('src/pages/app/BookDetailPage.jsx');
    const content = readFileSync(bookDetailPath, 'utf-8');

    assert.ok(content.includes('useDiarySessions'), 'BookDetailPage must import and use useDiarySessions');
});

test('TC-03: GameDetailPage includes Play Sessions tab integrating useDiarySessions', async () => {
    const gameDetailPath = resolve('src/pages/app/GameDetailPage.jsx');
    assert.ok(existsSync(gameDetailPath), 'GameDetailPage.jsx must exist');

    const content = readFileSync(gameDetailPath, 'utf-8');
    assert.ok(content.includes('useDiarySessions'), 'GameDetailPage must import and use useDiarySessions');
    assert.ok(
        content.includes('Play Sessions') || content.includes('Sessions'),
        'GameDetailPage must render a Sessions / Play Sessions tab'
    );
});

test('TC-04: GameDetailPage manual playtime logging creates canonical session', async () => {
    const gameDetailPath = resolve('src/pages/app/GameDetailPage.jsx');
    const content = readFileSync(gameDetailPath, 'utf-8');

    assert.ok(
        content.includes('createSession') || content.includes('getDiaryRepository'),
        'GameDetailPage must persist canonical sessions via repository when logging playtime'
    );
});
