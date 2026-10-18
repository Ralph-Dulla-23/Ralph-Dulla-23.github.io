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
import { db } from './firebase';
import { OWNER_UID } from './config';
import fallbackBooks from '../data/books';

/* =========================================================================
   ID SANITIZATION & LOCAL STORAGE MIRROR
   ========================================================================= */

const LS_GAMES_KEY = 'diary_local_games_v1';
const LS_BOOKS_KEY = 'diary_local_books_v1';
const LS_SESSIONS_KEY = 'diary_local_sessions_v1';
const LS_GAME_NOTES_KEY = 'diary_local_game_notes_v1';
const LS_BOOK_NOTES_KEY = 'diary_local_book_notes_v1';
const LS_DELETED_IDS_KEY = 'diary_deleted_ids_v1';

const gameSubscribers = new Set();
const bookSubscribers = new Set();

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

function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        console.warn(`Failed to write ${key} to localStorage:`, err);
    }
}

function getDeletedIdsSet() {
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
            mergedMap.set(id, { ...mergedMap.get(id), ...g, id });
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
            const pages = Number(b.pages) || 350;
            const progress = Number(b.progress) || 0;
            const currentPage =
                b.currentPage !== undefined
                    ? Number(b.currentPage)
                    : progress === 100
                    ? pages
                    : Math.round((progress / 100) * pages);
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
            mergedMap.set(id, { ...mergedMap.get(id), ...b, id });
        }
    });

    const list = Array.from(mergedMap.values());
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
        const totalPages = Number(found.pages) || 350;
        const progress = Number(found.progress) || 0;
        const currentPage =
            found.currentPage !== undefined
                ? Number(found.currentPage)
                : progress === 100
                ? totalPages
                : Math.round((progress / 100) * totalPages);
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
        pages: 350,
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
        rawgId: gameData?.rawgId || null,
        title: gameData?.title || 'Untitled Game',
        cover: gameData?.cover || '',
        released: gameData?.released || '',
        genres: Array.isArray(gameData?.genres) ? gameData.genres : [],
        platforms: Array.isArray(gameData?.platforms) ? gameData.platforms : [],
        platform: gameData?.platform || '',
        finishedOn: gameData?.finishedOn || '',
        hoursPlayed: Number(gameData?.hoursPlayed) || 0,
        rating: Number(gameData?.rating) || 0, // 0 - 10 scale
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
    };
    writeJson(LS_GAMES_KEY, localGames);

    const localNotes = readJson(LS_GAME_NOTES_KEY, {});
    localNotes[gameId] = privateReview || '';
    writeJson(LS_GAME_NOTES_KEY, localNotes);

    unmarkDeletedId(gameId);
    notifyGameSubscribers();

    // 2. Attempt Firestore sync in background-safe try/catch
    if (db) {
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
        } catch (err) {
            console.warn('Firestore sync deferred (saved locally):', err.message);
        }
    }

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
}

/**
 * Real-time listener for public games of a given owner.
 * Works signed-out or when Firestore rules reject access by merging local mirror.
 */
export function watchPublicGames(ownerUid, onUpdate) {
    let latestCloudGames = [];
    const emit = () => {
        onUpdate(buildMergedGames(latestCloudGames));
    };

    gameSubscribers.add(emit);
    emit();

    if (!db || !ownerUid) {
        return () => {
            gameSubscribers.delete(emit);
        };
    }

    const safeOwnerUid = sanitizeId(ownerUid, 'user');
    const q = query(
        collection(db, 'users', safeOwnerUid, 'games'),
        orderBy('finishedOn', 'desc')
    );

    const unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
            latestCloudGames = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            emit();
        },
        (error) => {
            console.warn('Firestore public games listener fallback to local mirror:', error.message);
            emit();
        }
    );

    return () => {
        gameSubscribers.delete(emit);
        unsubFirestore();
    };
}

/**
 * One-time fetch of public games.
 */
export async function getPublicGames(ownerUid) {
    let cloudGames = [];
    if (db && ownerUid) {
        try {
            const safeOwnerUid = sanitizeId(ownerUid, 'user');
            const q = query(
                collection(db, 'users', safeOwnerUid, 'games'),
                orderBy('finishedOn', 'desc')
            );
            const snap = await getDocs(q);
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
export async function saveBook(uid, bookData, privateNotes = '') {
    const safeUid = sanitizeId(uid || OWNER_UID || 'owner', 'user');
    const bookId = sanitizeId(bookData?.id || bookData?.coverId || Date.now(), 'book');
    const nowIso = new Date().toISOString();

    const pages = Number(bookData?.pages) || 350;
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
    };

    // 1. Save immediately to local storage mirror
    const localBooks = readJson(LS_BOOKS_KEY, {});
    const existingLocal = localBooks[bookId] || {};
    localBooks[bookId] = {
        ...existingLocal,
        ...baseFields,
        createdAtISO: existingLocal.createdAtISO || nowIso,
        updatedAtISO: nowIso,
    };
    writeJson(LS_BOOKS_KEY, localBooks);

    if (privateNotes !== undefined) {
        const localBookNotes = readJson(LS_BOOK_NOTES_KEY, {});
        localBookNotes[bookId] = privateNotes || '';
        writeJson(LS_BOOK_NOTES_KEY, localBookNotes);
    }

    unmarkDeletedId(bookId);
    notifyBookSubscribers();

    // 2. Attempt Firestore sync in try/catch
    if (db) {
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

            const privateRef = doc(db, 'users', safeUid, 'books', bookId, 'private', 'notes');
            await setDoc(
                privateRef,
                {
                    notes: privateNotes || '',
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
        } catch (err) {
            console.warn('Firestore sync deferred (saved locally):', err.message);
        }
    }

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

    const totalPages = Number(pages) || Number(book.pages) || 350;
    const curPage = Number(currentPage) || 0;
    const progress = totalPages > 0 ? Math.min(100, Math.round((curPage / totalPages) * 100)) : 0;

    let newStatus = status || book.status || 'reading';
    const finishedOn =
        progress >= 100
            ? new Date().toISOString().split('T')[0]
            : book.finishedOn || '';

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
    };
    writeJson(LS_BOOKS_KEY, localBooks);
    unmarkDeletedId(safeBookId);
    notifyBookSubscribers();

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
            if (progress >= 100) {
                updates.finishedOn = finishedOn;
            }
            await setDoc(bookRef, updates, { merge: true });
        } catch (err) {
            console.warn('Firestore progress sync deferred (saved locally):', err.message);
        }
    }
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
        } catch {
            // Fall back to local sessions on permission error
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
    let latestCloudBooks = [];
    const emit = () => {
        onUpdate(buildMergedBooks(latestCloudBooks));
    };

    bookSubscribers.add(emit);
    emit();

    if (!db || !ownerUid) {
        return () => {
            bookSubscribers.delete(emit);
        };
    }

    const safeOwnerUid = sanitizeId(ownerUid, 'user');
    const q = query(
        collection(db, 'users', safeOwnerUid, 'books'),
        orderBy('updatedAt', 'desc')
    );

    const unsubFirestore = onSnapshot(
        q,
        (snapshot) => {
            latestCloudBooks = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            emit();
        },
        (error) => {
            console.warn('Firestore public books listener fallback to local mirror:', error.message);
            emit();
        }
    );

    return () => {
        bookSubscribers.delete(emit);
        unsubFirestore();
    };
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
        const pages = b.pages || 350;
        await saveBook(
            safeUid,
            {
                ...b,
                id: bookId,
                currentPage: b.progress === 100 ? pages : Math.round(((b.progress || 0) / 100) * pages),
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
                    toPage: b.status === 'completed' ? pages : 0,
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
    const result = { books: 0, games: 0, sessions: 0, error: null };
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
            const id = sanitizeId(game?.id || key, 'game');
            await setDoc(
                doc(db, 'users', safeUid, 'games', id),
                { ...stripLocal(game), id, updatedAt: serverTimestamp() },
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
    } catch (err) {
        result.error = err?.code ? `${err.code}: ${err.message}` : err?.message || String(err);
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
        } catch {
            // Fall back to local games if cloud fails
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
        } catch {
            // Fall back to local books if cloud fails
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

    return {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        uid: safeUid,
        totalGames: games.length,
        totalBooks: books.length,
        games,
        books,
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

    // Mobile / Capacitor environment safety
    if (window.Capacitor?.isNativePlatform?.() && navigator.share) {
        try {
            const file = new File([jsonString], finalFilename, { type: 'application/json' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: finalFilename,
                });
                return;
            }
            await navigator.share({
                title: finalFilename,
                text: jsonString,
            });
            return;
        } catch (shareErr) {
            if (shareErr.name === 'AbortError') return;
            console.warn('Share failed on mobile, attempting clipboard fallback:', shareErr);
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(jsonString);
                alert('Backup JSON copied to clipboard.');
                return;
            }
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
