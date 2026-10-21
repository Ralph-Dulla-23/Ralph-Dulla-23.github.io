/** Bookmory markdown parser. Import data is owner-private, never bundled with public UI. */
const STATUS_MAP = Object.freeze({
  "i've read it all!": 'completed', read: 'completed', completed: 'completed',
  'to read': 'want-to-read', 'want-to-read': 'want-to-read',
  reading: 'reading', 'gave up': 'dropped', dropped: 'dropped', paused: 'paused',
});

export function toIsoDate(value) {
  const match = String(value ?? '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const date = `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  const check = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(check.valueOf()) && check.toISOString().slice(0, 10) === date ? date : null;
}
export function toMinutes(value) {
  const h = String(value || '').match(/(\d+)\s*h/i);
  const m = String(value || '').match(/(\d+)\s*m/i);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}
export const normTitle = (value) => String(value || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '');
const cleanSpaces = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const field = (block, label) => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = block.match(new RegExp(`^(?:-\\s*)?${escaped}:[ \\t]*(.*)$`, 'im'));
  return m ? m[1].trim() : '';
};
export function stableBookmoryId(seed) {
  // Stable FNV-1a derived ID for idempotent imports; avoids randomUUID per import.
  let hash = 2166136261;
  for (const char of String(seed)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `bookmory_${(hash >>> 0).toString(36)}`;
}
export function parseBookmoryMarkdownPure(markdownText, options = {}) {
  if (typeof markdownText !== 'string' || !markdownText.trim()) return null;
  const text = markdownText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const info = text.split(/^###\s*Book information\s*$/im)[1]?.split(/^\*\*\*\s*$/m)[0] || text;
  const title = cleanSpaces(field(info, 'Title'));
  if (!title) return null;
  const authorsRaw = field(info, 'Authors');
  const authors = authorsRaw.split(',').map(cleanSpaces).filter(Boolean);
  const pagesMatch = field(info, 'Total pages').replace(/,/g, '').match(/\d+/);
  const totalPages = pagesMatch && Number(pagesMatch[0]) > 0 ? Number(pagesMatch[0]) : null;
  const isbn = field(info, 'ISBN').replace(/[^0-9Xx]/g, '') || null;
  const status = STATUS_MAP[field(info, 'Status').toLowerCase()] || 'want-to-read';
  const collections = field(info, 'Collections');
  const tags = Array.from(new Set((field(info, 'Tags in use').match(/#([^\s#]+)/g) || []).map((v) => v.slice(1).trim())));
  const publisher = cleanSpaces(field(info, 'Publisher')) || null;
  const publicationDate = toIsoDate(field(info, 'Publication date'));
  const language = cleanSpaces(field(info, 'Language')) || null;
  const bookFormat = cleanSpaces(field(info, 'Book type')) || null;
  const wishlist = /^yes$/i.test(field(info, 'Wishlist'));
  const sourceKey = isbn ? `isbn_${isbn}` : `title_${normTitle(title)}_${normTitle(authorsRaw)}`;
  const id = options.id || stableBookmoryId(sourceKey);

  const logs = [...text.matchAll(/^###\s*Reading log\s*\d*\s*$/gim)].map((m, i, all) => {
    const blockEnd = all[i + 1]?.index ?? text.length;
    const after = text.slice(m.index + m[0].length, blockEnd).split(/^###\s*Purchase logs/m)[0];
    const [startRaw, endRaw] = field(after, 'Read period').split('~');
    const rating = Number(field(after, 'Star ratings')) || 0;
    return { logIndex: i + 1, start: toIsoDate(startRaw), end: toIsoDate(endRaw),
      rating: rating > 0 ? rating : null, minutes: toMinutes(field(after, 'Total read time')),
      comment: field(after, 'Comment') };
  });
  const purchases = [...text.matchAll(/^###\s*Purchase logs\s*#?\d*\s*$/gim)].map((m, i, all) => {
    const after = text.slice(m.index + m[0].length, all[i + 1]?.index ?? text.length);
    const priceRaw = field(after, 'Price');
    const amountMatch = priceRaw.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    const amount = amountMatch ? Number(amountMatch[0]) : null;
    const currency = priceRaw.includes('₱') ? 'PHP' : (priceRaw.includes('$') ? 'USD' : null);
    return { id: `${id}_purchase_${i + 1}`, date: toIsoDate(field(after, 'Purchased day')),
      store: cleanSpaces(field(after, 'Purchased from')) || null, amount, currency,
      memo: field(after, 'Memo') || null };
  });

  const latestRating = [...logs].reverse().find((log) => log.rating)?.rating || null;
  const startedOn = logs.find((log) => log.start)?.start || null;
  const finishedOn = status === 'completed' ? ([...logs].reverse().find((log) => log.end)?.end || null) : null;
  const item = {
    schemaVersion: 2, id, mediaType: 'book', title, creators: authors.length ? authors : ['Unknown Author'],
    isbn, status, rating: latestRating, ratingScale: 5, favorite: /favorite/i.test(collections),
    tags, genres: tags, wishlist, publisher, publicationDate, language, bookFormat,
    purchases, bookmoryLogCount: logs.length, startedOn, finishedOn,
    progress: { unit: 'page', current: status === 'completed' && totalPages !== null ? totalPages : 0, total: totalPages },
    visibility: 'private', provenance: { source: 'bookmory', sourceKey },
  };
  const attempts = logs.map((log, index) => {
    const isLast = index === logs.length - 1;
    const attemptStatus = isLast && status !== 'completed'
      ? (status === 'dropped' ? 'abandoned' : 'in_progress') : 'completed';
    return { schemaVersion: 2, id: `${id}_attempt_${index + 1}`, libraryItemId: id,
      ordinal: index + 1, status: attemptStatus, startedOn: log.start,
      completedOn: attemptStatus === 'completed' ? (log.end || log.start) : null,
      rating: log.rating, progress: { unit: 'page', current: attemptStatus === 'completed' ? totalPages || 0 : 0, total: totalPages },
      provenance: { source: 'bookmory', sourceKey, logOrdinal: log.logIndex } };
  });
  // Never synthesize a completion date when source export lacks reading logs.
  const historicalAggregates = logs.filter((log) => log.minutes > 0).map((log) => ({
    schemaVersion: 2, id: `${id}_aggregate_${log.logIndex}`, mediaId: id, mediaType: 'book',
    isDailySession: false, totalMinutes: log.minutes, dateRange: { start: log.start, end: log.end },
    notes: log.comment || null, provenance: { source: 'bookmory', sourceKey, logOrdinal: log.logIndex },
  }));
  const journalEntries = logs.filter((log) => log.comment?.trim()).map((log) => ({
    schemaVersion: 2, id: `${id}_review_${log.logIndex}`, linkedMediaId: id,
    mediaType: 'book', type: 'review', body: log.comment.trim(), visibility: 'private',
    date: log.end || log.start || null,
    provenance: { source: 'bookmory', sourceKey, logOrdinal: log.logIndex },
  }));
  return { item, attempts, historicalAggregates, journalEntries,
    raw: { title, authors: authorsRaw, totalPages: field(info, 'Total pages'), isbn,
      collections, status: field(info, 'Status'), logs, purchases } };
}
