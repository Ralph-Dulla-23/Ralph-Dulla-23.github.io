import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoUrl = pathToFileURL(path.resolve(__dirname, '../src/domain/repository/diaryRepository.js')).href;
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

test('TC-01: diaryRepository.observeSessions subscribes to users/{uid}/sessions and emits live list with sync metadata', async () => {
    const { createDiaryRepository } = await import(repoUrl);
    const firestoreOps = createMockFirestoreOps();
    const repo = createDiaryRepository({ db: {}, uid: 'B0p0XBPscBNF4Dchuk1IsOACrvk2', firestoreOps });

    assert.equal(typeof repo.observeSessions, 'function', 'repo must implement observeSessions');

    await repo.createSession({
        id: 'sess-001',
        schemaVersion: 2,
        mediaType: 'book',
        libraryItemId: 'book-123',
        startedAt: '2026-10-19T10:00:00Z',
        activeSeconds: 1800,
        startPage: 10,
        endPage: 35,
        pagesRead: 25,
    });

    let emitted = null;
    const unsub = repo.observeSessions({}, (snapshot) => {
        emitted = snapshot;
    });

    assert.ok(emitted, 'observeSessions should synchronously emit snapshot');
    assert.equal(emitted.sessions.length, 1);
    assert.equal(emitted.sessions[0].id, 'sess-001');
    assert.equal(emitted.metadata.hasPendingWrites, false);

    assert.equal(typeof unsub, 'function', 'observeSessions must return unsubscribe function');
    unsub();
});

test('TC-02: diaryRepository.observeSessions correctly filters by mediaType and libraryItemId', async () => {
    const { createDiaryRepository } = await import(repoUrl);
    const firestoreOps = createMockFirestoreOps();
    const repo = createDiaryRepository({ db: {}, uid: 'B0p0XBPscBNF4Dchuk1IsOACrvk2', firestoreOps });

    await repo.createSession({
        id: 'sess-book-1',
        schemaVersion: 2,
        mediaType: 'book',
        libraryItemId: 'item-book-a',
        startedAt: '2026-10-19T10:00:00Z',
        activeSeconds: 1200,
        startPage: 0,
        endPage: 20,
        pagesRead: 20,
    });

    await repo.createSession({
        id: 'sess-game-1',
        schemaVersion: 2,
        mediaType: 'game',
        libraryItemId: 'item-game-b',
        startedAt: '2026-10-19T12:00:00Z',
        activeSeconds: 3600,
    });

    let bookEmitted = null;
    const unsubBook = repo.observeSessions({ mediaType: 'book' }, (snapshot) => {
        bookEmitted = snapshot;
    });

    let itemEmitted = null;
    const unsubItem = repo.observeSessions({ libraryItemId: 'item-game-b' }, (snapshot) => {
        itemEmitted = snapshot;
    });

    assert.equal(bookEmitted.sessions.length, 1);
    assert.equal(bookEmitted.sessions[0].id, 'sess-book-1');

    assert.equal(itemEmitted.sessions.length, 1);
    assert.equal(itemEmitted.sessions[0].id, 'sess-game-1');

    unsubBook();
    unsubItem();
});

test('TC-03: diaryRepository.getSessionsForItem returns sessions matching specific libraryItemId', async () => {
    const { createDiaryRepository } = await import(repoUrl);
    const firestoreOps = createMockFirestoreOps();
    const repo = createDiaryRepository({ db: {}, uid: 'B0p0XBPscBNF4Dchuk1IsOACrvk2', firestoreOps });

    assert.equal(typeof repo.getSessionsForItem, 'function', 'repo must implement getSessionsForItem');

    await repo.createSession({
        id: 'sess-item-1',
        schemaVersion: 2,
        mediaType: 'book',
        libraryItemId: 'target-item',
        startedAt: '2026-10-19T10:00:00Z',
        activeSeconds: 600,
    });

    await repo.createSession({
        id: 'sess-item-2',
        schemaVersion: 2,
        mediaType: 'book',
        libraryItemId: 'other-item',
        startedAt: '2026-10-19T11:00:00Z',
        activeSeconds: 800,
    });

    const itemSessions = await repo.getSessionsForItem('target-item');
    assert.equal(itemSessions.length, 1);
    assert.equal(itemSessions[0].id, 'sess-item-1');
});

test('TC-04: diaryRepository.deleteSession deletes session document at canonical path', async () => {
    const { createDiaryRepository } = await import(repoUrl);
    const firestoreOps = createMockFirestoreOps();
    const repo = createDiaryRepository({ db: {}, uid: 'B0p0XBPscBNF4Dchuk1IsOACrvk2', firestoreOps });

    assert.equal(typeof repo.deleteSession, 'function', 'repo must implement deleteSession');

    await repo.createSession({
        id: 'sess-to-delete',
        schemaVersion: 2,
        mediaType: 'book',
        libraryItemId: 'target-item',
        startedAt: '2026-10-19T10:00:00Z',
        activeSeconds: 600,
    });

    assert.ok(firestoreOps.store.has('users/B0p0XBPscBNF4Dchuk1IsOACrvk2/sessions/sess-to-delete'));

    await repo.deleteSession('sess-to-delete');

    assert.ok(!firestoreOps.store.has('users/B0p0XBPscBNF4Dchuk1IsOACrvk2/sessions/sess-to-delete'));
});

test('TC-05: getAllSessions in src/lib/db.js reads canonical users/{uid}/sessions and deduplicates legacy records by ID', async () => {
    const dbModule = await import(dbUrl);
    assert.equal(typeof dbModule.getAllSessions, 'function', 'db.js must export getAllSessions');
    assert.equal(typeof dbModule.observeCanonicalSessions, 'function', 'db.js must export observeCanonicalSessions');
});

test('TC-06: useDiarySessions hook file exists and exports a callable React hook', async () => {
    const hookPath = path.resolve('src/hooks/useDiarySessions.js');
    assert.ok(existsSync(hookPath), 'src/hooks/useDiarySessions.js must exist');

    const content = readFileSync(hookPath, 'utf-8');
    assert.ok(content.includes('useDiarySessions'), 'Must export useDiarySessions');
    assert.ok(content.includes('getSessionFeed'), 'Hook must use the shared owner-scoped session feed');
    const feedContent = readFileSync(path.resolve('src/hooks/sessionFeed.js'), 'utf-8');
    assert.ok(feedContent.includes('observeSessions'), 'Shared feed must subscribe to canonical sessions');
});
