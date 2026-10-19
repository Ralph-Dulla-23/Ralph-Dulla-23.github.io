import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import fallbackBooks from '../data/books';

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

        let list = Array.from(map.values());

        // Fallback: If no public items exist yet, use sanitized static fallback books
        // to maintain the developer portfolio showcase
        if (list.length === 0 && fallbackBooks && fallbackBooks.length > 0) {
            list = fallbackBooks.map((b) => ({
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
        }

        onUpdate(list);
    };

    emit();

    if (!db || !ownerUid) {
        return () => {};
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
        return unsub;
    } catch (err) {
        console.warn('observePublicShelf initialization error:', err.message);
        return () => {};
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
