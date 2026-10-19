import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import fallbackBooks from '../data/books';
import fallbackGames from '../data/games';

/**
 * Service providing real-time observations of public shelf projections and highlights.
 * Reads ONLY from publicProfiles/{ownerUid}/shelf and publicProfiles/{ownerUid}/highlights.
 * NEVER reads from users/{uid}/books, users/{uid}/games, or private subcollections.
 *
 * Conforms to Section 5 (SEC-01) of DIARY_STABILIZATION_IMPLEMENTATION.md.
 */

const LS_PUBLIC_SHELF_KEY = 'diary_public_shelf_v1';
const LS_PUBLIC_HIGHLIGHTS_KEY = 'diary_public_highlights_v1';

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

/**
 * Subscribes to the public shelf items for an owner UID.
 * Reads strictly from publicProfiles/{ownerUid}/shelf and local mirror.
 * If empty and no cloud items exist yet, provides fallbackBooks (which are sanitized)
 * so portfolio visitors see the portfolio shelf preview cleanly.
 *
 * @param {string} ownerUid
 * @param {function} onUpdate Callback receiving array of public shelf items
 * @returns {function} unsubscribe function
 */
export function observePublicShelf(ownerUid, onUpdate) {
    if (!onUpdate || typeof onUpdate !== 'function') return () => {};
    let latestCloudItems = [];

    const emit = () => {
        const local = readJson(LS_PUBLIC_SHELF_KEY, {});
        const map = new Map();

        // 1. Cloud public shelf items
        latestCloudItems.forEach((item) => {
            if (item && item.id) map.set(String(item.id), item);
        });

        // 2. Local mirror of published shelf items
        Object.entries(local).forEach(([id, item]) => {
            if (item) map.set(String(id), { ...item, id });
        });

        // 3. Local mirror of logged games (sanitized for public projection)
        const localGames = readJson('diary_games_v1', {});
        Object.entries(localGames).forEach(([id, item]) => {
            if (item && !map.has(String(id))) {
                map.set(String(id), {
                    schemaVersion: 2,
                    id: String(id),
                    mediaType: 'game',
                    title: item.title || 'Untitled Game',
                    cover: item.cover || item.coverUrl || '',
                    coverUrl: item.cover || item.coverUrl || '',
                    released: item.released || '',
                    genres: Array.isArray(item.genres) ? item.genres : [],
                    platforms: Array.isArray(item.platforms) ? item.platforms : (item.platform ? [item.platform] : []),
                    platform: item.platform || (Array.isArray(item.platforms) ? item.platforms[0] || '' : ''),
                    finishedOn: item.finishedOn || '',
                    hoursPlayed: Number(item.hoursPlayed) || 0,
                    rating: Number(item.rating) || 0,
                    ratingScale: 10,
                    status: item.status || (item.finishedOn ? 'finished' : 'playing'),
                    publishedAt: item.updatedAtISO || new Date().toISOString(),
                });
            }
        });

        let list = Array.from(map.values());

        // Fallback: If no public items exist yet, use sanitized static fallback books and games
        // to maintain the developer portfolio showcase
        if (list.length === 0) {
            const staticBooks = (fallbackBooks || []).map((b) => ({
                schemaVersion: 2,
                id: String(b.id || b.coverId),
                mediaType: 'book',
                title: b.title,
                author: b.author || (Array.isArray(b.authors) ? b.authors[0] : ''),
                creators: b.authors || (b.author ? [b.author] : []),
                cover: b.cover || '',
                coverUrl: b.cover || '',
                status: b.status || 'completed',
                rating: b.rating || 0,
                ratingScale: 5,
                genres: b.genres || [],
                platforms: [],
                platform: '',
                hoursPlayed: 0,
                pages: b.pages || 0,
                currentPage: b.currentPage || 0,
                progress: b.progress || 0,
                favorite: Boolean(b.favorite),
                publishedAt: b.updatedAtISO || new Date().toISOString(),
            }));

            const staticGames = (fallbackGames || []).map((g) => ({
                schemaVersion: 2,
                id: String(g.id),
                mediaType: 'game',
                title: g.title,
                author: '',
                creators: [],
                cover: g.cover || '',
                coverUrl: g.cover || '',
                status: g.status || 'playing',
                rating: g.rating || 0,
                ratingScale: 10,
                genres: g.genres || [],
                platforms: g.platforms || [],
                platform: g.platform || '',
                hoursPlayed: g.hoursPlayed || 0,
                pages: 0,
                currentPage: 0,
                progress: 0,
                finishedOn: g.finishedOn || '',
                favorite: false,
                publishedAt: new Date().toISOString(),
            }));

            list = [...staticBooks, ...staticGames];
        }

        onUpdate(list);
    };

    emit();

    const handleStorage = (e) => {
        if (!e || e.key === LS_PUBLIC_SHELF_KEY || e.key === 'diary_games_v1' || e.key === 'diary_books_v1') {
            emit();
        }
    };
    if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorage);
    }

    if (!db || !ownerUid) {
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('storage', handleStorage);
            }
        };
    }

    try {
        const shelfRef = collection(db, 'publicProfiles', String(ownerUid).trim(), 'shelf');
        const unsub = onSnapshot(
            shelfRef,
            (snapshot) => {
                latestCloudItems = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                }));
                emit();
            },
            (error) => {
                console.warn('observePublicShelf fallback to local/fallback data:', error.message);
                emit();
            }
        );
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('storage', handleStorage);
            }
            unsub();
        };
    } catch (err) {
        console.warn('observePublicShelf initialization error:', err.message);
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('storage', handleStorage);
            }
        };
    }
}

/**
 * Subscribes to the public highlights for an owner UID.
 * Reads strictly from publicProfiles/{ownerUid}/highlights.
 *
 * @param {string} ownerUid
 * @param {function} onUpdate Callback receiving array of highlights
 * @returns {function} unsubscribe function
 */
export function observePublicHighlights(ownerUid, onUpdate) {
    if (!onUpdate || typeof onUpdate !== 'function') return () => {};
    let latestCloud = [];

    const emit = () => {
        const local = readJson(LS_PUBLIC_HIGHLIGHTS_KEY, {});
        const map = new Map();
        latestCloud.forEach((h) => {
            if (h && h.id) map.set(String(h.id), h);
        });
        Object.entries(local).forEach(([id, h]) => {
            if (h) map.set(String(id), { ...h, id });
        });
        onUpdate(Array.from(map.values()));
    };

    emit();

    if (!db || !ownerUid) {
        return () => {};
    }

    try {
        const highlightsRef = collection(db, 'publicProfiles', String(ownerUid).trim(), 'highlights');
        const unsub = onSnapshot(
            highlightsRef,
            (snapshot) => {
                latestCloud = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
                emit();
            },
            (error) => {
                console.warn('observePublicHighlights error:', error.message);
                emit();
            }
        );
        return unsub;
    } catch {
        return () => {};
    }
}
