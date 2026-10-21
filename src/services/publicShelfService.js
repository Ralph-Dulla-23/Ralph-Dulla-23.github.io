import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';

/**
 * Public portfolio data is exclusively the Firestore publicProfiles projection.
 * Never use owner localStorage, legacy users/{uid} collections, or static books
 * as an automatic substitute: those bypass explicit unpublishing controls.
 */
export function observePublicShelf(ownerUid, onUpdate, onError = () => {}) {
    if (typeof onUpdate !== 'function') return () => {};
    onUpdate([]);
    if (!db || !ownerUid) {
        onError(new Error('Public shelf unavailable: Firebase is not configured.'));
        return () => {};
    }
    try {
        return onSnapshot(
            collection(db, 'publicProfiles', String(ownerUid).trim(), 'shelf'),
            (snapshot) => {
                onUpdate(snapshot.docs.map((record) => ({ id: record.id, ...record.data() })));
            },
            (error) => {
                // Never substitute private or stale cached records after a permission error.
                onUpdate([]);
                onError(error);
                console.error('Public shelf could not be loaded:', error.code || error.message);
            }
        );
    } catch (error) {
        onError(error);
        return () => {};
    }
}

export function observePublicHighlights(ownerUid, onUpdate, onError = () => {}) {
    if (typeof onUpdate !== 'function') return () => {};
    onUpdate([]);
    if (!db || !ownerUid) {
        onError(new Error('Public highlights unavailable: Firebase is not configured.'));
        return () => {};
    }
    try {
        return onSnapshot(
            collection(db, 'publicProfiles', String(ownerUid).trim(), 'highlights'),
            (snapshot) => {
                onUpdate(snapshot.docs.map((record) => ({ id: record.id, ...record.data() })));
            },
            (error) => {
                onUpdate([]);
                onError(error);
                console.error('Public highlights could not be loaded:', error.code || error.message);
            }
        );
    } catch (error) {
        onError(error);
        return () => {};
    }
}
