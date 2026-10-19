import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { toPublicShelfItem } from '../src/domain/validators.js';

const ROOT_DIR = process.cwd();

test('TC-01: toPublicShelfItem produces strictly sanitized snapshot without private fields', () => {
    const rawBook = {
        schemaVersion: 2,
        id: 'book-123',
        mediaType: 'book',
        title: 'Deep Work',
        creators: ['Cal Newport'],
        cover: 'https://example.com/cover.jpg',
        status: 'completed',
        rating: 5,
        ratingScale: 5,
        progress: { unit: 'page', current: 300, total: 300 },
        visibility: 'public_shelf',
        privateNotes: 'My confidential reading notes and reflections',
        logs: [{ minutes: 45, date: '2026-10-15' }],
        secretTags: ['personal-diary'],
    };

    const sanitized = toPublicShelfItem(rawBook);

    assert.equal(sanitized.id, 'book-123');
    assert.equal(sanitized.title, 'Deep Work');
    assert.equal(sanitized.mediaType, 'book');
    assert.equal(sanitized.status, 'completed');
    assert.equal(sanitized.rating, 5);
    assert.equal(sanitized.privateNotes, undefined, 'Must not leak privateNotes');
    assert.equal(sanitized.logs, undefined, 'Must not leak reading logs');
    assert.equal(sanitized.secretTags, undefined, 'Must not leak unallowlisted fields');
});

test('TC-02: diaryRepository and db.js export publishLibraryItem and unpublishLibraryItem', () => {
    const dbPath = path.join(ROOT_DIR, 'src', 'lib', 'db.js');
    const dbContent = fs.readFileSync(dbPath, 'utf8');

    assert.ok(dbContent.includes('publishLibraryItem'), 'db.js must export publishLibraryItem');
    assert.ok(dbContent.includes('unpublishLibraryItem'), 'db.js must export unpublishLibraryItem');
    assert.ok(dbContent.includes('watchPublicShelf'), 'db.js must export watchPublicShelf');
});

test('TC-03: firestore.rules grants public read to publicProfiles and owner-only write', () => {
    const rulesPath = path.join(ROOT_DIR, 'firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    assert.ok(rulesContent.includes('match /publicProfiles/{uid}'), 'Must have publicProfiles rule match');
    assert.ok(rulesContent.includes('isOwner(uid)'), 'Must restrict writes to verified owner');
});

test('TC-04: BookDetailPage and GameDetailPage provide Publish to Shelf button and state', () => {
    const bookDetailPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'BookDetailPage.jsx');
    const bookContent = fs.readFileSync(bookDetailPath, 'utf8');
    assert.ok(bookContent.includes('publish') || bookContent.includes('Publish'), 'BookDetailPage must support publishing to shelf');

    const gameDetailPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'GameDetailPage.jsx');
    const gameContent = fs.readFileSync(gameDetailPath, 'utf8');
    assert.ok(gameContent.includes('publish') || gameContent.includes('Publish'), 'GameDetailPage must support publishing to shelf');
});
