/** Pure, source-aware premium analytics for books, games and combined activity. */
import { toLocalDateKey, getCurrentLocalDateKey } from '../dates.js';
import { normalizeBookStatus, normalizeGameStatus } from '../status.js';
import { reconcileBookmoryHistoricalTime } from './reconcileHistoricalTime.js';

const safeArray = (value) => Array.isArray(value) ? value : [];
const asNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const pretty = (value) => String(value || '')
  .replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
const take = (counts, max = 8) => Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max);
const count = (items, resolve) => {
  const result = {};
  for (const item of items) {
    const values = safeArray(resolve(item));
    for (const value of new Set(values.map(pretty).filter(Boolean))) result[value] = (result[value] || 0) + 1;
  }
  return result;
};
const isRealSession = (s) => s && s.isDailySession !== false && !/^bookmory_/i.test(s.id || '') &&
  s.source !== 'bookmory' && Boolean(s.startedAt || s.date);
const durationMinutes = (s) => s.activeSeconds !== undefined && s.activeSeconds !== null
  ? Math.max(0, asNumber(s.activeSeconds) / 60)
  : Math.max(0, asNumber(s.minutes) || asNumber(s.durationSeconds) / 60);
const inRange = (date, timeRange, currentDate, custom = {}) => {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (timeRange === 'custom') return Boolean(custom.from && custom.to && custom.from <= custom.to && custom.from <= date && date <= custom.to);
  return timeRange === 'month' ? date.startsWith(currentDate.slice(0, 7)) :
    timeRange === 'year' ? date.startsWith(currentDate.slice(0, 4)) : true;
};
const isBookSession = (session, ids) => session.mediaType === 'book' ||
  (session.mediaType !== 'game' && ids.has(String(session.libraryItemId || session.bookId || session.mediaId || session.itemId)));
const isGameSession = (session, ids) => session.mediaType === 'game' ||
  (session.mediaType !== 'book' && ids.has(String(session.libraryItemId || session.gameId || session.mediaId || session.itemId)));
const getDate = (s) => toLocalDateKey(s.date || s.startedAt);
const round = (value) => Math.round(value * 10) / 10;

function monthlyCounts(records, dateAccessor, currentDate, months = 12) {
  const year = Number(currentDate.slice(0, 4));
  const month = Number(currentDate.slice(5, 7));
  const data = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(year, month - (months - i), 1));
    return { key: d.toISOString().slice(0, 7), value: 0 };
  });
  const byMonth = new Map(data.map((entry) => [entry.key, entry]));
  records.forEach((record) => {
    const date = dateAccessor(record);
    if (typeof date === 'string') {
      const row = byMonth.get(date.slice(0, 7));
      if (row) row.value += 1;
    }
  });
  return data;
}

export function calculatePremiumBookInsights(books = [], sessions = [], aggregates = [], timeRange = 'all', currentDate = getCurrentLocalDateKey(), custom = {}) {
  const allBooks = safeArray(books);
  const bookIds = new Set(allBooks.map((book) => String(book.id)));
  const realSessions = safeArray(sessions).filter((s) => isRealSession(s) && isBookSession(s, bookIds));
  const scopedSessions = realSessions.filter((s) => inRange(getDate(s), timeRange, currentDate, custom));
  const historical = safeArray(aggregates).filter((a) => a?.isDailySession === false && a.mediaType === 'book');
  // Historical totals are lifetime-only. Ranges without per-day data cannot be attributed by month.
  const historicalMinutes = reconcileBookmoryHistoricalTime(historical, realSessions).undatedMinutes;
  const verifiedMinutes = scopedSessions.reduce((sum, s) => sum + durationMinutes(s), 0);
  const actualPages = scopedSessions.reduce((sum, s) => sum + Math.max(0,
    s.pagesRead !== undefined ? asNumber(s.pagesRead) : (asNumber(s.toPage) - asNumber(s.fromPage))), 0);
  const completed = allBooks.filter((book) => normalizeBookStatus(book.status) === 'completed');
  const finishedInPeriod = completed.filter((book) => inRange(book.finishedOn, timeRange, currentDate, custom));
  const knownPages = completed.reduce((sum, book) => sum + Math.max(0, asNumber(book.pages || book.progress?.total)), 0);
  const rated = allBooks.filter((book) => asNumber(book.rating) > 0);
  const purchases = allBooks.flatMap((book) => safeArray(book.purchases).map((purchase) => ({ ...purchase, title: book.title })));
  const knownPurchaseAmount = purchases.filter((purchase) => purchase.currency === 'PHP' && Number.isFinite(purchase.amount))
    .reduce((sum, purchase) => sum + purchase.amount, 0);
  const ratingCounts = count(rated, (book) => [String(Math.round(asNumber(book.rating) * 2) / 2)]);
  const topAuthors = take(count(allBooks, (book) => book.authors || book.creators || (book.author ? [book.author] : [])), 10);
  const topPublishers = take(count(allBooks, (book) => [book.publisher]), 10);
  const topTags = take(count(allBooks, (book) => book.genres || book.tags || []), 12);
  const topFormats = take(count(allBooks, (book) => [book.bookFormat || book.format]), 6);
  const topLanguages = take(count(allBooks, (book) => [book.language]), 6);
  const statusCounts = take(count(allBooks, (book) => [normalizeBookStatus(book.status)]), 8);
  const activeDays = new Set(scopedSessions.map(getDate).filter(Boolean)).size;
  const pageEntries = scopedSessions.filter((s) => asNumber(s.pagesRead) > 0 || asNumber(s.toPage) > asNumber(s.fromPage));
  return {
    libraryCount: allBooks.length, completedCount: completed.length,
    completedInPeriod: finishedInPeriod.length, completionDateMissing: completed.filter((book) => !book.finishedOn).length,
    trackedMinutes: round(verifiedMinutes), trackedPages: actualPages, historicalMinutes: round(historicalMinutes),
    totalKnownMinutes: round(verifiedMinutes + (timeRange === 'all' ? historicalMinutes : 0)),
    knownCompletedPages: knownPages, activeDays, sessionCount: scopedSessions.length,
    pagesPerHour: verifiedMinutes > 0 && pageEntries.length ? round(actualPages / (verifiedMinutes / 60)) : null,
    avgRating: rated.length ? round(rated.reduce((sum, book) => sum + asNumber(book.rating), 0) / rated.length) : null,
    topAuthors, topPublishers, topTags, topFormats, topLanguages, statusCounts, ratingCounts: take(ratingCounts, 12),
    favorites: allBooks.filter((book) => book.favorite).length,
    wishlist: allBooks.filter((book) => book.wishlist).length,
    rereads: allBooks.reduce((sum, book) => sum + Math.max(0, asNumber(book.bookmoryLogCount) - 1), 0),
    purchases: purchases.length, phpPurchaseAmount: Math.round((knownPurchaseAmount + Number.EPSILON) * 100) / 100,
    monthlyCompletions: monthlyCounts(completed, (book) => book.finishedOn, currentDate),
    knownPurchaseCurrency: 'PHP',
  };
}

export function calculatePremiumGameInsights(games = [], sessions = [], timeRange = 'all', currentDate = getCurrentLocalDateKey(), custom = {}) {
  const allGames = safeArray(games);
  const ids = new Set(allGames.map((g) => String(g.id)));
  const realSessions = safeArray(sessions).filter((s) => isRealSession(s) && isGameSession(s, ids));
  const scopedSessions = realSessions.filter((s) => inRange(getDate(s), timeRange, currentDate, custom));
  const completed = allGames.filter((game) => normalizeGameStatus(game.status) === 'completed');
  const rated = allGames.filter((game) => asNumber(game.rating) > 0);
  const baselineHours = allGames.reduce((sum, game) => sum + Math.max(0, asNumber(game.baselineHours ?? game.hoursPlayed)), 0);
  const verifiedMinutes = scopedSessions.reduce((sum, session) => sum + durationMinutes(session), 0);
  const topGames = allGames.map((game) => ({ title: game.title || 'Untitled', value: asNumber(game.baselineHours ?? game.hoursPlayed) }))
    .filter((game) => game.value > 0).sort((a, b) => b.value - a.value).slice(0, 8);
  return {
    libraryCount: allGames.length, completedCount: completed.length,
    playingCount: allGames.filter((game) => normalizeGameStatus(game.status) === 'playing').length,
    verifiedMinutes: round(verifiedMinutes), baselineHours: round(baselineHours),
    totalAllTimeHours: round(baselineHours + realSessions.reduce((sum, s) => sum + durationMinutes(s), 0) / 60),
    activeDays: new Set(scopedSessions.map(getDate).filter(Boolean)).size,
    sessionCount: scopedSessions.length,
    avgRating: rated.length ? round(rated.reduce((sum, game) => sum + asNumber(game.rating), 0) / rated.length) : null,
    topPlatforms: take(count(allGames, (game) => [game.platform]), 8),
    topGenres: take(count(allGames, (game) => game.genres || []), 10),
    statusCounts: take(count(allGames, (game) => [normalizeGameStatus(game.status)]), 8),
    ratingCounts: take(count(rated, (game) => [String(Math.round(asNumber(game.rating)))]), 11),
    topGames,
    monthlyCompletions: monthlyCounts(completed, (game) => game.finishedOn || game.dateFinished || game.completedOn, currentDate),
  };
}
