import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDiaryRepository } from '../lib/db';

/** Owner-only Firestore historical aggregate subscription (never generates calendar days). */
export function useBookmoryHistory() {
  const { user } = useAuth();
  const [state, setState] = useState({ aggregates: [], error: null, loading: true });
  useEffect(() => {
    if (!user?.uid) return undefined;
    let unsubscribe;
    try {
      unsubscribe = getDiaryRepository(user.uid).observeHistoricalAggregates(
        (aggregates) => setState({ aggregates, error: null, loading: false }),
        (error) => setState((prev) => ({ ...prev, error, loading: false })),
      );
    } catch (error) {
      setState((prev) => ({ ...prev, error, loading: false }));
    }
    return () => unsubscribe?.();
  }, [user?.uid]);
  return user?.uid ? state : { aggregates: [], error: null, loading: false };
}
