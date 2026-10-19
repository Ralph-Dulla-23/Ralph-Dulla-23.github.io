import {
    doc as defaultDoc,
    setDoc as defaultSetDoc,
    getDoc as defaultGetDoc,
    deleteDoc as defaultDeleteDoc,
    collection as defaultCollection,
    onSnapshot as defaultOnSnapshot,
    getDocs as defaultGetDocs,
} from 'firebase/firestore';

import {
    validateLibraryItem,
    validateAttempt,
    validateSession,
    validateHistoricalAggregate,
    validateJournalEntry,
} from '../validators.js';
import { toPublicShelfItem, toPublicHighlight } from '../publicProjection.js';
import { isValidId } from '../id.js';
import { determineSyncState } from './syncStatus.js';

/**
 * Creates the canonical v2 DiaryRepository bound to a verified owner UID.
 * Enforces pure validation, Firestore subcollection paths, and sync metadata.
 *
 * @param {object} params
 * @param {object} params.db - Firestore instance
 * @param {string} params.uid - Verified owner UID
 * @param {object} [params.firestoreOps] - Optional injection for testing mocks
 * @returns {object} DiaryRepository interface
 */
export function createDiaryRepository({ db, uid, firestoreOps = {} }) {
    if (!uid || typeof uid !== 'string' || uid.trim() === '') {
        throw new Error('A valid owner UID is required to access DiaryRepository (SEC-01).');
    }

    const trimmedUid = uid.trim();
    const docFn = firestoreOps.doc || defaultDoc;
    const setDocFn = firestoreOps.setDoc || defaultSetDoc;
    const getDocFn = firestoreOps.getDoc || defaultGetDoc;
    const deleteDocFn = firestoreOps.deleteDoc || defaultDeleteDoc;
    const collectionFn = firestoreOps.collection || defaultCollection;
    const onSnapshotFn = firestoreOps.onSnapshot || defaultOnSnapshot;
    const getDocsFn = firestoreOps.getDocs || defaultGetDocs;

    let currentSyncState = {
        isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        hasPendingWrites: false,
        error: null,
    };

    return {
        get uid() {
            return trimmedUid;
        },

        getSyncStatus() {
            return {
                ...currentSyncState,
                state: determineSyncState(currentSyncState),
            };
        },

        /**
         * Saves a canonical LibraryItem (book or game).
         */
        async saveLibraryItem(item) {
            const validation = validateLibraryItem(item);
            if (!validation.valid) {
                throw new Error(`Validation failed for LibraryItem: ${validation.errors.join('; ')}`);
            }

            const docRef = docFn(db, 'users', trimmedUid, 'libraryItems', item.id);
            await setDocFn(docRef, item);
            return { success: true, id: item.id };
        },

        /**
         * Fetches a canonical LibraryItem by ID.
         */
        async getLibraryItem(id) {
            if (!isValidId(id)) return null;
            const docRef = docFn(db, 'users', trimmedUid, 'libraryItems', id);
            const snap = await getDocFn(docRef);
            return snap.exists() ? snap.data() : null;
        },

        /**
         * Deletes a canonical LibraryItem by ID.
         */
        async deleteLibraryItem(id) {
            if (!isValidId(id)) throw new Error('Invalid item ID.');
            const docRef = docFn(db, 'users', trimmedUid, 'libraryItems', id);
            await deleteDocFn(docRef);
            return { success: true, id };
        },

        /**
         * Subscribes to real-time LibraryItem collection updates.
         */
        observeLibraryItems(filter = {}, callback) {
            const colRef = collectionFn(db, 'users', trimmedUid, 'libraryItems');
            return onSnapshotFn(colRef, (snapshot) => {
                const hasPendingWrites = Boolean(snapshot.metadata?.hasPendingWrites);
                const fromCache = Boolean(snapshot.metadata?.fromCache);

                currentSyncState.hasPendingWrites = hasPendingWrites;

                let items = snapshot.docs.map((d) => (typeof d.data === 'function' ? d.data() : d));
                if (filter.mediaType) {
                    items = items.filter((i) => i.mediaType === filter.mediaType);
                }
                if (filter.status) {
                    items = items.filter((i) => i.status === filter.status);
                }

                callback({
                    items,
                    metadata: { hasPendingWrites, fromCache },
                });
            });
        },

        /**
         * Creates or updates a canonical Attempt.
         */
        async createAttempt(attempt) {
            const validation = validateAttempt(attempt);
            if (!validation.valid) {
                throw new Error(`Validation failed for Attempt: ${validation.errors.join('; ')}`);
            }

            const docRef = docFn(db, 'users', trimmedUid, 'attempts', attempt.id);
            await setDocFn(docRef, attempt);
            return { success: true, id: attempt.id };
        },

        /**
         * Creates a canonical Session (timed or manual).
         */
        async createSession(session) {
            const validation = validateSession(session);
            if (!validation.valid) {
                throw new Error(`Validation failed for Session: ${validation.errors.join('; ')}`);
            }

            const docRef = docFn(db, 'users', trimmedUid, 'sessions', session.id);
            await setDocFn(docRef, session);
            return { success: true, id: session.id };
        },

        /**
         * Subscribes to real-time canonical sessions at users/{uid}/sessions.
         */
        observeSessions(filter = {}, callback, onError) {
            const colRef = collectionFn(db, 'users', trimmedUid, 'sessions');
            return onSnapshotFn(
                colRef,
                (snapshot) => {
                    const hasPendingWrites = Boolean(snapshot.metadata?.hasPendingWrites);
                    const fromCache = Boolean(snapshot.metadata?.fromCache);

                    currentSyncState.hasPendingWrites = hasPendingWrites;

                    let sessions = snapshot.docs.map((d) => (typeof d.data === 'function' ? d.data() : d));
                    if (filter.mediaType) {
                        sessions = sessions.filter((s) => s.mediaType === filter.mediaType);
                    }
                    if (filter.libraryItemId) {
                        sessions = sessions.filter(
                            (s) => s.libraryItemId === filter.libraryItemId || s.itemId === filter.libraryItemId
                        );
                    }

                    callback({
                        sessions,
                        metadata: { hasPendingWrites, fromCache },
                    });
                },
                onError
            );
        },

        /**
         * Fetches all canonical sessions for a specific library item.
         */
        async getSessionsForItem(itemId) {
            if (!isValidId(itemId)) return [];
            let docs = [];
            if (firestoreOps.store && !firestoreOps.getDocs) {
                const prefix = `users/${trimmedUid}/sessions`;
                docs = Array.from(firestoreOps.store.entries())
                    .filter(([p]) => p.startsWith(prefix))
                    .map(([, data]) => data);
            } else {
                const colRef = collectionFn(db, 'users', trimmedUid, 'sessions');
                const snap = await getDocsFn(colRef);
                docs = snap.docs.map((d) => (typeof d.data === 'function' ? d.data() : d));
            }
            return docs.filter((s) => s.libraryItemId === itemId || s.itemId === itemId);
        },

        /**
         * Deletes a canonical Session by ID.
         */
        async deleteSession(sessionId) {
            if (!isValidId(sessionId)) throw new Error('Invalid session ID.');
            const docRef = docFn(db, 'users', trimmedUid, 'sessions', sessionId);
            await deleteDocFn(docRef);
            return { success: true, id: sessionId };
        },

        /**
         * Creates a HistoricalAggregate (isDailySession strictly false).
         */
        async createHistoricalAggregate(aggregate) {
            const validation = validateHistoricalAggregate(aggregate);
            if (!validation.valid) {
                throw new Error(`Validation failed for HistoricalAggregate: ${validation.errors.join('; ')}`);
            }

            const docRef = docFn(db, 'users', trimmedUid, 'historicalAggregates', aggregate.id);
            await setDocFn(docRef, aggregate);
            return { success: true, id: aggregate.id };
        },

        /**
         * Creates a JournalEntry (strictly private).
         */
        async createJournalEntry(entry) {
            const validation = validateJournalEntry(entry);
            if (!validation.valid) {
                throw new Error(`Validation failed for JournalEntry: ${validation.errors.join('; ')}`);
            }

            const docRef = docFn(db, 'users', trimmedUid, 'journalEntries', entry.id);
            await setDocFn(docRef, entry);
            return { success: true, id: entry.id };
        },

        /**
         * Subscribes to JournalEntry collection updates.
         */
        observeJournalEntries(filter = {}, callback) {
            const colRef = collectionFn(db, 'users', trimmedUid, 'journalEntries');
            return onSnapshotFn(colRef, (snapshot) => {
                let entries = snapshot.docs.map((d) => (typeof d.data === 'function' ? d.data() : d));
                if (filter.linkedMediaId) {
                    entries = entries.filter((e) => e.linkedMediaId === filter.linkedMediaId);
                }
                callback({
                    entries,
                    metadata: {
                        hasPendingWrites: Boolean(snapshot.metadata?.hasPendingWrites),
                        fromCache: Boolean(snapshot.metadata?.fromCache),
                    },
                });
            });
        },

        /**
         * Deletes a JournalEntry by ID.
         */
        async deleteJournalEntry(id) {
            if (!isValidId(id)) throw new Error('Invalid journal entry ID.');
            const docRef = docFn(db, 'users', trimmedUid, 'journalEntries', id);
            await deleteDocFn(docRef);
            return { success: true, id };
        },

        /**
         * Publishes a sanitized snapshot of a library item to the public shelf.
         * Path: publicProfiles/{uid}/shelf/{id}
         */
        async publishLibraryItem(item, options = {}) {
            if (!item || !isValidId(item.id)) throw new Error('Invalid item to publish.');
            const sanitized = toPublicShelfItem(item, options);
            const docRef = docFn(db, 'publicProfiles', trimmedUid, 'shelf', item.id);
            await setDocFn(docRef, sanitized);
            return { success: true, id: item.id, item: sanitized };
        },

        /**
         * Unpublishes a library item from the public shelf.
         */
        async unpublishLibraryItem(id) {
            if (!isValidId(id)) throw new Error('Invalid item ID to unpublish.');
            const docRef = docFn(db, 'publicProfiles', trimmedUid, 'shelf', id);
            await deleteDocFn(docRef);
            return { success: true, id };
        },

        /**
         * Publishes a sanitized highlight / quote.
         * Path: publicProfiles/{uid}/highlights/{id}
         */
        async publishHighlight(entry, options = {}) {
            if (!entry || !isValidId(entry.id)) throw new Error('Invalid highlight entry to publish.');
            const sanitized = toPublicHighlight(entry, options);
            const docRef = docFn(db, 'publicProfiles', trimmedUid, 'highlights', entry.id);
            await setDocFn(docRef, sanitized);
            return { success: true, id: entry.id, highlight: sanitized };
        },

        /**
         * Unpublishes a highlight.
         */
        async unpublishHighlight(id) {
            if (!isValidId(id)) throw new Error('Invalid highlight ID to unpublish.');
            const docRef = docFn(db, 'publicProfiles', trimmedUid, 'highlights', id);
            await deleteDocFn(docRef);
            return { success: true, id };
        },
    };
}
