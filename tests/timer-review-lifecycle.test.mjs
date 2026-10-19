import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('TC-01: ActivityTimerReviewModal.jsx component exists with dialog semantics', async () => {
    const modalPath = resolve('src/components/timer/ActivityTimerReviewModal.jsx');
    assert.ok(existsSync(modalPath), 'ActivityTimerReviewModal.jsx must exist');

    const content = readFileSync(modalPath, 'utf-8');
    assert.ok(content.includes('role="dialog"'), 'Must have role="dialog"');
    assert.ok(content.includes('aria-modal="true"'), 'Must have aria-modal="true"');
    assert.ok(content.includes('useTimer'), 'Must integrate useTimer');
});

test('TC-02: DiaryShell mounts ActivityTimerReviewModal globally', async () => {
    const shellPath = resolve('src/components/diary/DiaryShell.jsx');
    const content = readFileSync(shellPath, 'utf-8');

    assert.ok(content.includes('ActivityTimerReviewModal'), 'DiaryShell must import and mount ActivityTimerReviewModal');
    assert.ok(content.includes('<ActivityTimerReviewModal'), 'DiaryShell must render ActivityTimerReviewModal');
});

test('TC-03: TimerContext exports complete state lifecycle methods', async () => {
    const contextPath = resolve('src/context/TimerContext.jsx');
    const content = readFileSync(contextPath, 'utf-8');

    assert.ok(content.includes('cancelReview'), 'TimerContext must export cancelReview');
    assert.ok(content.includes('saveSession'), 'TimerContext must export saveSession');
    assert.ok(content.includes('discardTimer'), 'TimerContext must export discardTimer');
    assert.ok(content.includes('timerConflict') || content.includes('resolveConflict'), 'TimerContext must support conflict detection');
});

test('TC-04: TimerContext saveSession uses stable sessionId for idempotency', async () => {
    const contextPath = resolve('src/context/TimerContext.jsx');
    const content = readFileSync(contextPath, 'utf-8');

    assert.ok(content.includes('sessionId'), 'Timer state must include stable sessionId');
    assert.ok(content.includes('saving'), 'Timer state must transition to saving state');
});

test('TC-05: BookDetailPage connects Start Reading to useTimer', async () => {
    const detailPath = resolve('src/pages/app/BookDetailPage.jsx');
    const content = readFileSync(detailPath, 'utf-8');

    assert.ok(content.includes('useTimer'), 'BookDetailPage must import and use useTimer');
    assert.ok(content.includes('startTimer'), 'BookDetailPage Start Reading must invoke startTimer');
});

test('TC-06: GameDetailPage connects Start Play Timer to useTimer', async () => {
    const detailPath = resolve('src/pages/app/GameDetailPage.jsx');
    const content = readFileSync(detailPath, 'utf-8');

    assert.ok(content.includes('useTimer'), 'GameDetailPage must import and use useTimer');
    assert.ok(content.includes('startTimer'), 'GameDetailPage Start Play Timer must invoke startTimer');
});

