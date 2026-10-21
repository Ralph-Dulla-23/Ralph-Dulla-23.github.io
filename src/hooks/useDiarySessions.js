import { useMemo, useSyncExternalStore, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSessionFeed, emptySessionSnapshot } from './sessionFeed';

/**
 * A shared, real-time canonical session feed. Screens receive filtered views
 * without opening a separate Firestore listener for each tab or detail page.
 */
export function useDiarySessions(filter = {}) {
    const { user } = useAuth();
    const uid = user?.uid;
    const feed = useMemo(() => getSessionFeed(uid), [uid]);
    const subscribe = useCallback((listener) => feed ? feed.subscribe(listener) : () => {}, [feed]);
    const getSnapshot = useCallback(() => feed ? feed.snapshot() : emptySessionSnapshot, [feed]);
    const current = useSyncExternalStore(subscribe, getSnapshot, () => emptySessionSnapshot);
    const mediaType = filter?.mediaType;
    const libraryItemId = filter?.libraryItemId;
    const sessions = useMemo(() => {
        if (!uid) return emptySessionSnapshot.sessions;
        if (!mediaType && !libraryItemId) return current.sessions;
        return current.sessions.filter((session) =>
            (!mediaType || session.mediaType === mediaType) &&
            (!libraryItemId || session.libraryItemId === libraryItemId || session.itemId === libraryItemId)
        );
    }, [uid, current.sessions, mediaType, libraryItemId]);
    return {
        sessions,
        loading: Boolean(uid) && current.loading,
        error: current.error,
        metadata: current.metadata || { hasPendingWrites: false, fromCache: false },
    };
}

export default useDiarySessions;
