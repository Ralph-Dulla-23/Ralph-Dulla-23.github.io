import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { OWNER_UID } from './config.js';
import { reportFirestoreError } from './permissionDiagnostics.js';
import fallbackBooks from '../data/books.js';
import { createDiaryRepository } from '../domain/repository/diaryRepository.js';
import { toPublicShelfItem, toPublicHighlight } from '../domain/publicProjection.js';
import { queuePublishedItemRefresh, flushPublishedItemRefreshes } from '../services/publishedItemSync.js';

export { createDiaryRepository };

/**
 * Returns a canonical v2 DiaryRepository bound to the verified owner UID.
 */
export function getDiaryRepository(uid) {
    if (!db) throw new Error('Firebase is not configured; cannot access cloud diary records.');
    return createDiaryRepository({ db, uid });
}

/* =========================================================================
   ID SANITIZATION & LOCAL STORAGE MIRROR
   ========================================================================= */

const LS_GAMES_KEY = 'diary_local_games_v1';
const LS_BOOKS_KEY = 'diary_local_books_v1';
const LS_SESSIONS_KEY = 'diary_local_sessions_v1';
const LS_GAME_NOTES_KEY = 'diary_local_game_notes_v1';
const LS_BOOK_NOTES_KEY = 'diary_local_book_notes_v1';
const LS_JOURNAL_KEY = 'diary_local_journal_v1';
const LS_PUBLIC_SHELF_KEY = 'diary_public_shelf_v1';
const LS_PUBLIC_HIGHLIGHTS_KEY = 'diary_public_highlights_v1';
const LS_DELETED_IDS_KEY = 'diary_deleted_ids_v1';

const gameSubscribers = new Set();
const bookSubscribers = new Set();
const journalSubscribers = new Set();
const publicShelfSubscribers = new Set();
const publicHighlightsSubscribers = new Set();
// Reuse owner-only snapshots between diary routes; listener churn otherwise
// causes repeated book/game downloads and card-loading flashes.
const privateMediaFeeds = { book: new Map(), game: new Map() };
const PRIVATE_FEED_IDLE_MS = 12_000;

function subscribePrivateMedia(kind, ownerUid, onUpdate) {
    const safeUid = sanitizeId(ownerUid || OWNER_UID || 'owner', 'user');
    const pools = privateMediaFeeds[kind];
    const subscriberSet = kind === 'book' ? bookSubscribers : gameSubscribers;
    const build = kind === 'book' ? buildMergedBooks : buildMergedGames;
    let pool = pools.get(safeUid);
    if (!pool) {
        pool = { callbacks: new Set(), cloud: [], unsub: null, idleTimer: null, disposed: false };
        pool.emit = () => {
            if (pool.disposed) return;
            const items = build(pool.cloud);
            pool.callbacks.forEach((callback) => callback(items));
        };
        pool.dispose = () => {
            if (pool.disposed) return;
            pool.disposed = true;
            if (pool.idleTimer) clearTimeout(pool.idleTimer);
            pool.unsub?.();
            subscriberSet.delete(pool.emit);
            pool.callbacks.clear();
            if (pools.get(safeUid) === pool) pools.delete(safeUid);
        };
        pools.set(safeUid, pool);
        subscriberSet.add(pool.emit);
        if (db && ownerUid) {
            pool.unsub = onSnapshot(
                collection(db, 'users', safeUid, kind === 'book' ? 'books' : 'games'),
                (snapshot) => {
                    if (pool.disposed) return;
                    pool.cloud = snapshot.docs.map((record) => ({ id: record.id, ...record.data() }));
                    // Firebase can finish a persisted write after the app has restarted.
                    // On confirmed snapshots, release the local optimistic overlay so
                    // a newer cloud edit from another device can become authoritative.
                    const key = kind === 'book' ? LS_BOOKS_KEY : LS_GAMES_KEY;
                    const local = readJson(key, {});
                    let changed = false;
                    snapshot.docs.forEach((record) => {
                        const id = record.id;
                        const cached = local[id];
                        const cloudTimestamp = record.data()?.updatedAt;
                        const cloudMs = typeof cloudTimestamp?.toMillis === 'function' ? cloudTimestamp.toMillis() : 0;
                        const savedMs = Date.parse(cached?.updatedAtISO || '') || 0;
                        if (cached?._syncPending && !record.metadata.hasPendingWrites && cloudMs >= savedMs - 2000) {
                            local[id] = { ...cached, _syncPending: false };
                            changed = true;
                        }
                    });
                    if (changed) writeJson(key, local);
                    pool.emit();
                },
                (error) => {
                    reportFirestoreError(error, `private ${kind}s`);
                    console.warn(`Firestore ${kind} listener using local fallback:`, error.message);
                    pool.emit();
                },
            );
        }
    }
    if (pool.idleTimer) { clearTimeout(pool.idleTimer); pool.idleTimer = null; }
    pool.callbacks.add(onUpdate);
    onUpdate(build(pool.cloud));
    return () => {
        if (!pool.callbacks.delete(onUpdate) || pool.disposed) return;
        if (pool.callbacks.size === 0) {
            pool.idleTimer = setTimeout(pool.dispose, PRIVATE_FEED_IDLE_MS);
        }
    };
}

function markLocalCloudAcknowledged(storageKey, id, onNotify) {
    const map = readJson(storageKey, {});
    if (!map[id]) return;
    map[id] = { ...map[id], _syncPending: false };
    writeJson(storageKey, map);
    onNotify();
}

export function clearPrivateMediaSubscriptions() {
    for (const pools of Object.values(privateMediaFeeds)) {
        for (const pool of pools.values()) pool.dispose();
        pools.clear();
    }
}


function notifyGameSubscribers() {
    gameSubscribers.forEach((cb) => {
        try {
            cb();
        } catch (err) {
            console.error('Error in game subscriber:', err);
        }
    });
}

function notifyBookSubscribers() {
    bookSubscribers.forEach((cb) => {
        try {
            cb();
        } catch (err) {
            console.error('Error in book subscriber:', err);
        }
    });
}

function notifyJournalSubscribers() {
    journalSubscribers.forEach((cb) => {
        try {
            cb();
        } catch (err) {
            console.error('Error in journal subscriber:', err);
        }
    });
}

function notifyPublicShelfSubscribers() {
    publicShelfSubscribers.forEach((cb) => {
        try {
            cb();
        } catch (err) {
            console.error('Error in public shelf subscriber:', err);
        }
    });
}

function notifyPublicHighlightsSubscribers() {
    publicHighlightsSubscribers.forEach((cb) => {
        try {
            cb();
        } catch (err) {
            console.error('Error in public highlights subscriber:', err);
        }
    });
}

/**
 * Converts any raw ID into a safe, non-empty Firestore document ID string.
 * Prevents doc() / collection() from throwing on undefined/null/slashes.
 */
export function sanitizeId(rawId, fallbackPrefix = 'item') {
    const str = String(rawId || `${fallbackPrefix}_${Date.now()}`)
        .trim()
        .replace(/[/\\]+/g, '_');
    return str && str !== 'undefined' && str !== 'null'
        ? str
        : `${fallbackPrefix}_${Date.now()}`;
}

const memoryStorage = new Map();

function readJson(key, fallback) {
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed ?? fallback;
        }
        return memoryStorage.has(key) ? memoryStorage.get(key) : fallback;
    } catch {
        return memoryStorage.has(key) ? memoryStorage.get(key) : fallback;
    }
}

function writeJson(key, value) {
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(value));
            return;
        }
        memoryStorage.set(key, value);
    } catch {
        memoryStorage.set(key, value);
    }
}

export function getDeletedIdsSet() {
    const arr = readJson(LS_DELETED_IDS_KEY, []);
    return new Set(Array.isArray(arr) ? arr : []);
}

function markDeletedId(id) {
    const set = getDeletedIdsSet();
    set.add(String(id));
    writeJson(LS_DELETED_IDS_KEY, Array.from(set));
}

function unmarkDeletedId(id) {
    const set = getDeletedIdsSet();
    if (set.has(String(id))) {
        set.delete(String(id));
        writeJson(LS_DELETED_IDS_KEY, Array.from(set));
    }
}

function buildMergedGames(cloudGames = []) {
    const deletedIds = getDeletedIdsSet();
    const localGamesMap = readJson(LS_GAMES_KEY, {});
    const mergedMap = new Map();

    cloudGames.forEach((g) => {
        if (!g) return;
        const id = sanitizeId(g.id || g.rawgId, 'game');
        if (!deletedIds.has(id)) {
            mergedMap.set(id, { ...g, id });
        }
    });

    Object.entries(localGamesMap).forEach(([key, g]) => {
        if (!g) return;
        const id = sanitizeId(g.id || key, 'game');
        if (!deletedIds.has(id)) {
            const fromCloud = mergedMap.get(id);
            mergedMap.set(id, fromCloud && !g._syncPending
                ? { ...g, ...fromCloud, id }
                : { ...fromCloud, ...g, id });
        }
    });

    const list = Array.from(mergedMap.values());
    list.sort((a, b) => {
        const dateA = a.finishedOn || a.updatedAtISO || '';
        const dateB = b.finishedOn || b.updatedAtISO || '';
        return String(dateB).localeCompare(String(dateA));
    });
    return list;
}

function buildMergedBooks(cloudBooks = []) {
    const deletedIds = getDeletedIdsSet();
    const localBooksMap = readJson(LS_BOOKS_KEY, {});
    const mergedMap = new Map();

    // Always seed base with fallbackBooks so complete library is present and overlay with cloud updates
    fallbackBooks.forEach((b, idx) => {
        const id = sanitizeId(b.id || b.coverId || `book-${idx}`, 'book');
        if (!deletedIds.has(id)) {
            const pages = Number(b.pages) > 0 ? Number(b.pages) : null;
            const progress = Number(b.progress) || 0;
            const currentPage =
                b.currentPage !== undefined
                    ? Number(b.currentPage)
                    : progress === 100
                    ? (pages ?? 0)
                    : pages === null ? 0 : Math.round((progress / 100) * pages);
            mergedMap.set(id, {
                ...b,
                id,
                pages,
                currentPage,
                progress,
            });
        }
    });

    cloudBooks.forEach((b) => {
        if (!b) return;
        const id = sanitizeId(b.id || b.coverId, 'book');
        if (!deletedIds.has(id)) {
            mergedMap.set(id, { ...mergedMap.get(id), ...b, id });
        }
    });

    Object.entries(localBooksMap).forEach(([key, b]) => {
        if (!b) return;
        const id = sanitizeId(b.id || key, 'book');
        if (!deletedIds.has(id)) {
            const fromCloud = mergedMap.get(id);
            mergedMap.set(id, fromCloud && !b._syncPending
                ? { ...b, ...fromCloud, id }
                : { ...fromCloud, ...b, id });
        }
    });

    const list = Array.from(mergedMap.values()).map(
        ({ privateNotes: _pn, logs: _logs, ...publicBook }) => publicBook // eslint-disable-line no-unused-vars
    );
    list.sort((a, b) => {
        if (a.status === 'reading' && b.status !== 'reading') return -1;
        if (b.status === 'reading' && a.status !== 'reading') return 1;
        const timeA = a.updatedAtISO || '';
        const timeB = b.updatedAtISO || '';
        if (timeA !== timeB) return String(timeB).localeCompare(String(timeA));
        return (b._originalIndex ?? 0) - (a._originalIndex ?? 0);
    });
    return list;
}

function ensureLocalBook(rawBookId) {
    const safeBookId = sanitizeId(rawBookId, 'book');
    const localBooks = readJson(LS_BOOKS_KEY, {});
    if (localBooks[safeBookId]) {
        return { safeBookId, book: localBooks[safeBookId], localBooks };
    }

    const found = fallbackBooks.find(
        (b) =>
            sanitizeId(b.id || b.coverId || b.title, 'book') === safeBookId ||
            String(b.coverId) === safeBookId
    );

    if (found) {
        const totalPages = Number(found.pages) > 0 ? Number(found.pages) : null;
        const progress = Number(found.progress) || 0;
        const currentPage =
            found.currentPage !== undefined
                ? Number(found.currentPage)
                : progress === 100
                ? (totalPages ?? 0)
                : (totalPages === null ? 0 : Math.round((progress / 100) * totalPages));
        const copied = {
            ...found,
            id: safeBookId,
            authors: Array.isArray(found.authors) ? found.authors : found.author ? [found.author] : [],
            author: found.author || (Array.isArray(found.authors) ? found.authors.join(', ') : ''),
            pages: totalPages,
            currentPage,
            progress,
            updatedAtISO: new Date().toISOString(),
        };
        localBooks[safeBookId] = copied;
        return { safeBookId, book: copied, localBooks };
    }

    const stub = {
        id: safeBookId,
        title: 'Untitled Book',
        authors: [],
        author: '',
        pages: null,
        currentPage: 0,
        progress: 0,
        status: 'reading',
        genres: [],
        updatedAtISO: new Date().toISOString(),
    };
    localBooks[safeBookId] = stub;
    return { safeBookId, book: stub, localBooks };
}

/* =========================================================================
   GAMES
   ========================================================================= */

/**
 * Saves or updates a game.
 * Public metadata goes to users/{uid}/games/{gameId} and local storage mirror.
 * Written reviews and private notes go to users/{uid}/games/{gameId}/private/notes.
 *
 * @param {string} uid Owner UID
 * @param {Object} gameData Public game data
 * @param {string} [privateReview=''] Private review text
 * @returns {Promise<string>} Saved game ID
 */
export async function saveGame(uid, gameData, privateReview = '') {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const gameId = sanitizeId(gameData?.id || gameData?.rawgId || Date.now(), 'game');
    const nowIso = new Date().toISOString();

    const baseFields = {
        id: gameId,
        mediaType: 'game',
        rawgId: gameData?.rawgId || null,
        title: gameData?.title || 'Untitled Game',
        cover: gameData?.cover || '',
        coverUrl: gameData?.cover || gameData?.coverUrl || '',
        released: gameData?.released || '',
        genres: Array.isArray(gameData?.genres) ? gameData.genres : [],
        platforms: Array.isArray(gameData?.platforms) ? gameData.platforms : [],
        platform: gameData?.platform || '',
        finishedOn: gameData?.finishedOn || '',
        hoursPlayed: Number(gameData?.hoursPlayed) || 0,
        rating: Number(gameData?.rating) || 0, // 0 - 10 scale
        ratingScale: 10,
        status: gameData?.status || (gameData?.finishedOn ? 'finished' : 'playing'),
    };

    // 1. Save immediately to local storage mirror
    const localGames = readJson(LS_GAMES_KEY, {});
    const existingLocal = localGames[gameId] || {};
    localGames[gameId] = {
        ...existingLocal,
        ...baseFields,
        createdAtISO: existingLocal.createdAtISO || nowIso,
        updatedAtISO: nowIso,
        _syncPending: true,
    };
    writeJson(LS_GAMES_KEY, localGames);

    const localNotes = readJson(LS_GAME_NOTES_KEY, {});
    localNotes[gameId] = privateReview || '';
    writeJson(LS_GAME_NOTES_KEY, localNotes);

    unmarkDeletedId(gameId);
    notifyGameSubscribers();
    // Persist the refresh intent now: Firestore may finish uploading after an app restart.
    queuePublishedItemRefresh(safeUid, 'game', gameId);

    // Public publishing is exclusively opt-in from the media detail screen.
    // Saving a private game must never publish it automatically.
    // 2. Attempt Firestore sync in background-safe try/catch
    if (db) {
        const persist = async () => {
        try {
            const gameRef = doc(db, 'users', safeUid, 'games', gameId);
            const publicDoc = {
                ...baseFields,
                updatedAt: serverTimestamp(),
            };
            if (!gameData?.id) {
                publicDoc.createdAt = serverTimestamp();
            }
            await setDoc(gameRef, publicDoc, { merge: true });

            const privateRef = doc(db, 'users', safeUid, 'games', gameId, 'private', 'notes');
            await setDoc(
                privateRef,
                {
                    review: privateReview || '',
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
            markLocalCloudAcknowledged(LS_GAMES_KEY, gameId, notifyGameSubscribers);
            queuePublishedItemRefresh(safeUid, 'game', gameId);
            void flushPublishedItemRefreshes();
        } catch (err) {
            if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') {
                reportFirestoreError(err, 'saving private diary data');
                throw err;
            }
            console.warn('Firestore sync deferred (saved locally):', err.message);
        }
         };
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            // Firestore persistent cache queues the write. Return to the user
            // immediately rather than waiting indefinitely for server acknowledgement.
            void persist().catch((error) => reportFirestoreError(error, 'syncing offline diary changes'));
        } else {
            await persist();
        }
    }

    // Auto-project to public shelf
    publishLibraryItem(safeUid, { ...baseFields, mediaType: 'game' }).catch(() => {});

    return gameId;
}

/**
 * Deletes a game and its private notes.
 */
export async function deleteGame(uid, gameId) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const safeGameId = sanitizeId(gameId, 'game');

    const localGames = readJson(LS_GAMES_KEY, {});
    delete localGames[safeGameId];
    writeJson(LS_GAMES_KEY, localGames);

    const localNotes = readJson(LS_GAME_NOTES_KEY, {});
    delete localNotes[safeGameId];
    writeJson(LS_GAME_NOTES_KEY, localNotes);

    markDeletedId(safeGameId);
    notifyGameSubscribers();

    // Remove from public shelf mirror and projection
    try {
        await unpublishLibraryItem(safeUid, safeGameId);
    } catch {
        // Safe to ignore
    }

    if (db) {
        try {
            const privateRef = doc(db, 'users', safeUid, 'games', safeGameId, 'private', 'notes');
            await deleteDoc(privateRef).catch(() => {});
            const gameRef = doc(db, 'users', safeUid, 'games', safeGameId);
            await deleteDoc(gameRef);
        } catch (err) {
            console.warn('Firestore game delete deferred (deleted locally):', err.message);
        }
    }
    unpublishLibraryItem(safeUid, safeGameId).catch(() => {});
}

/**
 * Real-time listener for public games of a given owner.
 * Works signed-out or when Firestore rules reject access by merging local mirror.
 */
export function watchPublicGames(ownerUid, onUpdate) {
    return subscribePrivateMedia('game', ownerUid, onUpdate);
}

/**
 * One-time fetch of public games.
 */
export async function getPublicGames(ownerUid) {
    let cloudGames = [];
    if (db && ownerUid) {
        try {
            const safeOwnerUid = sanitizeId(ownerUid, 'user');
            const snap = await getDocs(collection(db, 'users', safeOwnerUid, 'games'));
            cloudGames = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (err) {
            console.warn('Firestore getPublicGames fallback to local mirror:', err.message);
        }
    }
    return buildMergedGames(cloudGames);
}

/**
 * Fetches private notes for a game (Owner only).
 */
export async function getGamePrivateNotes(uid, gameId) {
    if (!gameId) return '';
    const safeGameId = sanitizeId(gameId, 'game');
    const localNotes = readJson(LS_GAME_NOTES_KEY, {});
    const hasLocal = Object.prototype.hasOwnProperty.call(localNotes, safeGameId);

    if (db && uid) {
        try {
            const safeUid = sanitizeId(uid, 'user');
            const snap = await getDoc(doc(db, 'users', safeUid, 'games', safeGameId, 'private', 'notes'));
            if (snap.exists()) {
                const cloudReview = snap.data().review || '';
                return hasLocal ? localNotes[safeGameId] : cloudReview;
            }
        } catch {
            // Fall back to local notes on permission error
        }
    }
    return localNotes[safeGameId] || '';
}


/* =========================================================================
   BOOKS
   ========================================================================= */

/**
 * Saves or updates a book.
 * Public metadata goes to users/{uid}/books/{bookId} and local storage mirror.
 * Private notes go to users/{uid}/books/{bookId}/private/notes.
 */
export async function saveBook(uid, bookData, privateNotes) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const bookId = sanitizeId(bookData?.id || bookData?.coverId || Date.now(), 'book');
    const nowIso = new Date().toISOString();
    const cachedBook = readJson(LS_BOOKS_KEY, {})[bookId] || {};

    const pages = Number(bookData?.pages) > 0 ? Number(bookData.pages) : null;
    const currentPage = Number(bookData?.currentPage) || 0;
    const progress =
        pages > 0
            ? Math.min(100, Math.round((currentPage / pages) * 100))
            : Number(bookData?.progress) || 0;

    const baseFields = {
        id: bookId,
        olKey: bookData?.olKey || '',
        title: bookData?.title || 'Untitled Book',
        authors: Array.isArray(bookData?.authors)
            ? bookData.authors
            : bookData?.author
            ? [bookData.author]
            : [],
        author:
            bookData?.author ||
            (Array.isArray(bookData?.authors) ? bookData.authors.join(', ') : ''),
        coverId: bookData?.coverId || null,
        cover: bookData?.cover || '',
        pages,
        currentPage,
        progress,
        status: bookData?.status || 'want-to-read', // 'want-to-read' | 'reading' | 'completed' | 'dropped'
        rating: Number(bookData?.rating) || null,
        favorite: Boolean(bookData?.favorite),
        genres: Array.isArray(bookData?.genres) ? bookData.genres : [],
        startedOn: bookData?.startedOn || '',
        finishedOn: bookData?.finishedOn || '',
        // Bookmory metadata remains in the owner-only collection, never in public shelf projections.
        isbn: bookData?.isbn ?? cachedBook?.isbn ?? null,
        publisher: bookData?.publisher ?? cachedBook?.publisher ?? null,
        publicationDate: bookData?.publicationDate ?? cachedBook?.publicationDate ?? null,
        language: bookData?.language ?? cachedBook?.language ?? null,
        bookFormat: bookData?.bookFormat ?? cachedBook?.bookFormat ?? null,
        purchases: Array.isArray(bookData?.purchases) ? bookData.purchases : (cachedBook?.purchases || []),
        bookmoryLogCount: Number(bookData?.bookmoryLogCount ?? cachedBook?.bookmoryLogCount) || 0,
        wishlist: Boolean(bookData?.wishlist ?? cachedBook?.wishlist),
    };

    // 1. Save immediately to local storage mirror
    const localBooks = readJson(LS_BOOKS_KEY, {});
    const existingLocal = localBooks[bookId] || {};
    localBooks[bookId] = {
        ...existingLocal,
        ...baseFields,
        createdAtISO: existingLocal.createdAtISO || nowIso,
        updatedAtISO: nowIso,
        _syncPending: true,
    };
    writeJson(LS_BOOKS_KEY, localBooks);

    if (privateNotes !== undefined) {
        const localBookNotes = readJson(LS_BOOK_NOTES_KEY, {});
        localBookNotes[bookId] = privateNotes || '';
        writeJson(LS_BOOK_NOTES_KEY, localBookNotes);
    }

    unmarkDeletedId(bookId);
    notifyBookSubscribers();
    queuePublishedItemRefresh(safeUid, 'book', bookId);

    // 2. Attempt Firestore sync in try/catch
    if (db) {
        const persist = async () => {
        try {
            const bookRef = doc(db, 'users', safeUid, 'books', bookId);
            const publicDoc = {
                ...baseFields,
                updatedAt: serverTimestamp(),
            };
            if (!bookData?.id) {
                publicDoc.createdAt = serverTimestamp();
            }
            await setDoc(bookRef, publicDoc, { merge: true });

            // Imports without a notes payload must never erase handwritten private notes.
            if (privateNotes !== undefined) {
                const privateRef = doc(db, 'users', safeUid, 'books', bookId, 'private', 'notes');
                await setDoc(privateRef, { notes: privateNotes || '', updatedAt: serverTimestamp() }, { merge: true });
            }
            markLocalCloudAcknowledged(LS_BOOKS_KEY, bookId, notifyBookSubscribers);
            queuePublishedItemRefresh(safeUid, 'book', bookId);
            void flushPublishedItemRefreshes();
        } catch (err) {
            if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') {
                reportFirestoreError(err, 'saving private diary data');
                throw err;
            }
            console.warn('Firestore sync deferred (saved locally):', err.message);
        }
         };
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            // Firestore persistent cache queues the write. Return to the user
            // immediately rather than waiting indefinitely for server acknowledgement.
            void persist().catch((error) => reportFirestoreError(error, 'syncing offline diary changes'));
        } else {
            await persist();
        }
    }

    // Auto-project to public shelf
    publishLibraryItem(safeUid, { ...baseFields, mediaType: 'book' }).catch(() => {});

    return bookId;
}

/**
 * Fetches private notes for a book (Owner only).
 */
export async function getBookPrivateNotes(uid, bookId) {
    if (!bookId) return '';
    const safeBookId = sanitizeId(bookId, 'book');
    const localNotes = readJson(LS_BOOK_NOTES_KEY, {});
    const hasLocal = Object.prototype.hasOwnProperty.call(localNotes, safeBookId);

    if (db && uid) {
        try {
            const safeUid = sanitizeId(uid, 'user');
            const snap = await getDoc(doc(db, 'users', safeUid, 'books', safeBookId, 'private', 'notes'));
            if (snap.exists()) {
                const cloudNotes = snap.data().notes || '';
                return hasLocal ? localNotes[safeBookId] : cloudNotes;
            }
        } catch {
            // Fall back to local notes on permission error
        }
    }
    return localNotes[safeBookId] || '';
}

/**
 * Updates a book's current reading page and status.
 */
export async function updateBookProgress(uid, bookId, currentPage, pages, status) {
    if (!bookId) return;
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const { safeBookId, book, localBooks } = ensureLocalBook(bookId);

    const totalPages = Number(pages) > 0 ? Number(pages) : (Number(book.pages) > 0 ? Number(book.pages) : null);
    const curPage = Number(currentPage) || 0;
    const progress = totalPages > 0 ? Math.min(100, Math.round((curPage / totalPages) * 100)) : 0;

    let newStatus = status || book.status || 'reading';
    const finishedOn = progress >= 100
        ? new Date().toISOString().split('T')[0]
        : '';

    if (progress >= 100) {
        newStatus = 'completed';
    } else if (curPage > 0 && (!status || status === 'want-to-read')) {
        newStatus = 'reading';
    }

    localBooks[safeBookId] = {
        ...book,
        id: safeBookId,
        pages: totalPages,
        currentPage: curPage,
        progress,
        status: newStatus,
        finishedOn,
        updatedAtISO: new Date().toISOString(),
        _syncPending: true,
    };
    writeJson(LS_BOOKS_KEY, localBooks);
    unmarkDeletedId(safeBookId);
    notifyBookSubscribers();
    queuePublishedItemRefresh(safeUid, 'book', safeBookId);

    if (db) {
        try {
            const bookRef = doc(db, 'users', safeUid, 'books', safeBookId);
            const updates = {
                pages: totalPages,
                currentPage: curPage,
                progress,
                status: newStatus,
                updatedAt: serverTimestamp(),
            };
            updates.finishedOn = finishedOn;
            await setDoc(bookRef, updates, { merge: true });
            markLocalCloudAcknowledged(LS_BOOKS_KEY, safeBookId, notifyBookSubscribers);
            queuePublishedItemRefresh(safeUid, 'book', safeBookId);
            void flushPublishedItemRefreshes();
        } catch (err) {
            if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') {
                reportFirestoreError(err, 'saving private diary data');
                throw err;
            }
            console.warn('Firestore progress sync deferred (saved locally):', err.message);
        }
    }

    // Auto-project updated book progress to public shelf
    publishLibraryItem(safeUid, { ...localBooks[safeBookId], mediaType: 'book' }).catch(() => {});
}

/**
 * Saves a reading timer session and advances the book page.
 */
export async function addReadingSession(uid, bookId, sessionData = {}) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const { safeBookId } = ensureLocalBook(bookId || sessionData?.bookId);
    const sessionId = sanitizeId(sessionData?.id || Date.now(), 'session');

    const minutes = Number(sessionData.minutes) || 0;
    const fromPage = Number(sessionData.fromPage) || 0;
    const toPage = Number(sessionData.toPage) || fromPage;
    const pagesRead = Math.max(0, toPage - fromPage);
    const startedAt = sessionData.startedAt || new Date().toISOString();

    const allSessions = readJson(LS_SESSIONS_KEY, {});
    const existingSessions = Array.isArray(allSessions[safeBookId]) ? allSessions[safeBookId] : [];
    const sessionRecord = {
        id: sessionId,
        startedAt,
        minutes,
        fromPage,
        toPage,
        pagesRead,
        createdAtISO: new Date().toISOString(),
    };
    allSessions[safeBookId] = [sessionRecord, ...existingSessions];
    writeJson(LS_SESSIONS_KEY, allSessions);

    if (toPage > fromPage) {
        await updateBookProgress(safeUid, safeBookId, toPage, sessionData.totalPages, sessionData.status);
    } else {
        notifyBookSubscribers();
    }

    if (db) {
        try {
            const sessionRef = doc(db, 'users', safeUid, 'books', safeBookId, 'sessions', sessionId);
            await setDoc(sessionRef, {
                id: sessionId,
                startedAt,
                minutes,
                fromPage,
                toPage,
                pagesRead,
                createdAt: serverTimestamp(),
            });
        } catch (err) {
            reportFirestoreError(err, 'saving reading session');
            if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') throw err;
            console.warn('Firestore reading session sync deferred (saved locally):', err.message);
        }
    }
}

/**
 * Fetches recent reading sessions for a book.
 */
export async function getReadingSessions(uid, bookId) {
    if (!bookId) return [];
    const safeBookId = sanitizeId(bookId, 'book');
    const allSessions = readJson(LS_SESSIONS_KEY, {});
    const localSessions = Array.isArray(allSessions[safeBookId]) ? allSessions[safeBookId] : [];
    const mergedMap = new Map();

    if (db && uid) {
        try {
            const safeUid = sanitizeId(uid, 'user');
            const q = query(
                collection(db, 'users', safeUid, 'books', safeBookId, 'sessions'),
                orderBy('startedAt', 'desc')
            );
            const snap = await getDocs(q);
            snap.docs.forEach((d) => {
                mergedMap.set(d.id, { id: d.id, ...d.data() });
            });
        } catch (err) {
            reportFirestoreError(err, 'reading book sessions');
            // Retain local sessions offline; the diary shell now explains access failures.
        }
    }

    localSessions.forEach((s) => {
        if (s && s.id) {
            mergedMap.set(String(s.id), s);
        }
    });

    const list = Array.from(mergedMap.values());
    list.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
    return list;
}

/**
 * Real-time listener for public books of a given owner.
 * Falls back to local mirror + static books if database is unconfigured or permission-denied.
 */
export function watchPublicBooks(ownerUid, onUpdate) {
    return subscribePrivateMedia('book', ownerUid, onUpdate);
}

/**
 * Deletes a book and its subcollections.
 */
export async function deleteBook(uid, bookId) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const safeBookId = sanitizeId(bookId, 'book');

    const localBooks = readJson(LS_BOOKS_KEY, {});
    delete localBooks[safeBookId];
    writeJson(LS_BOOKS_KEY, localBooks);

    const localNotes = readJson(LS_BOOK_NOTES_KEY, {});
    delete localNotes[safeBookId];
    writeJson(LS_BOOK_NOTES_KEY, localNotes);

    markDeletedId(safeBookId);
    notifyBookSubscribers();

    if (db) {
        try {
            await deleteDoc(doc(db, 'users', safeUid, 'books', safeBookId, 'private', 'notes')).catch(() => {});
            await deleteDoc(doc(db, 'users', safeUid, 'books', safeBookId));
        } catch (err) {
            console.warn('Firestore book delete deferred (deleted locally):', err.message);
        }
    }
    unpublishLibraryItem(safeUid, safeBookId).catch(() => {});
}

/**
 * Migrates all 51 Bookmory books from src/data/books.js into local storage and Firestore.
 * Useful for one-click initial setup when signed in as the owner.
 */
export async function seedExistingBooks(uid, onProgress) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    let count = 0;
    let sessionsCount = 0;
    for (let i = 0; i < fallbackBooks.length; i++) {
        const b = fallbackBooks[i];
        onProgress?.(i, fallbackBooks.length, b.title);
        const bookId = sanitizeId(b.id || b.coverId || b.title.replace(/\s+/g, '-').toLowerCase(), 'book');
        const pages = Number(b.pages) > 0 ? Number(b.pages) : null;
        await saveBook(
            safeUid,
            {
                ...b,
                id: bookId,
                currentPage: pages ? (b.progress === 100 ? pages : Math.round(((b.progress || 0) / 100) * pages)) : 0,
                pages,
            },
            b.privateNotes || ''
        );

        if (Array.isArray(b.logs)) {
            for (let j = 0; j < b.logs.length; j++) {
                const log = b.logs[j];
                if (!log.minutes) continue;
                await addReadingSession(safeUid, bookId, {
                    id: `bookmory_${bookId}_${j + 1}`,
                    startedAt: log.start ? `${log.start}T12:00:00.000Z` : new Date().toISOString(),
                    minutes: log.minutes,
                    fromPage: 0,
                    toPage: 0, // Historical aggregate has no verified per-session page position
                    totalPages: pages,
                    status: b.status,
                });
                sessionsCount++;
            }
        }
        count++;
    }
    onProgress?.(fallbackBooks.length, fallbackBooks.length, '');
    return { count, sessionsCount };
}

/**
 * Pushes everything in the local mirror (books, games, private notes, sessions)
 * up to Firestore. Unlike the individual save functions, this REPORTS failures
 * (e.g. permission-denied) so the UI can tell the user the cloud copy is missing.
 *
 * @returns {Promise<{books:number, games:number, sessions:number, error:string|null}>}
 */
export async function syncLocalToCloud(uid) {
    const result = { books: 0, games: 0, sessions: 0, skippedClean: 0, error: null };
    if (!db) {
        result.error = 'Firebase is not configured.';
        return result;
    }
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const stripLocal = ({ createdAtISO: _c, updatedAtISO: _u, ...rest }) => rest; // eslint-disable-line no-unused-vars

    try {
        const localBooks = readJson(LS_BOOKS_KEY, {});
        const bookNotes = readJson(LS_BOOK_NOTES_KEY, {});
        const sessions = readJson(LS_SESSIONS_KEY, {});
        for (const [key, book] of Object.entries(localBooks)) {
            // Do not overwrite newer cloud edits with a clean/stale local mirror.
            if (!book?._syncPending) { result.skippedClean++; continue; }
            const id = sanitizeId(book?.id || key, 'book');
            await setDoc(
                doc(db, 'users', safeUid, 'books', id),
                { ...stripLocal(book), id, updatedAt: serverTimestamp() },
                { merge: true }
            );
            if (bookNotes[id]) {
                await setDoc(
                    doc(db, 'users', safeUid, 'books', id, 'private', 'notes'),
                    { notes: bookNotes[id], updatedAt: serverTimestamp() },
                    { merge: true }
                );
            }
            for (const s of Array.isArray(sessions[id]) ? sessions[id] : []) {
                const sid = sanitizeId(s.id, 'session');
                await setDoc(
                    doc(db, 'users', safeUid, 'books', id, 'sessions', sid),
                    { ...stripLocal(s), id: sid, createdAt: serverTimestamp() },
                    { merge: true }
                );
                result.sessions++;
            }
            result.books++;
        }

        const localGames = readJson(LS_GAMES_KEY, {});
        const gameNotes = readJson(LS_GAME_NOTES_KEY, {});
        for (const [key, game] of Object.entries(localGames)) {
            if (!game?._syncPending) { result.skippedClean++; continue; }
            const id = sanitizeId(game?.id || key, 'game');
            const cleanGame = { ...stripLocal(game), id, mediaType: 'game' };
            await setDoc(
                doc(db, 'users', safeUid, 'games', id),
                { ...cleanGame, updatedAt: serverTimestamp() },
                { merge: true }
            );
            if (gameNotes[id]) {
                await setDoc(
                    doc(db, 'users', safeUid, 'games', id, 'private', 'notes'),
                    { review: gameNotes[id], updatedAt: serverTimestamp() },
                    { merge: true }
                );
            }
            result.games++;
        }

        // Propagate pending offline deletions to Firestore
        const deletedIds = getDeletedIdsSet();
        const successfullyDeleted = [];
        for (const deletedId of deletedIds) {
            try {
                await deleteDoc(doc(db, 'users', safeUid, 'books', deletedId, 'private', 'notes')).catch(() => {});
                await deleteDoc(doc(db, 'users', safeUid, 'books', deletedId)).catch(() => {});
                await deleteDoc(doc(db, 'users', safeUid, 'games', deletedId, 'private', 'notes')).catch(() => {});
                await deleteDoc(doc(db, 'users', safeUid, 'games', deletedId)).catch(() => {});
                successfullyDeleted.push(deletedId);
            } catch {
                // If deletion fails, keep in deletedIds to retry next sync
            }
        }
        if (successfullyDeleted.length > 0) {
            const currentDeleted = getDeletedIdsSet();
            successfullyDeleted.forEach((id) => currentDeleted.delete(id));
            writeJson(LS_DELETED_IDS_KEY, Array.from(currentDeleted));
        }
    } catch (err) {
        result.error = err?.code ? `${err.code}: ${err.message}` : err?.message || String(err);
    }
    return result;
}

/**
 * Pulls all books, private notes, and reading sessions directly from Firestore
 * and syncs them into the local storage mirror.
 *
 * @param {string} uid
 * @returns {Promise<{books: number, sessions: number, error: string|null}>}
 */
export async function pullBooksFromCloud(uid) {
    const result = { books: 0, sessions: 0, conflicts: 0, error: null };
    if (!db) {
        result.error = 'Firebase is not configured.';
        return result;
    }
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');

    try {
        const snap = await getDocs(collection(db, 'users', safeUid, 'books'));
        const localBooks = readJson(LS_BOOKS_KEY, {});
        const localNotes = readJson(LS_BOOK_NOTES_KEY, {});
        const allSessions = readJson(LS_SESSIONS_KEY, {});
        const deletedIds = getDeletedIdsSet();

        for (const docSnap of snap.docs) {
            const id = docSnap.id;
            if (deletedIds.has(id)) {
                continue;
            }
            // Retain unsynced local edits: a cloud pull must not erase them.
            if (localBooks[id]?._syncPending) { result.conflicts++; continue; }
            const data = docSnap.data();
            localBooks[id] = { ...data, id };
            unmarkDeletedId(id);
            result.books++;

            // Pull private notes
            try {
                const noteSnap = await getDoc(doc(db, 'users', safeUid, 'books', id, 'private', 'notes'));
                if (noteSnap.exists()) {
                    localNotes[id] = noteSnap.data().notes || '';
                }
            } catch {
                /* optional private notes */
            }

            // Pull reading sessions
            try {
                const sessSnap = await getDocs(collection(db, 'users', safeUid, 'books', id, 'sessions'));
                if (!sessSnap.empty) {
                    allSessions[id] = sessSnap.docs.map((s) => ({ id: s.id, ...s.data() }));
                    result.sessions += sessSnap.docs.length;
                }
            } catch {
                /* optional sessions */
            }
        }

        writeJson(LS_BOOKS_KEY, localBooks);
        writeJson(LS_BOOK_NOTES_KEY, localNotes);
        writeJson(LS_SESSIONS_KEY, allSessions);
        notifyBookSubscribers();
    } catch (err) {
        result.error = err?.message || String(err);
    }
    return result;
}

/**
 * Pulls all games and private reviews directly from Firestore
 * and syncs them into the local storage mirror.
 *
 * @param {string} uid
 * @returns {Promise<{games: number, error: string|null}>}
 */
export async function pullGamesFromCloud(uid) {
    const result = { games: 0, conflicts: 0, error: null };
    if (!db) {
        result.error = 'Firebase is not configured.';
        return result;
    }
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');

    try {
        const snap = await getDocs(collection(db, 'users', safeUid, 'games'));
        const localGames = readJson(LS_GAMES_KEY, {});
        const localNotes = readJson(LS_GAME_NOTES_KEY, {});
        const deletedIds = getDeletedIdsSet();

        for (const docSnap of snap.docs) {
            const id = docSnap.id;
            if (deletedIds.has(id)) {
                continue;
            }
            if (localGames[id]?._syncPending) { result.conflicts++; continue; }
            const data = docSnap.data();
            const gameRecord = { ...data, id, mediaType: 'game' };
            localGames[id] = gameRecord;
            unmarkDeletedId(id);
            result.games++;

            try {
                const noteSnap = await getDoc(doc(db, 'users', safeUid, 'games', id, 'private', 'notes'));
                if (noteSnap.exists()) {
                    localNotes[id] = noteSnap.data().review || '';
                }
            } catch {
                /* optional notes */
            }
        }

        writeJson(LS_GAMES_KEY, localGames);
        writeJson(LS_GAME_NOTES_KEY, localNotes);
        notifyGameSubscribers();
    } catch (err) {
        result.error = err?.message || String(err);
    }
    return result;
}


/* =========================================================================
   STATISTICS HELPERS
   ========================================================================= */

export function calculateGameStats(games = []) {
    const finished = games.filter(g => g.status === 'finished' || g.finishedOn);
    const totalHours = games.reduce((sum, g) => sum + (Number(g.hoursPlayed) || 0), 0);
    const rated = finished.filter(g => Number(g.rating) > 0);
    const avgRating = rated.length > 0
        ? (rated.reduce((sum, g) => sum + Number(g.rating), 0) / rated.length).toFixed(1)
        : '0.0';

    // Year breakdown
    const byYear = {};
    finished.forEach(g => {
        const year = (g.finishedOn || '').slice(0, 4) || 'Unknown';
        byYear[year] = (byYear[year] || 0) + 1;
    });

    // Genre breakdown
    const genres = {};
    games.forEach(g => {
        (g.genres || []).forEach(genre => {
            genres[genre] = (genres[genre] || 0) + 1;
        });
    });

    return {
        totalFinished: finished.length,
        totalHours,
        avgRating,
        byYear,
        genres,
    };
}

/* =========================================================================
   JOURNAL & SESSION HELPERS (Phase 3)
   ========================================================================= */

/**
 * Saves or updates a private journal entry.
 */
export async function saveJournalEntry(uid, entry) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const id = sanitizeId(entry?.id || Date.now(), 'journal');
    const nowIso = new Date().toISOString();
    const cleanEntry = {
        schemaVersion: 2,
        id,
        title: entry?.title || '',
        body: entry?.body || '',
        type: entry?.type || 'reflection',
        date: entry?.date || nowIso.split('T')[0],
        linkedMediaId: entry?.linkedMediaId || null,
        linkedMediaType: entry?.linkedMediaType || null,
        visibility: 'private',
        createdAt: entry?.createdAt || nowIso,
        updatedAt: nowIso,
    };

    const localJournal = readJson(LS_JOURNAL_KEY, {});
    localJournal[id] = cleanEntry;
    writeJson(LS_JOURNAL_KEY, localJournal);
    unmarkDeletedId(id);
    notifyJournalSubscribers();

    if (db) {
        try {
            const docRef = doc(db, 'users', safeUid, 'journalEntries', id);
            await setDoc(docRef, { ...cleanEntry, updatedAt: serverTimestamp() }, { merge: true });
        } catch (err) {
            reportFirestoreError(err, 'saving journal');
            if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') throw err;
            console.warn('Firestore journal save deferred (saved locally):', err.message);
        }
    }

    return id;
}

/**
 * Deletes a journal entry.
 */
export async function deleteJournalEntry(uid, entryId) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const id = sanitizeId(entryId, 'journal');

    const localJournal = readJson(LS_JOURNAL_KEY, {});
    delete localJournal[id];
    writeJson(LS_JOURNAL_KEY, localJournal);
    markDeletedId(id);
    notifyJournalSubscribers();

    if (db) {
        try {
            await deleteDoc(doc(db, 'users', safeUid, 'journalEntries', id));
            await unpublishHighlight(safeUid, id);
        } catch (err) {
            reportFirestoreError(err, 'deleting journal');
            if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') throw err;
            console.warn('Firestore journal delete deferred (deleted locally):', err.message);
        }
    }
}

/**
 * Real-time listener for private journal entries.
 */
export function watchJournalEntries(ownerUid, onUpdate) {
    let latestCloudEntries = [];
    let currentMetadata = { hasPendingWrites: false, fromCache: false };

    const emit = () => {
        const local = readJson(LS_JOURNAL_KEY, {});
        const merged = new Map();
        latestCloudEntries.forEach((e) => {
            if (e && e.id) merged.set(String(e.id), e);
        });
        Object.values(local).forEach((e) => {
            if (e && e.id) merged.set(String(e.id), e);
        });
        const list = Array.from(merged.values()).sort((a, b) =>
            String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || ''))
        );
        onUpdate(list, currentMetadata);
    };

    journalSubscribers.add(emit);
    emit();

    if (!db || !ownerUid) {
        return () => {
            journalSubscribers.delete(emit);
        };
    }

    const safeOwnerUid = sanitizeId(ownerUid, 'user');
    const q = collection(db, 'users', safeOwnerUid, 'journalEntries');

    const unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
            currentMetadata = {
                hasPendingWrites: Boolean(snapshot.metadata?.hasPendingWrites),
                fromCache: Boolean(snapshot.metadata?.fromCache),
            };
            latestCloudEntries = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            emit();
        },
        (error) => {
            reportFirestoreError(error, 'private journal entries');
            console.warn('Firestore journal listener fallback to local mirror:', error.message);
            emit();
        }
    );

    return () => {
        journalSubscribers.delete(emit);
        unsubFirestore();
    };
}

/**
 * Fetches all sessions (reading and gaming) across all media items.
 * Prioritizes canonical users/{uid}/sessions with legacy subcollection fallback and ID deduplication.
 */
// Concurrent tab mounts share an in-flight read instead of repeating many queries.
// Completed results are not cached: legacy changes must become visible immediately.
const inFlightSessionLoads = new Map();

async function fetchAllSessions(uid, safeUid) {
    const allLocal = readJson(LS_SESSIONS_KEY, {});
    const sessionMap = new Map();

    if (db && uid) {
        try {
            const canonicalSnap = await getDocs(collection(db, 'users', safeUid, 'sessions'));
            canonicalSnap.docs.forEach((record) => {
                sessionMap.set(record.id, { id: record.id, ...record.data() });
            });
        } catch (err) {
            reportFirestoreError(err, 'loading canonical sessions');
            if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') throw err;
            console.warn('Could not fetch canonical sessions:', err.message);
        }

        try {
            const booksSnap = await getDocs(collection(db, 'users', safeUid, 'books'));
            // The previous implementation awaited one HTTP/cache read *per book*.
            // Bound parallelism to avoid both waterfall latency and bursty requests.
            const books = booksSnap.docs;
            let cursor = 0;
            const worker = async () => {
                while (cursor < books.length) {
                    const bookDoc = books[cursor++];
                    try {
                        const snap = await getDocs(collection(db, 'users', safeUid, 'books', bookDoc.id, 'sessions'));
                        snap.docs.forEach((record) => {
                            if (!sessionMap.has(record.id)) {
                                sessionMap.set(record.id, { id: record.id, ...record.data(), mediaId: bookDoc.id, mediaType: 'book' });
                            }
                        });
                    } catch (err) {
                        reportFirestoreError(err, 'loading legacy reading sessions');
                        if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') throw err;
                        // A failed legacy subcollection must not hide sessions from other books.
                        console.warn('Could not load legacy sessions:', bookDoc.id, err.message);
                    }
                }
            };
            await Promise.all(Array.from({ length: Math.min(6, books.length) }, () => worker()));
        } catch (err) {
            reportFirestoreError(err, 'loading legacy sessions');
            if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') throw err;
            console.warn('Legacy session collection unavailable:', err.message);
        }
    }

    Object.entries(allLocal).forEach(([mediaId, entries]) => {
        if (Array.isArray(entries)) {
            entries.forEach((entry) => {
                if (entry?.id && !sessionMap.has(String(entry.id))) {
                    sessionMap.set(String(entry.id), { ...entry, mediaId });
                }
            });
        }
    });
    return Array.from(sessionMap.values()).sort((a, b) =>
        String(b.startedAt || '').localeCompare(String(a.startedAt || ''))
    );
}

export function getAllSessions(uid) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const previous = inFlightSessionLoads.get(safeUid);
    if (previous) return previous;
    const pending = fetchAllSessions(uid, safeUid);
    inFlightSessionLoads.set(safeUid, pending);
    void pending.finally(() => {
        if (inFlightSessionLoads.get(safeUid) === pending) inFlightSessionLoads.delete(safeUid);
    }).catch(() => {});
    return pending;
}

/**
 * Subscribes to canonical sessions with real-time updates and fallback.
 */
export function observeCanonicalSessions(uid, callback) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    if (db && uid) {
        try {
            const repo = getDiaryRepository(safeUid);
            return repo.observeSessions({}, (snapshot) => {
                callback(snapshot.sessions || []);
            });
        } catch (err) {
            console.warn('observeCanonicalSessions error, falling back:', err.message);
        }
    }
    // Fallback to local snapshot
    const allLocal = readJson(LS_SESSIONS_KEY, {});
    const list = [];
    Object.values(allLocal).forEach((arr) => {
        if (Array.isArray(arr)) list.push(...arr);
    });
    callback(list);
    return () => {};
}

/* =========================================================================
   PUBLIC SHELF & HIGHLIGHTS PROJECTION HELPERS (Phase 4)
   ========================================================================= */

/**
 * Publishes a sanitized snapshot of a book or game to the public shelf.
 */
export async function publishLibraryItem(uid, item, options = {}) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const id = sanitizeId(item?.id || Date.now(), 'item');
    const sanitized = toPublicShelfItem(item, options);

    const localShelf = readJson(LS_PUBLIC_SHELF_KEY, {});
    localShelf[id] = sanitized;
    writeJson(LS_PUBLIC_SHELF_KEY, localShelf);
    notifyPublicShelfSubscribers();

    if (db) {
        try {
            const shelfRef = doc(db, 'publicProfiles', safeUid, 'shelf', id);
            await setDoc(shelfRef, { ...sanitized, publicOptions: {
                showStatus: options.showStatus !== false,
                showRating: options.showRating !== false,
                showTags: options.showTags !== false,
            }, updatedAt: serverTimestamp() }, { merge: true });
        } catch (err) {
            if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') {
                const local = readJson(LS_PUBLIC_SHELF_KEY, {});
                delete local[id];
                writeJson(LS_PUBLIC_SHELF_KEY, local);
                notifyPublicShelfSubscribers();
                throw err;
            }
            console.warn('Firestore publishLibraryItem deferred (saved locally):', err.message);
        }
    }

    return sanitized;
}

/**
 * Removes an item from the public shelf.
 */
export async function unpublishLibraryItem(uid, itemId) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const id = sanitizeId(itemId, 'item');

    const localShelf = readJson(LS_PUBLIC_SHELF_KEY, {});
    delete localShelf[id];
    writeJson(LS_PUBLIC_SHELF_KEY, localShelf);
    notifyPublicShelfSubscribers();

    if (db) {
        try {
            const shelfRef = doc(db, 'publicProfiles', safeUid, 'shelf', id);
            await deleteDoc(shelfRef);
        } catch (err) {
            if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') throw err;
            console.warn('Firestore unpublishLibraryItem deferred (deleted locally):', err.message);
        }
    }
}

/**
 * Checks if a library item is currently published to the public shelf.
 */
export function isItemPublished(uid, itemId) {
    if (!itemId) return false;
    const localShelf = readJson(LS_PUBLIC_SHELF_KEY, {});
    return Boolean(localShelf[String(itemId)]);
}

/**
 * Real-time listener for public shelf items.
 * Anyone can read (signed-in or signed-out).
 */
export function watchPublicShelf(ownerUid, onUpdate) {
    let latestCloudItems = [];
    const emit = () => {
        const local = readJson(LS_PUBLIC_SHELF_KEY, {});
        const merged = new Map();
        latestCloudItems.forEach((item) => {
            if (item && item.id) merged.set(String(item.id), item);
        });
        Object.entries(local).forEach(([id, item]) => {
            if (item) merged.set(String(id), { ...item, id });
        });
        const list = Array.from(merged.values());
        onUpdate(list);
    };

    publicShelfSubscribers.add(emit);
    emit();

    if (!db || !ownerUid) {
        return () => {
            publicShelfSubscribers.delete(emit);
        };
    }

    const safeOwnerUid = sanitizeId(ownerUid, 'user');
    const q = collection(db, 'publicProfiles', safeOwnerUid, 'shelf');

    const unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
            latestCloudItems = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            emit();
        },
        (error) => {
            reportFirestoreError(error, 'public shelf');
            console.warn('Firestore public shelf listener fallback to local mirror:', error.message);
            emit();
        }
    );

    return () => {
        publicShelfSubscribers.delete(emit);
        unsubFirestore();
    };
}

/**
 * Publishes a highlight / quote to public highlights.
 */
export async function publishHighlight(uid, entry, options = {}) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const id = sanitizeId(entry?.id || Date.now(), 'highlight');
    const sanitized = toPublicHighlight(entry, options);

    const localHighlights = readJson(LS_PUBLIC_HIGHLIGHTS_KEY, {});
    localHighlights[id] = sanitized;
    writeJson(LS_PUBLIC_HIGHLIGHTS_KEY, localHighlights);
    notifyPublicHighlightsSubscribers();

    if (db) {
        try {
            const docRef = doc(db, 'publicProfiles', safeUid, 'highlights', id);
            await setDoc(docRef, { ...sanitized, updatedAt: serverTimestamp() }, { merge: true });
        } catch (err) {
            reportFirestoreError(err, 'publishing highlight');
            if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') throw err;
            console.warn('Firestore publishHighlight deferred (saved locally):', err.message);
        }
    }

    return sanitized;
}

/**
 * Removes a highlight from public highlights.
 */
export async function unpublishHighlight(uid, highlightId) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const id = sanitizeId(highlightId, 'highlight');

    const localHighlights = readJson(LS_PUBLIC_HIGHLIGHTS_KEY, {});
    delete localHighlights[id];
    writeJson(LS_PUBLIC_HIGHLIGHTS_KEY, localHighlights);
    notifyPublicHighlightsSubscribers();

    if (db) {
        try {
            const docRef = doc(db, 'publicProfiles', safeUid, 'highlights', id);
            await deleteDoc(docRef);
        } catch (err) {
            reportFirestoreError(err, 'unpublishing highlight');
            if (err?.code === 'permission-denied' || err?.code === 'unauthenticated') throw err;
            console.warn('Firestore unpublishHighlight deferred (deleted locally):', err.message);
        }
    }
}

/**
 * Checks if a highlight is currently published.
 */
export function isHighlightPublished(uid, highlightId) {
    if (!highlightId) return false;
    const localHighlights = readJson(LS_PUBLIC_HIGHLIGHTS_KEY, {});
    return Boolean(localHighlights[String(highlightId)]);
}

/**
 * Real-time listener for public highlights.
 */
export function watchPublicHighlights(ownerUid, onUpdate) {
    let latestCloudHighlights = [];
    const emit = () => {
        const local = readJson(LS_PUBLIC_HIGHLIGHTS_KEY, {});
        const merged = new Map();
        latestCloudHighlights.forEach((h) => {
            if (h && h.id) merged.set(String(h.id), h);
        });
        Object.entries(local).forEach(([id, h]) => {
            if (h) merged.set(String(id), { ...h, id });
        });
        const list = Array.from(merged.values()).sort((a, b) =>
            String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))
        );
        onUpdate(list);
    };

    publicHighlightsSubscribers.add(emit);
    emit();

    if (!db || !ownerUid) {
        return () => {
            publicHighlightsSubscribers.delete(emit);
        };
    }

    const safeOwnerUid = sanitizeId(ownerUid, 'user');
    const q = collection(db, 'publicProfiles', safeOwnerUid, 'highlights');

    const unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
            latestCloudHighlights = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            emit();
        },
        (error) => {
            reportFirestoreError(error, 'public highlights');
            console.warn('Firestore public highlights listener fallback to local mirror:', error.message);
            emit();
        }
    );

    return () => {
        publicHighlightsSubscribers.delete(emit);
        unsubFirestore();
    };
}

/* =========================================================================
   BACKUP & EXPORT HELPERS (Phase 6)
   ========================================================================= */

/**
 * Exports all user data (games, books, sessions, private notes) as a JSON backup object.
 */
export async function exportUserData(uid) {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');

    // 1. Get all games + private reviews (merged cloud + local)
    let cloudGames = [];
    if (db && uid) {
        try {
            const gamesSnap = await getDocs(collection(db, 'users', safeUid, 'games'));
            cloudGames = gamesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (error) {
            reportFirestoreError(error, 'exporting games');
            if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') throw error;
            // Non-authorisation network failures retain local backup fallback.
        }
    }
    const mergedGames = buildMergedGames(cloudGames);
    const games = [];
    for (const g of mergedGames) {
        const gameId = sanitizeId(g.id, 'game');
        const privateReview = await getGamePrivateNotes(safeUid, gameId);
        games.push({
            ...g,
            privateReview,
        });
    }

    // 2. Get all books + sessions + private notes (merged cloud + local)
    let cloudBooks = [];
    if (db && uid) {
        try {
            const booksSnap = await getDocs(collection(db, 'users', safeUid, 'books'));
            cloudBooks = booksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (error) {
            reportFirestoreError(error, 'exporting books');
            if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') throw error;
            // Non-authorisation network failures retain local backup fallback.
        }
    }
    const mergedBooks = buildMergedBooks(cloudBooks);
    const books = [];
    for (const b of mergedBooks) {
        const bookId = sanitizeId(b.id, 'book');
        const privateNotes = await getBookPrivateNotes(safeUid, bookId);
        const sessions = await getReadingSessions(safeUid, bookId);
        books.push({
            ...b,
            privateNotes,
            sessions,
        });
    }

    // Canonical v2 diary history must be included in a "Full JSON Backup".
    // Never silently present an incomplete remote backup as complete.
    const canonicalData = {};
    const publicData = {};
    const nestedData = { books: {}, games: {} };
    const backupWarnings = [];
    const pendingBooks = books.filter((record) => record._syncPending).length;
    const pendingGames = games.filter((record) => record._syncPending).length;
    if (pendingBooks || pendingGames) backupWarnings.push(`${pendingBooks} books and ${pendingGames} games still have local unsynced changes.`);
    const fetchForBackup = async (segments, target, key) => {
        if (!db || !uid) {
            target[key] = [];
            return;
        }
        try {
            const snapshot = await getDocs(collection(db, ...segments));
            target[key] = snapshot.docs.map((record) => ({ id: record.id, ...record.data() }));
            if (snapshot.metadata?.fromCache) {
                backupWarnings.push(`${segments.join('/')} was read from local cache, not verified against the server.`);
            }
        } catch (error) {
            reportFirestoreError(error, `exporting ${segments.join('/')}`);
            // Authorization failures must never be confused with a successful full backup.
            if (error?.code === 'permission-denied' || error?.code === 'unauthenticated') {
                throw new Error(`Full backup blocked by ${error.code} at ${segments.join('/')}. Verify deployed Firestore rules before exporting.`);
            }
            backupWarnings.push(`${segments.join('/')} could not be fully read: ${error.message}`);
            target[key] = [];
        }
    };
    if (!db) backupWarnings.push('Firebase is not configured: only the local legacy mirror is available.');
    for (const name of ['libraryItems', 'attempts', 'sessions', 'historicalAggregates', 'journalEntries', 'journal', 'goals']) {
        await fetchForBackup(['users', safeUid, name], canonicalData, name);
    }
    // Include ALL legacy nested documents, not only the known notes document.
    // These records are essential for a disaster-recovery backup of older installs.
    for (const book of books) {
        const id = sanitizeId(book.id, 'book');
        const nested = {};
        await fetchForBackup(['users', safeUid, 'books', id, 'sessions'], nested, 'sessions');
        await fetchForBackup(['users', safeUid, 'books', id, 'private'], nested, 'private');
        nestedData.books[id] = nested;
    }
    for (const game of games) {
        const id = sanitizeId(game.id, 'game');
        const nested = {};
        await fetchForBackup(['users', safeUid, 'games', id, 'private'], nested, 'private');
        nestedData.games[id] = nested;
    }
    for (const name of ['shelf', 'highlights']) {
        await fetchForBackup(['publicProfiles', safeUid, name], publicData, name);
    }

    return {
        exportedAt: new Date().toISOString(),
        version: '2.0',
        uid: safeUid,
        isCloudComplete: backupWarnings.length === 0,
        backupWarnings,
        totalGames: games.length,
        totalBooks: books.length,
        games,
        books,
        canonicalData,
        nestedData,
        publicData,
    };
}

/**
 * Triggers a browser/webview download of the JSON backup.
 * Supports mobile/Capacitor via navigator.share and clipboard fallback.
 */
export async function downloadJsonBackup(data, filename) {
    const defaultName = `diary-backup-${new Date().toISOString().split('T')[0]}.json`;
    const finalFilename = filename || defaultName;
    const jsonString = JSON.stringify(data, null, 2);

    // Do not put private diary JSON on the system clipboard or in share-sheet text.
    // Only share a real file; otherwise use the normal download path below.
    if (window.Capacitor?.isNativePlatform?.() && navigator.share && navigator.canShare) {
        try {
            const file = new File([jsonString], finalFilename, { type: 'application/json' });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: finalFilename });
                return;
            }
        } catch (shareErr) {
            if (shareErr.name === 'AbortError') return;
            console.warn('Secure file sharing unavailable; using file download:', shareErr);
        }
    }

    // Standard browser download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = finalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
