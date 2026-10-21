import { doc, getDoc, updateDoc, serverTimestamp, waitForPendingWrites } from 'firebase/firestore';
import { db, auth } from '../lib/firebase.js';
import { toPublicShelfItem } from '../domain/publicProjection.js';

// Contains identifiers only, never private notes or journal data.
const QUEUE_KEY = 'diary_public_refresh_pending_v1';
let running = null;

function readQueue() {
    try {
        const stored = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
        return Array.isArray(stored) ? stored : [];
    } catch { return []; }
}
function writeQueue(items) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(items)); } catch { /* Storage can be disabled. */ }
}

/** Queue a refresh; NEVER create a new public shelf record from an ordinary private save. */
export function queuePublishedItemRefresh(uid, type, id) {
    if (!uid || !id || !['book', 'game'].includes(type)) return;
    const items = readQueue();
    if (!items.some((item) => item.uid === uid && item.type === type && item.id === id)) {
        items.push({ uid, type, id });
        writeQueue(items);
    }
}

/**
 * A private edit updates the PUBLIC projection only if the user previously published it.
 * updateDoc (not setDoc) ensures we cannot accidentally republish a removed item.
 * A failure leaves the identifier in the retry list rather than silently forgetting it.
 */
export async function flushPublishedItemRefreshes() {
    if (running) return running;
    if (!db || !auth?.currentUser || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    running = (async () => {
        const attempted = new Set();
        while (true) {
          const entries = readQueue().filter(({ uid, type, id }) => !attempted.has(`${uid}:${type}:${id}`));
          if (!entries.length) break;
          // Never publish stale metadata ahead of offline private writes.
          // Firestore restores durable pending writes after reconnect/restart.
          try {
              await waitForPendingWrites(db);
          } catch (error) {
              console.warn('Published shelf refresh is waiting for successful private synchronization:', error?.code || error?.message);
              break;
          }
          for (const entry of entries) {
            attempted.add(`${entry.uid}:${entry.type}:${entry.id}`);
            if (auth.currentUser?.uid !== entry.uid) continue;
            const path = entry.type === 'book' ? 'books' : 'games';
            try {
                const shelfRef = doc(db, 'publicProfiles', entry.uid, 'shelf', entry.id);
                const publicSnapshot = await getDoc(shelfRef);
                if (publicSnapshot.exists()) {
                    const old = publicSnapshot.data();
                    const original = await getDoc(doc(db, 'users', entry.uid, path, entry.id));
                    if (original.exists()) {
                        const prefs = old.publicOptions || {
                            showStatus: old.status !== null,
                            showRating: old.rating !== null,
                            showTags: true,
                        };
                        const projected = toPublicShelfItem({ ...original.data(), id: entry.id, mediaType: entry.type }, prefs);
                        await updateDoc(shelfRef, {
                            ...projected,
                            publishedAt: old.publishedAt || projected.publishedAt,
                            publicOptions: prefs,
                            updatedAt: serverTimestamp(),
                        });
                    }
                }
                // A missing public document means the item remains PRIVATE. Clear request.
                writeQueue(readQueue().filter((item) => !(item.uid === entry.uid && item.type === entry.type && item.id === entry.id)));
            } catch (error) {
                // A failed projection is not a failed private save. Retain retry state.
                console.warn('Published shelf refresh pending:', error?.code || error?.message);
            }
          }
        }
    })().finally(() => { running = null; });
    return running;
}

export function startPublishedItemAutoRefresh() {
    if (typeof window === 'undefined') return () => {};
    const tryFlush = () => { void flushPublishedItemRefreshes(); };
    window.addEventListener('online', tryFlush);
    return () => window.removeEventListener('online', tryFlush);
}
