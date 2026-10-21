/** Pure, deterministic migration from older books/{id}/sessions into canonical sessions.
 * Keeps legacy originals intact. Excludes Bookmory range summaries and unknown dates.
 */
export function previewLegacySessionMigration(allSessions = [], canonicalSessions = []) {
  const existing = new Set(canonicalSessions.map(s => String(s.id)));
  const eligible = [], skipped = [];
  for (const record of allSessions) {
    const id = String(record?.id || '');
    const itemId = String(record?.libraryItemId || record?.bookId || record?.mediaId || '');
    const isSynthetic = record?.isDailySession === false || record?.source === 'bookmory' || /^bookmory_/i.test(id);
    const isCanonical = record?.schemaVersion === 2 && Number.isInteger(record?.activeSeconds);
    const hasDate = typeof record?.startedAt === 'string' && Number.isFinite(Date.parse(record.startedAt));
    if (!id || /[/\\]/.test(id) || !itemId || /[/\\]/.test(itemId) || isSynthetic || !hasDate || isCanonical || existing.has(id)) {
      skipped.push({ id, reason: isSynthetic ? 'Imported aggregate must not become a dated session' : 'Already canonical or incomplete record' });
      continue;
    }
    const seconds = record?.activeSeconds != null ? Number(record.activeSeconds) :
      record?.durationSeconds != null ? Number(record.durationSeconds) : Number(record?.minutes || 0) * 60;
    if (!Number.isFinite(seconds) || seconds < 0) { skipped.push({ id, reason: 'Invalid duration' }); continue; }
    eligible.push({ schemaVersion:2, id, libraryItemId:itemId, mediaType:'book', source:'manual',
      isDailySession:true, timezone:'Asia/Manila', startedAt:record.startedAt,
      activeSeconds:Math.round(seconds), pagesRead:Math.max(0, Number(record?.pagesRead ?? (Number(record?.toPage || 0) - Number(record?.fromPage || 0))) || 0),
      fromPage:record?.fromPage == null ? null : Number(record.fromPage),
      toPage:record?.toPage == null ? null : Number(record.toPage),
      provenance:{source:'legacy_book_session', sourceKey:id} });
    existing.add(id);
  }
  return { eligible, skipped };
}
