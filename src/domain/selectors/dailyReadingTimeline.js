import { toLocalDateKey, getCurrentLocalDateKey, DEFAULT_TIMEZONE } from '../dates.js';

/** Build a genuine activity timeline; never distribute undated historical aggregates across days. */
export function calculateDailyReadingTimeline(books = [], sessions = [], days = 14, timeZone = DEFAULT_TIMEZONE, today = getCurrentLocalDateKey(timeZone)) {
    const knownBookIds = new Set(books.map((book) => String(book.id)));
    const amountByDate = new Map();
    for (const session of sessions) {
        if (!session || session.isDailySession === false || /^bookmory_/i.test(session.id || "") || session.source === "bookmory") continue;
        const id = session.libraryItemId || session.itemId || session.bookId || session.mediaId;
        if (session.mediaType === 'game') continue;
        if (session.mediaType !== 'book' && !knownBookIds.has(String(id)) && session.fromPage === undefined) continue;
        const key = toLocalDateKey(session.date || session.startedAt, timeZone);
        if (!key) continue;
        const current = amountByDate.get(key) || { minutes: 0, pages: 0, sessions: 0 };
        const mins = session.activeSeconds != null ? Number(session.activeSeconds) / 60 : (session.minutes != null ? Number(session.minutes) : Number(session.durationSeconds || 0) / 60);
        const pages = session.pagesRead != null ? Number(session.pagesRead) : (Number(session.toPage) || 0) - (Number(session.fromPage) || 0);
        current.minutes += Number.isFinite(mins) ? Math.max(0, mins) : 0;
        current.pages += Number.isFinite(pages) ? Math.max(0, pages) : 0;
        current.sessions += 1;
        amountByDate.set(key, current);
    }
    // Calendar-day arithmetic uses UTC date components only; timestamps were localized above.
    const currentDate = new Date(`${today}T12:00:00Z`);
    const daily = Array.from({ length: days }, (_, index) => {
        const date = new Date(currentDate);
        date.setUTCDate(currentDate.getUTCDate() - (days - index - 1));
        const key = date.toISOString().slice(0, 10);
        return { date: key, ...(amountByDate.get(key) || { minutes: 0, pages: 0, sessions: 0 }) };
    });
    let streak = 0;
    const cursor = new Date(currentDate);
    if (!amountByDate.has(today)) cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (amountByDate.has(cursor.toISOString().slice(0, 10))) {
        streak += 1;
        cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return { daily, streak, totalPages: daily.reduce((sum, d) => sum + d.pages, 0), totalMinutes: daily.reduce((sum, d) => sum + d.minutes, 0) };
}
