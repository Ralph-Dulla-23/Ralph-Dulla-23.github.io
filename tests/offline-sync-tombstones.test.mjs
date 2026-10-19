import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('TC-01: syncLocalToCloud must propagate pending tombstones from getDeletedIdsSet to Firestore', () => {
    const dbPath = path.join(rootDir, 'src', 'lib', 'db.js');
    const content = fs.readFileSync(dbPath, 'utf8');

    // Find syncLocalToCloud function body
    const match = content.match(/export\s+async\s+function\s+syncLocalToCloud\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(match, 'syncLocalToCloud function must exist in db.js');

    const fnBody = match[1];

    // Must read deletedIds
    assert.match(
        fnBody,
        /getDeletedIdsSet\(\)/,
        'syncLocalToCloud must read getDeletedIdsSet() to discover pending offline deletions'
    );

    // Must issue deleteDoc for pending deletions
    assert.match(
        fnBody,
        /deleteDoc\s*\(/,
        'syncLocalToCloud must call deleteDoc() to propagate pending deletions to Firestore'
    );
});

test('TC-02: pullBooksFromCloud and pullGamesFromCloud must not resurrect items with active tombstones', () => {
    const dbPath = path.join(rootDir, 'src', 'lib', 'db.js');
    const content = fs.readFileSync(dbPath, 'utf8');

    // Check pullBooksFromCloud
    const booksMatch = content.match(/export\s+async\s+function\s+pullBooksFromCloud\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(booksMatch, 'pullBooksFromCloud function must exist in db.js');
    const booksFn = booksMatch[1];

    assert.match(
        booksFn,
        /getDeletedIdsSet\(\)/,
        'pullBooksFromCloud must read getDeletedIdsSet() to prevent resurrecting deleted books'
    );
    assert.match(
        booksFn,
        /deletedIds\.has\s*\(id\)/,
        'pullBooksFromCloud must check if document ID is in deletedIds before restoring to local mirror'
    );

    // Check pullGamesFromCloud
    const gamesMatch = content.match(/export\s+async\s+function\s+pullGamesFromCloud\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(gamesMatch, 'pullGamesFromCloud function must exist in db.js');
    const gamesFn = gamesMatch[1];

    assert.match(
        gamesFn,
        /getDeletedIdsSet\(\)/,
        'pullGamesFromCloud must read getDeletedIdsSet() to prevent resurrecting deleted games'
    );
    assert.match(
        gamesFn,
        /deletedIds\.has\s*\(id\)/,
        'pullGamesFromCloud must check if document ID is in deletedIds before restoring to local mirror'
    );
});

test('TC-03: saveBook and saveGame explicitly unmark tombstones on user save', () => {
    const dbPath = path.join(rootDir, 'src', 'lib', 'db.js');
    const content = fs.readFileSync(dbPath, 'utf8');

    const saveBookMatch = content.match(/export\s+async\s+function\s+saveBook\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(saveBookMatch, 'saveBook must exist');
    assert.match(saveBookMatch[1], /unmarkDeletedId\s*\(/, 'saveBook must call unmarkDeletedId');

    const saveGameMatch = content.match(/export\s+async\s+function\s+saveGame\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(saveGameMatch, 'saveGame must exist');
    assert.match(saveGameMatch[1], /unmarkDeletedId\s*\(/, 'saveGame must call unmarkDeletedId');
});

test('TC-04: firebase.js initializes persistentLocalCache with persistentMultipleTabManager', () => {
    const fbPath = path.join(rootDir, 'src', 'lib', 'firebase.js');
    const content = fs.readFileSync(fbPath, 'utf8');

    assert.match(content, /persistentLocalCache\s*\(/, 'firebase.js must use persistentLocalCache');
    assert.match(content, /persistentMultipleTabManager\s*\(/, 'firebase.js must configure persistentMultipleTabManager');
    assert.match(content, /getFirestore\s*\(/, 'firebase.js must have defensive fallback to getFirestore');
});
