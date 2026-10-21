/** Page deltas represent dated activity; total/current book pages never imply a session. */
export function recordedPages(session = {}) {
  const n = (value) => value === '' || value === null || value === undefined ? null : Number(value);
  const direct = n(session.pagesRead);
  if (Number.isFinite(direct) && direct >= 0) return direct;
  const start = n(session.startPage ?? session.fromPage);
  const end = n(session.endPage ?? session.toPage);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0;
}
