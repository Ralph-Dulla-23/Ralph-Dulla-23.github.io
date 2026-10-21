import { doc, getDocFromServer, setDoc, Timestamp } from 'firebase/firestore';

// Owner-only, additive disaster recovery. No delete or overwrite operation exists.
const CANONICAL = ['libraryItems', 'attempts', 'sessions', 'historicalAggregates', 'journalEntries', 'journal', 'goals'];
const PUBLIC = ['shelf', 'highlights'];
const validId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 512 && id !== '.' && id !== '..' && !id.includes('/');
const clean = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid document content in backup.');
  const { id: _id, ...fields } = data;
  void _id;
  const visit = (value) => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;
    // Round-trip SDK timestamps serialized into a JSON backup.
    if (Number.isInteger(value.seconds) && Number.isInteger(value.nanoseconds) && Object.keys(value).every(k => ['seconds', 'nanoseconds'].includes(k))) {
      return new Timestamp(value.seconds, value.nanoseconds);
    }
    return Object.fromEntries(Object.entries(value).filter(([,v]) => v !== undefined).map(([key,v]) => [key,visit(v)]));
  };
  return visit(fields);
};

export function buildDiaryRestorePlan(backup, uid, { includePublic = false } = {}) {
  if (!backup || !/^2(?:\.|$)/.test(String(backup.version || ''))) throw new Error('Only version 2 JSON diary backups are supported.');
  if (!validId(uid) || backup.uid !== uid) throw new Error('Backup owner UID does not match the currently signed-in owner.');
  if (backup.isCloudComplete !== true) throw new Error('This backup was marked partial. Restore it only after first creating a verified complete backup.');
  const docs = new Map();
  const add = (path, record, preferServer = false) => {
    const parts = path.split('/');
    if (parts.some(part => !validId(part)) || parts.length % 2 !== 0) throw new Error('Invalid Firestore document path in backup.');
    // Reject competing data for a path rather than silently choosing one.
    if (docs.has(path) && !preferServer) return;
    docs.set(path, { path, data: clean(record) });
    if (docs.size > 20000) throw new Error('Unreasonably large backup; stop to review before restoring.');
  };
  for (const category of ['books', 'games']) {
    for (const record of backup[category] || []) {
      if (!validId(record?.id)) throw new Error(`Invalid ${category} ID.`);
      const { privateNotes, privateReview, sessions, ...item } = record;
      add(`users/${uid}/${category}/${record.id}`, item);
      // Older backup formats may contain nested data flattened onto parents.
      if (typeof privateNotes === 'string') add(`users/${uid}/books/${record.id}/private/notes`, { notes: privateNotes });
      if (typeof privateReview === 'string') add(`users/${uid}/games/${record.id}/private/notes`, { review: privateReview });
      if (category === 'books') for (const s of sessions || []) {
        if (validId(s?.id)) add(`users/${uid}/books/${record.id}/sessions/${s.id}`, s);
      }
    }
  }
  for (const category of CANONICAL) for (const record of backup.canonicalData?.[category] || []) {
    if (!validId(record?.id)) throw new Error(`Invalid ID in ${category} collection.`);
    add(`users/${uid}/${category}/${record.id}`, record);
  }
  for (const category of ['books', 'games']) {
    for (const [parentId, nested] of Object.entries(backup.nestedData?.[category] || {})) {
      if (!validId(parentId)) throw new Error('Invalid nested parent ID.');
      for (const [childCategory, values] of Object.entries(nested || {})) {
        if (!['private','sessions'].includes(childCategory)) throw new Error('Unsupported nested collection.');
        if (childCategory === 'sessions' && category !== 'books') throw new Error('Unexpected game session subcollection.');
        for (const record of values || []) {
          if (!validId(record?.id)) throw new Error('Invalid nested document ID.');
          add(`users/${uid}/${category}/${parentId}/${childCategory}/${record.id}`, record, true);
        }
      }
    }
  }
  if (includePublic) for (const category of PUBLIC) for (const record of backup.publicData?.[category] || []) {
    if (!validId(record?.id)) throw new Error('Invalid published item ID.');
    add(`publicProfiles/${uid}/${category}/${record.id}`, record);
  }
  return { uid, documentCount: docs.size, includesPublic: Boolean(includePublic), documents: [...docs.values()] };
}

export async function restoreDiaryBackup(db, plan, onProgress) {
  if (!db || !plan?.uid || !Array.isArray(plan.documents)) throw new Error('Invalid restore operation.');
  let restored = 0, skipped = 0;
  // Write a missing document only after checking the server. Never replace an existing one.
  // Re-running after interruption is safe; progress is reported rather than hidden.
  for (const record of plan.documents) {
    if (!record.path.startsWith(`users/${plan.uid}/`) && !record.path.startsWith(`publicProfiles/${plan.uid}/`)) {
      throw new Error('Refusing a restore path outside the current owner.');
    }
    const ref = doc(db, ...record.path.split('/'));
    const server = await getDocFromServer(ref);
    if (server.exists()) skipped++;
    else { await setDoc(ref, record.data); restored++; }
    onProgress?.({ restored, skipped, total: plan.documentCount });
  }
  return { restored, skipped, total: plan.documentCount };
}
