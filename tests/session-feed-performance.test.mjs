import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionFeed } from '../src/hooks/sessionFeed.js';

test('shared session feed multiplexes subscribers and reuses a warm listener', async () => {
  let opens = 0;
  let closes = 0;
  let push;
  const feed = createSessionFeed('owner-test', (_uid, onNext) => {
    opens++;
    push = onNext;
    return () => { closes++; };
  }, 20);
  const a = [];
  const b = [];
  const offA = feed.subscribe(() => a.push(feed.snapshot().sessions.length));
  const offB = feed.subscribe(() => b.push(feed.snapshot().sessions.length));
  assert.equal(opens, 1, 'only one Firestore listener for both subscribers');
  push({ sessions: [{ id: 'one' }], metadata: { hasPendingWrites: true, fromCache: true } });
  assert.deepEqual(a, [1]);
  assert.deepEqual(b, [1]);
  assert.equal(feed.snapshot().metadata.hasPendingWrites, true);
  offA();
  offB();
  const offC = feed.subscribe(() => {});
  assert.equal(opens, 1, 'remount within warm period must not re-open listener');
  offC();
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(closes, 1, 'listener should close after an idle window');
  feed.clear();
});

test('clearing private feed erases its in-memory snapshot', () => {
  const feed = createSessionFeed('owner-test', (_uid, onNext) => {
    onNext({ sessions: [{ id: 'private-note' }] });
    return () => {};
  });
  const stop = feed.subscribe(() => {});
  assert.equal(feed.snapshot().sessions.length, 1);
  feed.clear();
  assert.equal(feed.snapshot().sessions.length, 0);
  stop();
});
