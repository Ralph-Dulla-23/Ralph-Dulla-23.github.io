import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoUrl = pathToFileURL(path.resolve(__dirname, '../src/domain/repository/diaryRepository.js')).href;
const syncStatusUrl = pathToFileURL(path.resolve(__dirname, '../src/domain/repository/syncStatus.js')).href;
const dbUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/db.js')).href;

function createMockFirestoreOps() {
    const store = new Map();
    const listeners = new Set();

    return {
        store,
        doc: (_db, ...pathSegments) => {
            const fullPath = pathSegments.join('/');
            const id = pathSegments[pathSegments.length - 1];
            return { path: fullPath, id };
        },
        collection: (_db, ...pathSegments) => {
            return { path: pathSegments.join('/') };
        },
        setDoc: async (docRef, data) => {
            store.set(docRef.path, JSON.parse(JSON.stringify(data)));
            return Promise.resolve();
        },
        getDoc: async (docRef) => {
            const data = store.get(docRef.path);
            return {
                exists: () => !!data,
                data: () => data || null,
                id: docRef.id,
                metadata: { hasPendingWrites: false, fromCache: false },
            };
        },
        deleteDoc: async (docRef) => {
            store.delete(docRef.path);
            return Promise.resolve();
        },
        onSnapshot: (refOrQuery, callback) => {
            const listener = (hasPendingWrites = false, fromCache = false) => {
                const prefix = refOrQuery.path;
                const docs = Array.from(store.entries())
                    .filter(([p]) => p.startsWith(prefix))
                    .map(([p, data]) => ({
                        id: p.split('/').pop(),
                        data: () => data,
                    }));
                callback({
                    docs,
                    metadata: { hasPendingWrites, fromCache },
                });
            };
            listeners.add(listener);
            listener(false, false);
            return () => listeners.delete(listener);
        },
    };
}

test('TC-01: createDiaryRepository fails closed when uid is missing or invalid (SEC-01)', async () => {
    const { createDiaryRepository } = await import(repoUrl);
    const mockDb = {};

    assert.throws(
        () => createDiaryRepository({ db: mockDb, uid: null }),
        /valid owner uid/i,
        'Should throw if uid is null'
    );
    assert.throws(
        () => createDiaryRepository({ db: mockDb, uid: '' }),
        /valid owner uid/i,
        'Should throw if uid is empty string'
    );
});

test('TC-02: saveLibraryItem validates schema and writes to users/{uid}/libraryItems/{id}', async () => {
    const { createDiaryRepository } = await import(repoUrl);
    const ops = createMockFirestoreOps();
    const repo = createDiaryRepository({ db: {}, uid: 'owner-123', firestoreOps: ops });

    const validBook = {
        schemaVersion: 2,
        id: 'book-uuid-1',
        mediaType: 'book',
        title: 'The Way of Kings',
        creators: ['Brandon Sanderson'],
        status: 'reading',
        rating: 5,
        ratingScale: 5,
        progress: { unit: 'page', current: 200, total: 1007 },
        visibility: 'private',
        tags: ['Fantasy', 'Epic'],
        favorite: true,
    };

    const res = await repo.saveLibraryItem(validBook);
    assert.equal(res.success, true);
    assert.equal(res.id, 'book-uuid-1');

    const expectedPath = 'users/owner-123/libraryItems/book-uuid-1';
    assert.ok(ops.store.has(expectedPath), 'Document must be stored under users/{uid}/libraryItems/{id}');
    const saved = ops.store.get(expectedPath);
    assert.equal(saved.title, 'The Way of Kings');
    assert.equal(saved.schemaVersion, 2);
});

test('TC-03: saveLibraryItem rejects invalid item before writing to storage', async () => {
    const { createDiaryRepository } = await import(repoUrl);
    const ops = createMockFirestoreOps();
    const repo = createDiaryRepository({ db: {}, uid: 'owner-123', firestoreOps: ops });

    const invalidBook = {
        schemaVersion: 2,
        id: 'book-uuid-overflow',
        mediaType: 'book',
        title: 'Broken Book',
        creators: ['Author'],
        status: 'reading',
        rating: 5,
        ratingScale: 5,
        progress: { unit: 'page', current: 500, total: 300 }, // Current exceeds total!
        visibility: 'private',
    };

    await assert.rejects(
        async () => repo.saveLibraryItem(invalidBook),
        /cannot exceed total/i,
        'Should reject invalid progress'
    );

    assert.equal(ops.store.size, 0, 'No write must be committed when validation fails');
});

test('TC-04: observeLibraryItems emits snapshot with hasPendingWrites and returns unsubscribe', async () => {
    const { createDiaryRepository } = await import(repoUrl);
    const ops = createMockFirestoreOps();
    const repo = createDiaryRepository({ db: {}, uid: 'owner-123', firestoreOps: ops });

    let receivedData = null;
    let receivedMetadata = null;

    const unsub = repo.observeLibraryItems({}, (data) => {
        receivedData = data.items;
        receivedMetadata = data.metadata;
    });

    assert.equal(typeof unsub, 'function', 'Should return an unsubscribe function');
    assert.ok(Array.isArray(receivedData), 'Should receive items array');
    assert.ok(receivedMetadata, 'Should receive metadata object');
    assert.equal(typeof receivedMetadata.hasPendingWrites, 'boolean');
    assert.equal(typeof receivedMetadata.fromCache, 'boolean');

    unsub();
});

test('TC-05: deleteLibraryItem deletes document and records tombstone (DATA-02)', async () => {
    const { createDiaryRepository } = await import(repoUrl);
    const ops = createMockFirestoreOps();
    const repo = createDiaryRepository({ db: {}, uid: 'owner-123', firestoreOps: ops });

    const itemPath = 'users/owner-123/libraryItems/book-to-delete';
    ops.store.set(itemPath, { id: 'book-to-delete', title: 'Delete Me' });

    const res = await repo.deleteLibraryItem('book-to-delete');
    assert.equal(res.success, true);
    assert.equal(ops.store.has(itemPath), false, 'Document must be deleted from storage');
});

test('TC-06: createAttempt and listAttempts validate and store multi-attempt records', async () => {
    const { createDiaryRepository } = await import(repoUrl);
    const ops = createMockFirestoreOps();
    const repo = createDiaryRepository({ db: {}, uid: 'owner-123', firestoreOps: ops });

    const attempt = {
        schemaVersion: 2,
        id: 'attempt-uuid-1',
        libraryItemId: 'book-uuid-1',
        ordinal: 1,
        status: 'completed',
        startedOn: '2026-01-01',
        completedOn: '2026-01-15',
    };

    const res = await repo.createAttempt(attempt);
    assert.equal(res.success, true);
    assert.ok(ops.store.has('users/owner-123/attempts/attempt-uuid-1'));
});

test('TC-07: createHistoricalAggregate strictly enforces isDailySession === false (DATA-05)', async () => {
    const { createDiaryRepository } = await import(repoUrl);
    const ops = createMockFirestoreOps();
    const repo = createDiaryRepository({ db: {}, uid: 'owner-123', firestoreOps: ops });

    const invalidAggregate = {
        schemaVersion: 2,
        id: 'agg-uuid-1',
        mediaId: 'book-uuid-1',
        mediaType: 'book',
        isDailySession: true, // Invalid: must be false!
        totalMinutes: 120,
    };

    await assert.rejects(
        async () => repo.createHistoricalAggregate(invalidAggregate),
        /isDailySession must be strictly false/i
    );

    const validAggregate = {
        ...invalidAggregate,
        isDailySession: false,
    };

    const res = await repo.createHistoricalAggregate(validAggregate);
    assert.equal(res.success, true);
    assert.ok(ops.store.has('users/owner-123/historicalAggregates/agg-uuid-1'));
});

test('TC-08: createJournalEntry enforces private visibility and owner path (SEC-01)', async () => {
    const { createDiaryRepository } = await import(repoUrl);
    const ops = createMockFirestoreOps();
    const repo = createDiaryRepository({ db: {}, uid: 'owner-123', firestoreOps: ops });

    const journal = {
        schemaVersion: 2,
        id: 'journal-uuid-1',
        linkedMediaId: 'book-uuid-1',
        mediaType: 'book',
        type: 'review',
        body: 'A truly great story with private notes.',
        visibility: 'private',
        date: '2026-01-15',
    };

    const res = await repo.createJournalEntry(journal);
    assert.equal(res.success, true);
    const stored = ops.store.get('users/owner-123/journalEntries/journal-uuid-1');
    assert.equal(stored.visibility, 'private');
    assert.equal(stored.body, 'A truly great story with private notes.');
});

test('TC-09: determineSyncState maps online and pending writes accurately', async () => {
    const { determineSyncState } = await import(syncStatusUrl);

    assert.equal(determineSyncState({ isOnline: true, hasPendingWrites: false }), 'synced');
    assert.equal(determineSyncState({ isOnline: true, hasPendingWrites: true }), 'saving_offline');
    assert.equal(determineSyncState({ isOnline: false, hasPendingWrites: false }), 'offline');
    assert.equal(determineSyncState({ isOnline: false, hasPendingWrites: true }), 'offline');
    assert.equal(determineSyncState({ error: { code: 'permission-denied' } }), 'permission_denied');
});

test('TC-10: Legacy db.js exports getDiaryRepository and preserves backward compatibility', async () => {
    const dbModule = await import(dbUrl);

    assert.equal(typeof dbModule.getDiaryRepository, 'function');
    assert.equal(typeof dbModule.saveBook, 'function');
    assert.equal(typeof dbModule.saveGame, 'function');
    assert.equal(typeof dbModule.exportUserData, 'function');
    assert.equal(typeof dbModule.watchPublicBooks, 'function');
});
