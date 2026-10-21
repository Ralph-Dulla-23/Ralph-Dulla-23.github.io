import { getDiaryRepository } from '../lib/db.js';
import { reportFirestoreError } from '../lib/permissionDiagnostics.js';

// A single Firestore listener per signed-in owner, reused while switching diary tabs.
// The warm cache avoids tearing down and re-fetching the same session collection on
// every route transition. It contains *private* data and must be cleared on sign-out.
const feeds = new Map();
const WARM_MS = 12_000;
const INITIAL = Object.freeze({
    sessions: Object.freeze([]),
    loading: false,
    error: null,
    metadata: Object.freeze({ hasPendingWrites: false, fromCache: false }),
});

export function createSessionFeed(uid, subscribeRemote, idleMs = WARM_MS, onIdle = () => {}) {
    let snapshot = { ...INITIAL, loading: true };
    let unsubscribe = null;
    let disposeTimer = null;
    const listeners = new Set();
    const emit = (next) => {
        snapshot = next;
        listeners.forEach((listener) => listener());
    };
    const connect = () => {
        if (unsubscribe) return;
        try {
            unsubscribe = subscribeRemote(
                uid,
                (result) => emit({
                    sessions: result.sessions || [],
                    loading: false,
                    error: null,
                    metadata: result.metadata || INITIAL.metadata,
                }),
                (error) => {
                    reportFirestoreError(error, 'reading and gaming sessions');
                    emit({ ...snapshot, loading: false, error });
                },
            );
        } catch (error) {
            reportFirestoreError(error, 'reading and gaming sessions');
            emit({ ...snapshot, loading: false, error });
        }
    };
    return {
        snapshot: () => snapshot,
        subscribe: (listener) => {
            if (disposeTimer) { clearTimeout(disposeTimer); disposeTimer = null; }
            listeners.add(listener);
            if (listeners.size === 1) connect();
            return () => {
                if (!listeners.delete(listener)) return;
                if (!listeners.size) {
                    disposeTimer = setTimeout(() => {
                        if (listeners.size) return;
                        unsubscribe?.();
                        unsubscribe = null;
                        onIdle();
                    }, idleMs);
                }
            };
        },
        clear: () => {
            if (disposeTimer) clearTimeout(disposeTimer);
            disposeTimer = null;
            unsubscribe?.();
            unsubscribe = null;
            listeners.clear();
            snapshot = INITIAL;
        },
    };
}

export function getSessionFeed(uid) {
    if (!uid) return null;
    if (!feeds.has(uid)) {
        const open = (ownerUid, onNext, onError) => getDiaryRepository(ownerUid).observeSessions({}, onNext, onError);
        const feed = createSessionFeed(uid, open, WARM_MS, () => { if (feeds.get(uid) === feed) feeds.delete(uid); });
        feeds.set(uid, feed);
    }
    return feeds.get(uid);
}

export function clearSessionFeeds() {
    for (const feed of feeds.values()) feed.clear();
    feeds.clear();
}

export const emptySessionSnapshot = INITIAL;
