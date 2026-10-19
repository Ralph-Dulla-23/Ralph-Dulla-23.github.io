import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDiaryRepository } from '../lib/db';

/**
 * Custom React hook for subscribing to canonical real-time diary sessions.
 *
 * @param {object} [filter] Optional filter options ({ mediaType, libraryItemId })
 * @returns {{ sessions: Array, loading: boolean, error: Error|null, metadata: object }}
 */
export function useDiarySessions(filter = {}) {
    const { user } = useAuth();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(Boolean(user?.uid));
    const [error, setError] = useState(null);
    const [metadata, setMetadata] = useState({ hasPendingWrites: false, fromCache: false });

    // Memoize filter keys to prevent re-subscriptions on fresh object references
    const memoFilter = useMemo(() => ({
        mediaType: filter?.mediaType,
        libraryItemId: filter?.libraryItemId,
    }), [filter?.mediaType, filter?.libraryItemId]);

    useEffect(() => {
        if (!user?.uid) return;

        const repository = getDiaryRepository(user.uid);
        const unsubscribe = repository.observeSessions(
            memoFilter,
            (snapshot) => {
                setSessions(snapshot.sessions || []);
                setMetadata(snapshot.metadata || { hasPendingWrites: false, fromCache: false });
                setLoading(false);
            },
            (err) => {
                console.error('Failed to subscribe to canonical sessions:', err);
                setError(err);
                setLoading(false);
            }
        );

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [user?.uid, memoFilter]);

    return {
        sessions: user?.uid ? sessions : [],
        loading: user?.uid ? loading : false,
        error,
        metadata,
    };
}

export default useDiarySessions;
