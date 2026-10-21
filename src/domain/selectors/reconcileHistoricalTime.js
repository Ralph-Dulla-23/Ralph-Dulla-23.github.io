/** Prevent counting an undated Bookmory summary again when its underlying native
 * timer logs are available as precise canonical sessions for the same book.
 * Excess summary minutes (if any) stay explicitly undated and unallocated.
 */
const minutes = (s) => Number.isFinite(Number(s?.activeSeconds)) ? Math.max(0,Number(s.activeSeconds)/60) : 0;
export function reconcileBookmoryHistoricalTime(aggregates = [], sessions = []) {
  const nativeByBook = new Map();
  for (const session of sessions || []) {
    if (session?.provenance?.source !== 'bookmory_native_timer') continue;
    const id = String(session.libraryItemId || session.mediaId || '');
    if (id) nativeByBook.set(id,(nativeByBook.get(id)||0)+minutes(session));
  }
  const historicByBook = new Map();
  let unlinkedUndatedMinutes = 0;
  for (const record of aggregates || []) {
    if (record?.isDailySession !== false || record?.mediaType !== 'book') continue;
    const id = String(record.mediaId || record.libraryItemId || '');
    const value = Number(record.totalMinutes);
    if (!id) { if (Number.isFinite(value) && value > 0) unlinkedUndatedMinutes += value; continue; }
    if (Number.isFinite(value) && value > 0) historicByBook.set(id,(historicByBook.get(id)||0)+value);
  }
  let undatedMinutes = unlinkedUndatedMinutes, reconciledMinutes = 0;
  for (const [id,total] of historicByBook) {
    const matched = Math.min(total,nativeByBook.get(id)||0);
    undatedMinutes += total-matched;
    reconciledMinutes += matched;
  }
  return { undatedMinutes:Math.round(undatedMinutes*10)/10, reconciledMinutes:Math.round(reconciledMinutes*10)/10 };
}
