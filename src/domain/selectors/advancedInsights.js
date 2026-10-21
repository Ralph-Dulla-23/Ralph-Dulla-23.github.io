import { recordedPages } from './readingPages.js';
/** Pure, provenance-aware analytics. Never turns Bookmory range totals into dated sessions. */
import { getCurrentLocalDateKey, toLocalDateKey } from '../dates.js';
import { normalizeBookStatus, normalizeGameStatus } from '../status.js';
import { reconcileBookmoryHistoricalTime } from './reconcileHistoricalTime.js';

const arr = (v) => Array.isArray(v) ? v : [];
const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const round = (v, n = 1) => Math.round(v * 10 ** n) / 10 ** n;
const dateKey = (v) => toLocalDateKey(v);
const validDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const daily = (s) => s && s.isDailySession !== false && s.source !== 'bookmory' && !/^bookmory_/i.test(String(s.id || ''));
const minutes = (s) => Math.max(0, s.activeSeconds != null ? num(s.activeSeconds) / 60 : s.durationSeconds != null ? num(s.durationSeconds) / 60 : num(s.minutes));
const pages = recordedPages;
const millisPerDay = 86400000;
const utc = (key) => new Date(`${key}T12:00:00Z`);
const shiftDay = (key, d) => new Date(utc(key).getTime() + d * millisPerDay).toISOString().slice(0, 10);
const diffDays = (a, b) => validDate(a) && validDate(b) ? Math.round((utc(b) - utc(a)) / millisPerDay) : null;
const entries = (o, limit = 8) => Object.entries(o).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
function increment(map, key, value = 1) { if (key) map[key] = (map[key] || 0) + value; }
const bookCompleted = (b) => normalizeBookStatus(b.status) === 'completed';
const gameCompleted = (g) => normalizeGameStatus(g.status) === 'completed';
const finishBook = (b) => dateKey(b.finishedOn || b.completedOn || b.dateFinished);
const finishGame = (g) => dateKey(g.finishedOn || g.dateFinished || g.completedOn);
const startBook = (b) => dateKey(b.startedOn || b.startDate || b.startedAt || b.startReadingDate);
const startGame = (g) => dateKey(g.startedOn || g.startedAt || g.startDate);
const bookLength = (b) => num(b.pages ?? b.totalPages ?? b.progress?.total);
const sessionId = (s) => String(s.libraryItemId || s.bookId || s.gameId || s.mediaId || s.itemId || '');

export function resolveInsightsWindow(timeRange = 'all', today = getCurrentLocalDateKey(), custom = {}) {
  if (timeRange === 'custom') {
    const from = validDate(custom.from) ? custom.from : null;
    const to = validDate(custom.to) ? custom.to : null;
    return { from, to, valid: Boolean(from && to && from <= to), label: 'Custom range' };
  }
  if (timeRange === 'month') return { from: `${today.slice(0, 7)}-01`, to: today, valid: true, label: 'This month' };
  if (timeRange === 'year') return { from: `${today.slice(0, 4)}-01-01`, to: today, valid: true, label: 'This year' };
  return { from: null, to: null, valid: true, label: 'All time' };
}
const within = (key, window) => window.valid && validDate(key) && (!window.from || key >= window.from) && (!window.to || key <= window.to);

export function buildAdvancedInsights({ books = [], games = [], sessions = [], aggregates = [], journal = [], timeRange = 'all', today = getCurrentLocalDateKey(), custom = {}, year } = {}) {
  const window = resolveInsightsWindow(timeRange, today, custom);
  const yearKey = String(year || today.slice(0, 4));
  const bookList = arr(books), gameList = arr(games);
  const bIds = new Set(bookList.map(b => String(b.id)));
  const gIds = new Set(gameList.map(g => String(g.id)));
  const bookSessions = [], gameSessions = [], unknownSessions = [];
  for (const s of arr(sessions).filter(daily)) {
    const key = dateKey(s.date || s.startedAt);
    if (!key) continue;
    const id = sessionId(s);
    const isBook = s.mediaType === 'book' || (s.mediaType !== 'game' && bIds.has(id) && !gIds.has(id));
    const isGame = s.mediaType === 'game' || (s.mediaType !== 'book' && gIds.has(id) && !bIds.has(id));
    const record = { ...s, dateKey: key, minutes: minutes(s), pages: pages(s), linkId: id };
    if (isBook) bookSessions.push(record);
    else if (isGame) gameSessions.push(record);
    else unknownSessions.push(record);
  }
  const scopedBooks = bookSessions.filter(s => within(s.dateKey, window));
  const scopedGames = gameSessions.filter(s => within(s.dateKey, window));
  const bookMap = new Map(bookList.map(b => [String(b.id), b]));
  const gameMap = new Map(gameList.map(g => [String(g.id), g]));
  const perDay = new Map();
  for (const s of [...scopedBooks.map(v => ({ ...v, kind: 'book' })), ...scopedGames.map(v => ({ ...v, kind: 'game' }))]) {
    const previous = perDay.get(s.dateKey) || { date: s.dateKey, readingMinutes: 0, gamingMinutes: 0, pages: 0, readingSessions: 0, gamingSessions: 0 };
    if (s.kind === 'book') { previous.readingMinutes += s.minutes; previous.pages += s.pages; previous.readingSessions++; }
    else { previous.gamingMinutes += s.minutes; previous.gamingSessions++; }
    perDay.set(s.dateKey, previous);
  }
  const days = [...perDay.values()].sort((a,b) => a.date.localeCompare(b.date));
  const dayKeys = new Set(bookSessions.map(s => s.dateKey));
  const streaks = [];
  let seq = 0;
  for (let d of [...dayKeys].sort()) {
    const prev = streaks.at(-1);
    if (prev && shiftDay(prev.end, 1) === d) { prev.end = d; prev.length++; }
    else streaks.push({ start: d, end: d, length: 1 });
  }
  const longestStreak = Math.max(0, ...streaks.map(s => s.length));
  let check = dayKeys.has(today) ? today : shiftDay(today, -1);
  while (dayKeys.has(check)) { seq++; check = shiftDay(check, -1); if(seq > 10000) break; }
  const heatmap = [];
  for (let d = `${yearKey}-01-01`; d.startsWith(yearKey); d = shiftDay(d,1)) {
    const row = perDay.get(d);
    heatmap.push({ date: d, readingMinutes: row?.readingMinutes || 0, gamingMinutes: row?.gamingMinutes || 0, pages: row?.pages || 0, count: (row?.readingSessions || 0) + (row?.gamingSessions || 0) });
  }
  const monthly = {};
  const yearly = {};
  const weekly = {};
  const weekdays = {}, hours = {};
  for (const day of days) {
    const month = day.date.slice(0,7), yr = day.date.slice(0,4);
    const weekDate = utc(day.date);
    const mondayOffset = (weekDate.getUTCDay() + 6) % 7;
    const week = shiftDay(day.date,-mondayOffset);
    if (!weekly[week]) weekly[week] = {key:week,reading:0,gaming:0,pages:0};
    if (!monthly[month]) monthly[month] = { key: month, reading: 0, gaming: 0, pages: 0 };
    if (!yearly[yr]) yearly[yr] = { key: yr, reading: 0, gaming: 0, pages: 0 };
    for (const row of [weekly[week],monthly[month], yearly[yr]]) { row.reading += day.readingMinutes; row.gaming += day.gamingMinutes; row.pages += day.pages; }
  }
  const timedReading = scopedBooks.filter(s => s.minutes > 0), timedGaming = scopedGames.filter(s => s.minutes > 0);
  for (const s of scopedBooks) {
    const dow = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(utc(s.dateKey));
    increment(weekdays, dow, 1);
    // Only timestamp values with an actual clock are eligible; date-only values do not imply an hour.
    const raw = s.startedAt || s.date;
    if (typeof raw === 'string' && /T\d{2}:\d{2}/.test(raw)) {
      const when = new Date(raw);
      if (!Number.isNaN(when.getTime())) {
        const hour = new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:'Asia/Manila'}).format(when);
        if (/^\d{2}$/.test(hour)) increment(hours, `${hour}:00`, 1);
      }
    }
  }
  const speedSessions = scopedBooks.filter(s => s.minutes > 0 && s.pages > 0).map(s => ({ date: s.dateKey, pages: s.pages, minutes: s.minutes, speed: round(s.pages * 60 / s.minutes), title: bookMap.get(s.linkId)?.title || 'Book' })).sort((a,b) => a.date.localeCompare(b.date));
  const speedBooks = {};
  speedSessions.forEach(s => { const row = speedBooks[s.title] || { pages: 0, minutes: 0 }; row.pages += s.pages; row.minutes += s.minutes; speedBooks[s.title] = row; });
  const speedByBook = Object.entries(speedBooks).map(([title, x]) => [title, round(x.pages * 60 / x.minutes)]).sort((a,b) => b[1] - a[1]);
  const endedBooks = bookList.filter(bookCompleted);
  const booksCompletedInRange = endedBooks.filter(b => within(finishBook(b), window));
  const completedDurations = endedBooks.filter(b => within(finishBook(b), window)).map(b => ({ title: b.title, days: diffDays(startBook(b), finishBook(b)) })).filter(r => r.days !== null && r.days >= 0);
  const finishedSizes = booksCompletedInRange.map(b => ({ title: b.title, pages: bookLength(b) })).filter(b => b.pages > 0).sort((a,b) => b.pages - a.pages);
  const datedBooks = endedBooks.filter(b => finishBook(b));
  const baseStatuses = bookList.map(b => normalizeBookStatus(b.status));
  const purchaseList = bookList.flatMap(b => arr(b.purchases).map(p => ({ ...p, title: b.title, date: dateKey(p.date || p.purchasedAt || p.purchaseDate), amount: num(p.amount ?? p.price), currency: p.currency || 'unknown' })));
  const purchases = purchaseList.filter(p => within(p.date, window));
  const spending = {}, currencies = new Set();
  for (const p of purchases) { currencies.add(p.currency); if (p.currency === 'PHP' && p.amount > 0) increment(spending, p.date.slice(0,7), p.amount); }
  const loans = bookList.flatMap(b => arr(b.loans || b.rentals).map(v => ({ ...v, title: b.title })));
  const gifts = bookList.flatMap(b => arr(b.gifts).map(v => ({ ...v, title: b.title })));
  const journalList = arr(journal).filter(j => within(dateKey(j.date || j.occurredAt || j.createdAt),window));
  const notesByType = {}; const notesByMedia = {};
  for (const entry of journalList) {
    increment(notesByType, entry.type || entry.entryType || 'reflection');
    const link = entry.linkedMediaId || entry.libraryItemId;
    if (link) increment(notesByMedia, bookMap.get(String(link))?.title || gameMap.get(String(link))?.title || 'Unknown media');
  }
  const dateFilteredGames = gameList.filter(g => within(finishGame(g),window));
  const gameDurations = gameList.filter(gameCompleted).map(g => ({ title:g.title, days:diffDays(startGame(g),finishGame(g)) })).filter(g => g.days !== null && g.days >= 0);
  const completeRates = {
    book: round(100 * endedBooks.length / Math.max(1,bookList.filter(b=> !['want-to-read'].includes(normalizeBookStatus(b.status))).length)),
    game: round(100 * gameList.filter(gameCompleted).length / Math.max(1, gameList.filter(g => !['backlog'].includes(normalizeGameStatus(g.status))).length)),
  };
  const monthlyBookEnds = {}, monthlyGameEnds = {};
  for (const b of booksCompletedInRange) increment(monthlyBookEnds, finishBook(b).slice(0,7));
  for (const g of dateFilteredGames.filter(gameCompleted)) increment(monthlyGameEnds, finishGame(g).slice(0,7));
  const yearBooks = endedBooks.filter(b => finishBook(b)?.startsWith(yearKey));
  const yearGames = gameList.filter(g => gameCompleted(g) && finishGame(g)?.startsWith(yearKey));
  const rewindBookSessions = bookSessions.filter(s => s.dateKey.startsWith(yearKey));
  const rewindGameSessions = gameSessions.filter(s => s.dateKey.startsWith(yearKey));
  const yearRated = yearBooks.filter(b => num(b.rating) > 0).sort((a,b) => num(b.rating) - num(a.rating));
  const yearTags = {};
  yearBooks.forEach(b=> arr(b.genres || b.tags).forEach(t=>increment(yearTags,t)));
  const historyMinutes = reconcileBookmoryHistoricalTime(arr(aggregates), bookSessions).undatedMinutes;
  return {
    window, year:yearKey, sourceCoverage: { books:bookList.length, games:gameList.length, bookSessions:bookSessions.length, gameSessions:gameSessions.length, unknownSessions:unknownSessions.length, historicalMinutes:round(historyMinutes) },
    activity: { heatmap, days, weekly:Object.values(weekly).sort((a,b)=>a.key.localeCompare(b.key)), monthly:Object.values(monthly).sort((a,b)=>a.key.localeCompare(b.key)), yearly:Object.values(yearly).sort((a,b)=>a.key.localeCompare(b.key)), currentStreak:seq, longestStreak, streaks, readingSessions:scopedBooks.length, gamingSessions:scopedGames.length },
    reading: { speedSessions, speedByBook, averageSpeed: speedSessions.length ? round(speedSessions.reduce((n,s)=>n+s.pages,0)*60/speedSessions.reduce((n,s)=>n+s.minutes,0)) : null,
      averageSessionMinutes:timedReading.length ? round(timedReading.reduce((n,s)=>n+s.minutes,0)/timedReading.length) : null, timedSessions: timedReading.length,
      completedDurations, averageCompletionDays:completedDurations.length ? round(completedDurations.reduce((n,b)=>n+b.days,0)/completedDurations.length):null,
      fastest:[...completedDurations].sort((a,b)=>a.days-b.days)[0] || null, slowest:[...completedDurations].sort((a,b)=>b.days-a.days)[0] || null,
      longest:finishedSizes[0] || null, completedInRange:booksCompletedInRange.length, completedRate:completeRates.book,
      weekdayBreakdown:entries(weekdays,7), hourBreakdown:entries(hours,24), rereadBooks:bookList.filter(b=>num(b.bookmoryLogCount)>1).map(b=>({title:b.title,reads:num(b.bookmoryLogCount)})),
      additionalReads:bookList.reduce((n,b)=>n+Math.max(0,num(b.bookmoryLogCount)-1),0), undatedCompletions:endedBooks.length-datedBooks.length,
    },
    collection: { purchases:purchases.length, knownSpendPHP:round(Object.values(spending).reduce((a,b)=>a+b,0),2), spendingByMonth:entries(spending,60).sort((a,b)=>a[0].localeCompare(b[0])), currencies:[...currencies], loanCount:loans.length, loansReturned:loans.filter(l=>l.returnedAt || l.returnedDate || l.returned).length, giftCount:gifts.length, loanDataPresent: loans.length>0, giftDataPresent:gifts.length>0,
      notes:journalList.length, quotes:journalList.filter(j=>(j.type||j.entryType)==='book_quote').length, noteTypes:entries(notesByType), noteMedia:entries(notesByMedia), wishlist:baseStatuses.filter(s=>s==='want-to-read').length,
    },
    gaming: { averageSessionMinutes:timedGaming.length ? round(timedGaming.reduce((n,s)=>n+s.minutes,0)/timedGaming.length):null,
      longestSessionMinutes:timedGaming.length ? round(Math.max(...timedGaming.map(s=>s.minutes))):null,
      playedMinutes:round(timedGaming.reduce((n,s)=>n+s.minutes,0)), completedRate:completeRates.game,
      averageCompletionDays:gameDurations.length ? round(gameDurations.reduce((n,s)=>n+s.days,0)/gameDurations.length):null,
      gameDurations, statusBreakdown:entries(gameList.reduce((o,g)=>(increment(o,normalizeGameStatus(g.status)),o),{})),
      monthlyCompletions:entries(monthlyGameEnds,60).sort((a,b)=>a[0].localeCompare(b[0])), monthlyBookCompletions:entries(monthlyBookEnds,60).sort((a,b)=>a[0].localeCompare(b[0])),
      replayCount:gameList.filter(g=>normalizeGameStatus(g.status)==='replay' || num(g.playthroughCount)>1).length,
    },
    rewind: { year:yearKey, booksCompleted:yearBooks.length, gamesCompleted:yearGames.length, bookMinutes:round(rewindBookSessions.reduce((n,s)=>n+s.minutes,0)), gameMinutes:round(rewindGameSessions.reduce((n,s)=>n+s.minutes,0)), pages:rewindBookSessions.reduce((n,s)=>n+s.pages,0), topRatedBooks:yearRated.slice(0,3).map(b=>({title:b.title,rating:b.rating})), topTags:entries(yearTags,4), bookSessions:rewindBookSessions.length, gameSessions:rewindGameSessions.length },
  };
}
