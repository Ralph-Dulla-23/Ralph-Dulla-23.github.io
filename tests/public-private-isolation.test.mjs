import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('TC-01: publicShelfService exists and reads only from publicProfiles', async () => {
    const servicePath = resolve('src/services/publicShelfService.js');
    assert.ok(existsSync(servicePath), 'src/services/publicShelfService.js must exist');

    const content = readFileSync(servicePath, 'utf-8');
    assert.ok(content.includes('export function observePublicShelf'), 'Must export observePublicShelf');
    assert.ok(content.includes('export function observePublicHighlights'), 'Must export observePublicHighlights');
    assert.ok(content.includes("'publicProfiles'"), 'Must query publicProfiles collection');
    assert.ok(!content.includes("'users', safeOwnerUid, 'books'"), 'Must NOT query users/{uid}/books');
    assert.ok(!content.includes("'users', safeOwnerUid, 'games'"), 'Must NOT query users/{uid}/games');
});

test('TC-02: LibraryPage.jsx uses observePublicShelf exclusively', async () => {
    const pagePath = resolve('src/pages/LibraryPage.jsx');
    const content = readFileSync(pagePath, 'utf-8');

    assert.ok(content.includes('observePublicShelf'), 'LibraryPage must import and use observePublicShelf');
    assert.ok(!content.includes('watchPublicBooks'), 'LibraryPage must NOT use watchPublicBooks');
    assert.ok(!content.includes('watchPublicGames'), 'LibraryPage must NOT use watchPublicGames');
});

test('TC-03: Library.jsx portfolio preview uses observePublicShelf exclusively', async () => {
    const compPath = resolve('src/components/Library.jsx');
    const content = readFileSync(compPath, 'utf-8');

    assert.ok(content.includes('observePublicShelf'), 'Library.jsx must import and use observePublicShelf');
    assert.ok(!content.includes('watchPublicBooks'), 'Library.jsx must NOT use watchPublicBooks');
});

test('TC-04: firestore.rules authorizes v2 sessions and tightens private collections', async () => {
    const rulesPath = resolve('firestore.rules');
    const content = readFileSync(rulesPath, 'utf-8').replace(/\r\n/g, '\n');

    // SEC-02: Explicit v2 sessions rule
    assert.ok(
        content.includes('match /sessions/{sessionId}') || content.includes('match /sessions/{sid}'),
        'firestore.rules must explicitly authorize /users/{uid}/sessions/{sessionId}'
    );

    // SEC-02: Specific shelf and highlights subcollections
    assert.ok(content.includes('match /shelf/{itemId}'), 'Must match publicProfiles/{uid}/shelf/{itemId}');
    assert.ok(content.includes('match /highlights/{highlightId}'), 'Must match publicProfiles/{uid}/highlights/{highlightId}');
    assert.ok(!content.includes('match /{subcollection}/{docId}'), 'Must eliminate broad publicProfiles wildcard');

    // SEC-01: Books and games collections must be owner-only
    assert.ok(
        content.includes('match /books/{id} {\n        allow read, write: if isOwner(uid);') ||
        content.includes('match /books/{id} {\n        allow read: if isOwner(uid);'),
        'Users books collection must restrict read to owner only'
    );
    assert.ok(
        content.includes('match /games/{id} {\n        allow read, write: if isOwner(uid);') ||
        content.includes('match /games/{id} {\n        allow read: if isOwner(uid);'),
        'Users games collection must restrict read to owner only'
    );
});

test('TC-05: toPublicShelfItem preserves allowlisted public metadata without leakage', async () => {
    const { toPublicShelfItem } = await import('../src/domain/publicProjection.js');

    const sampleItem = {
        schemaVersion: 2,
        id: 'game-456',
        mediaType: 'game',
        title: 'Hollow Knight',
        genres: ['Metroidvania', 'Action'],
        platform: 'PC',
        platforms: ['PC', 'Nintendo Switch'],
        hoursPlayed: 65,
        rating: 10,
        ratingScale: 10,
        status: 'completed',
        privateNotes: 'Very secret gaming diary notes',
        logs: [{ date: '2026-05-01', text: 'Beat Radiance' }],
    };

    const projected = toPublicShelfItem(sampleItem);
    assert.equal(projected.id, 'game-456');
    assert.equal(projected.title, 'Hollow Knight');
    assert.equal(projected.mediaType, 'game');
    assert.deepEqual(projected.genres, ['Metroidvania', 'Action']);
    assert.equal(projected.platform, 'PC');
    assert.equal(projected.hoursPlayed, 65);
    assert.equal(projected.rating, 10);
    assert.equal(projected.privateNotes, undefined, 'privateNotes must be stripped');
    assert.equal(projected.logs, undefined, 'logs must be stripped');
});
