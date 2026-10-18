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
import fallbackBooks from '../data/books';

/* =========================================================================
   GAMES
   ========================================================================= */

/**
 * Saves or updates a game.
 * Public metadata goes to users/{uid}/games/{gameId}.
 * Written reviews and private notes go to users/{uid}/games/{gameId}/private/notes.
 * 
 * @param {string} uid Owner UID
 * @param {Object} gameData Public game data
 * @param {string} [privateReview=''] Private review text
 * @returns {Promise<string>} Saved game ID
 */
export async function saveGame(uid, gameData, privateReview = '') {
    if (!db) throw new Error('Database is not initialized. Check your Firebase configuration.');
    if (!uid) throw new Error('User UID is required to save a game.');

    const gameId = gameData.id || String(gameData.rawgId || Date.now());
    const gameRef = doc(db, 'users', uid, 'games', gameId);

    const publicDoc = {
        id: gameId,
        rawgId: gameData.rawgId || null,
        title: gameData.title || 'Untitled Game',
        cover: gameData.cover || '',
        released: gameData.released || '',
        genres: Array.isArray(gameData.genres) ? gameData.genres : [],
        platforms: Array.isArray(gameData.platforms) ? gameData.platforms : [],
        platform: gameData.platform || '',
        finishedOn: gameData.finishedOn || '',
        hoursPlayed: Number(gameData.hoursPlayed) || 0,
        rating: Number(gameData.rating) || 0, // 0 - 10 scale
        status: gameData.status || (gameData.finishedOn ? 'finished' : 'playing'),
        updatedAt: serverTimestamp(),
    };

    if (!gameData.id) {
        publicDoc.createdAt = serverTimestamp();
    }

    await setDoc(gameRef, publicDoc, { merge: true });

    // Save private review to users/{uid}/games/{gameId}/private/notes
    const privateRef = doc(db, 'users', uid, 'games', gameId, 'private', 'notes');
    await setDoc(privateRef, {
        review: privateReview || '',
        updatedAt: serverTimestamp(),
    }, { merge: true });

    return gameId;
}

/**
 * Deletes a game and its private notes.
 */
export async function deleteGame(uid, gameId) {
    if (!db) throw new Error('Database is not initialized');
    const privateRef = doc(db, 'users', uid, 'games', gameId, 'private', 'notes');
    try {
        await deleteDoc(privateRef);
    } catch {
        // Ignored if document does not exist
    }
    const gameRef = doc(db, 'users', uid, 'games', gameId);
    await deleteDoc(gameRef);
}

/**
 * Real-time listener for public games of a given owner.
 * Works signed-out with no auth required.
 */
export function watchPublicGames(ownerUid, onUpdate, onError) {
    if (!db || !ownerUid) {
        onUpdate([]);
        return () => {};
    }

    const q = query(
        collection(db, 'users', ownerUid, 'games'),
        orderBy('finishedOn', 'desc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            const games = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            onUpdate(games);
        },
        (error) => {
            console.error('Error listening to public games:', error);
            if (onError) onError(error);
            else onUpdate([]);
        }
    );
}

/**
 * One-time fetch of public games.
 */
export async function getPublicGames(ownerUid) {
    if (!db || !ownerUid) return [];
    const q = query(
        collection(db, 'users', ownerUid, 'games'),
        orderBy('finishedOn', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Fetches private notes for a game (Owner only).
 */
export async function getGamePrivateNotes(uid, gameId) {
    if (!db || !uid || !gameId) return '';
    try {
        const snap = await getDoc(doc(db, 'users', uid, 'games', gameId, 'private', 'notes'));
        return snap.exists() ? snap.data().review || '' : '';
    } catch {
        return '';
    }
}


/* =========================================================================
   BOOKS
   ========================================================================= */

/**
 * Saves or updates a book.
 * Public metadata goes to users/{uid}/books/{bookId}.
 * Private notes go to users/{uid}/books/{bookId}/private/notes.
 */
export async function saveBook(uid, bookData, privateNotes = '') {
    if (!db) throw new Error('Database is not initialized. Check your Firebase configuration.');
    if (!uid) throw new Error('User UID is required to save a book.');

    const bookId = bookData.id || String(bookData.coverId || Date.now());
    const bookRef = doc(db, 'users', uid, 'books', bookId);

    const pages = Number(bookData.pages) || 0;
    const currentPage = Number(bookData.currentPage) || 0;
    const progress = pages > 0 ? Math.min(100, Math.round((currentPage / pages) * 100)) : (Number(bookData.progress) || 0);

    const publicDoc = {
        id: bookId,
        olKey: bookData.olKey || '',
        title: bookData.title || 'Untitled Book',
        authors: Array.isArray(bookData.authors) ? bookData.authors : (bookData.author ? [bookData.author] : []),
        author: bookData.author || (Array.isArray(bookData.authors) ? bookData.authors.join(', ') : ''),
        coverId: bookData.coverId || null,
        cover: bookData.cover || '',
        pages,
        currentPage,
        progress,
        status: bookData.status || 'want-to-read', // 'want-to-read' | 'reading' | 'completed' | 'dropped'
        rating: Number(bookData.rating) || null,
        favorite: Boolean(bookData.favorite),
        genres: Array.isArray(bookData.genres) ? bookData.genres : [],
        startedOn: bookData.startedOn || '',
        finishedOn: bookData.finishedOn || '',
        updatedAt: serverTimestamp(),
    };

    if (!bookData.id) {
        publicDoc.createdAt = serverTimestamp();
    }

    await setDoc(bookRef, publicDoc, { merge: true });

    // Private notes
    const privateRef = doc(db, 'users', uid, 'books', bookId, 'private', 'notes');
    await setDoc(privateRef, {
        notes: privateNotes || '',
        updatedAt: serverTimestamp(),
    }, { merge: true });

    return bookId;
}

/**
 * Fetches private notes for a book (Owner only).
 */
export async function getBookPrivateNotes(uid, bookId) {
    if (!db || !uid || !bookId) return '';
    try {
        const snap = await getDoc(doc(db, 'users', uid, 'books', bookId, 'private', 'notes'));
        return snap.exists() ? snap.data().notes || '' : '';
    } catch {
        return '';
    }
}

/**
 * Updates a book's current reading page and status.
 */
export async function updateBookProgress(uid, bookId, currentPage, pages, status) {
    if (!db || !uid || !bookId) return;
    const bookRef = doc(db, 'users', uid, 'books', bookId);
    const totalPages = Number(pages) || 0;
    const curPage = Number(currentPage) || 0;
    const progress = totalPages > 0 ? Math.min(100, Math.round((curPage / totalPages) * 100)) : 0;

    let newStatus = status;
    const updates = {
        currentPage: curPage,
        progress,
        updatedAt: serverTimestamp(),
    };

    if (progress >= 100) {
        newStatus = 'completed';
        updates.finishedOn = new Date().toISOString().split('T')[0];
    } else if (curPage > 0 && (!status || status === 'want-to-read')) {
        newStatus = 'reading';
    }

    if (newStatus) updates.status = newStatus;

    await setDoc(bookRef, updates, { merge: true });
}

/**
 * Saves a reading timer session and advances the book page.
 */
export async function addReadingSession(uid, bookId, sessionData) {
    if (!db) throw new Error('Database is not initialized');
    const sessionId = String(Date.now());
    const sessionRef = doc(db, 'users', uid, 'books', bookId, 'sessions', sessionId);

    const minutes = Number(sessionData.minutes) || 0;
    const fromPage = Number(sessionData.fromPage) || 0;
    const toPage = Number(sessionData.toPage) || fromPage;
    const pagesRead = Math.max(0, toPage - fromPage);

    await setDoc(sessionRef, {
        id: sessionId,
        startedAt: sessionData.startedAt || new Date().toISOString(),
        minutes,
        fromPage,
        toPage,
        pagesRead,
        createdAt: serverTimestamp(),
    });

    if (toPage > fromPage) {
        await updateBookProgress(uid, bookId, toPage, sessionData.totalPages, sessionData.status);
    }
}

/**
 * Fetches recent reading sessions for a book.
 */
export async function getReadingSessions(uid, bookId) {
    if (!db || !uid || !bookId) return [];
    try {
        const q = query(
            collection(db, 'users', uid, 'books', bookId, 'sessions'),
            orderBy('startedAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
        return [];
    }
}

/**
 * Real-time listener for public books of a given owner.
 * Falls back to local static books if database is unconfigured.
 */
export function watchPublicBooks(ownerUid, onUpdate, onError) {
    if (!db || !ownerUid) {
        onUpdate(fallbackBooks);
        return () => {};
    }

    const q = query(
        collection(db, 'users', ownerUid, 'books'),
        orderBy('updatedAt', 'desc')
    );

    return onSnapshot(
        q,
        (snapshot) => {
            if (snapshot.empty) {
                // Graceful fallback to static 29 books if Firestore collection is empty
                onUpdate(fallbackBooks);
                return;
            }
            const books = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            onUpdate(books);
        },
        (error) => {
            console.error('Error listening to public books:', error);
            if (onError) onError(error);
            onUpdate(fallbackBooks);
        }
    );
}

/**
 * Deletes a book and its subcollections.
 */
export async function deleteBook(uid, bookId) {
    if (!db) throw new Error('Database is not initialized');
    try {
        await deleteDoc(doc(db, 'users', uid, 'books', bookId, 'private', 'notes'));
    } catch {
        // Ignored if notes doc does not exist
    }
    await deleteDoc(doc(db, 'users', uid, 'books', bookId));
}

/**
 * Migrates existing 29 books from src/data/books.js into Firestore.
 * Useful for one-click initial setup when signed in as the owner.
 */
export async function seedExistingBooks(uid) {
    if (!db || !uid) throw new Error('User UID and database are required to seed books.');
    let count = 0;
    for (const b of fallbackBooks) {
        await saveBook(uid, {
            ...b,
            id: String(b.coverId || b.title.replace(/\s+/g, '-').toLowerCase()),
            currentPage: b.progress === 100 ? (b.pages || 350) : Math.round(((b.progress || 0) / 100) * (b.pages || 350)),
            pages: b.pages || 350,
        });
        count++;
    }
    return count;
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
    if (!db || !uid) throw new Error('User UID is required for data export.');

    // 1. Get all games + private reviews
    const gamesSnap = await getDocs(collection(db, 'users', uid, 'games'));
    const games = [];
    for (const d of gamesSnap.docs) {
        const game = { id: d.id, ...d.data() };
        try {
            const privateSnap = await getDoc(doc(db, 'users', uid, 'games', d.id, 'private', 'notes'));
            if (privateSnap.exists()) {
                game.privateReview = privateSnap.data().review || '';
            }
        } catch {
            // Ignored
        }
        games.push(game);
    }

    // 2. Get all books + sessions + private notes
    const booksSnap = await getDocs(collection(db, 'users', uid, 'books'));
    const books = [];
    for (const d of booksSnap.docs) {
        const book = { id: d.id, ...d.data() };
        try {
            const privateSnap = await getDoc(doc(db, 'users', uid, 'books', d.id, 'private', 'notes'));
            if (privateSnap.exists()) {
                book.privateNotes = privateSnap.data().notes || '';
            }
        } catch {
            // Ignored
        }
        try {
            const sessionsSnap = await getDocs(collection(db, 'users', uid, 'books', d.id, 'sessions'));
            book.sessions = sessionsSnap.docs.map(s => ({ id: s.id, ...s.data() }));
        } catch {
            book.sessions = [];
        }
        books.push(book);
    }

    return {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        uid,
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
