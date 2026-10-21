import { collection, getDocsFromServer, limit, query } from 'firebase/firestore';
import { auth, db } from './firebase';
import { OWNER_UID } from './config';

/** Owner-initiated read-only diagnostic against deployed rules (not local rule text). */
export async function checkOwnerFirestoreAccess() {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Sign in before checking Firebase permissions.');
  if (!OWNER_UID || uid !== OWNER_UID) throw new Error('The current account is not the configured diary owner.');
  if (!db) throw new Error('Firestore is not initialized.');
  const names = ['books', 'games', 'sessions', 'goals', 'journalEntries', 'historicalAggregates'];
  const results = [];
  for (const name of names) {
    try {
      // Query only one document, never download private content for the diagnostic.
      await getDocsFromServer(query(collection(db, 'users', uid, name), limit(1)));
      results.push({ collection: name, allowed: true });
    } catch (error) {
      results.push({ collection: name, allowed: false, code: error?.code || 'unavailable' });
    }
  }
  return results;
}
