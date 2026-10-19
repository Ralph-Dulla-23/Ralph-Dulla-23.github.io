/**
 * Pure domain selectors for Diary Insights.
 * Grounded in DIARY_STABILIZATION_IMPLEMENTATION.md (Sections 7, 8 & 9).
 */

import { toLocalDateKey, getCurrentLocalDateKey, DEFAULT_TIMEZONE } from '../dates.js';
import { normalizeBookStatus, normalizeGameStatus } from '../status.js';

/**
 * Filters sessions by timeRange ('month' | 'year' | 'all') using localized dates.
 * Strictly excludes multi-day historical aggregates (isDailySession === false).
 * 
 * @param {Array<Object>} sessions
 * @param {'month'|'year'|'all'} timeRange
 * @param {string} [timeZone=DEFAULT_TIMEZONE]
 * @returns {Array<Object>}
 */
export function filterSessionsByTimeRange(sessions, timeRange = 'all', timeZone = DEFAULT_TIMEZONE) {
    if (!Array.isArray(sessions)) return [];

    const todayKey = getCurrentLocalDateKey(timeZone);
    const currentYearPrefix = todayKey.slice(0, 4); // 'YYYY'
    const currentMonthPrefix = todayKey.slice(0, 7); // 'YYYY-MM'

    return sessions.filter((s) => {
        if (!s || s.isDailySession === false) return false;
        const dateKey = toLocalDateKey(s.startedAt || s.date, timeZone);
        if (!dateKey) return true;

        if (timeRange === 'month') {
            return dateKey.startsWith(currentMonthPrefix);
        }
        if (timeRange === 'year') {
            return dateKey.startsWith(currentYearPrefix);
        }
        return true;
    });
}

/**
 * Computes analytics and metrics for Books.
 * 
 * @param {Array<Object>} books
 * @param {Array<Object>} sessions
 * @param {'month'|'year'|'all'} [timeRange='all']
 * @param {string} [timeZone=DEFAULT_TIMEZONE]
 * @returns {Object}
 */
export function calculateBookInsights(books = [], sessions = [], timeRange = 'all', timeZone = DEFAULT_TIMEZONE) {
    const safeBooks = Array.isArray(books) ? books : [];
    const bookMap = new Map();
    safeBooks.forEach((b) => {
        if (b && b.id) bookMap.set(String(b.id), b);
    });

    const filteredSessions = filterSessionsByTimeRange(sessions, timeRange, timeZone);

    let totalReadingMinutes = 0;
    let totalPagesRead = 0;

    filteredSessions.forEach((s) => {
        const mediaId = s.mediaId || s.bookId;
        const isBook = s.mediaType === 'book' || bookMap.has(String(mediaId)) || s.fromPage !== undefined;
        if (isBook) {
            if (s.minutes) {
                totalReadingMinutes += Number(s.minutes) || 0;
            } else if (s.durationSeconds) {
                totalReadingMinutes += Math.round((Number(s.durationSeconds) || 0) / 60);
            }
            if (s.pagesRead) {
                totalPagesRead += Number(s.pagesRead) || 0;
            } else if (s.toPage !== undefined && s.fromPage !== undefined) {
                const diff = Number(s.toPage) - Number(s.fromPage);
                if (diff > 0) totalPagesRead += diff;
            }
        }
    });

    // Counts using normalized status
    const completedBooks = safeBooks.filter((b) => normalizeBookStatus(b.status) === 'completed');
    const readingBooks = safeBooks.filter((b) => normalizeBookStatus(b.status) === 'reading');
    const wantToReadBooks = safeBooks.filter((b) => normalizeBookStatus(b.status) === 'want-to-read');

    const ratedBooks = safeBooks.filter((b) => typeof b.rating === 'number' && b.rating > 0);
    const avgBookRating = ratedBooks.length > 0
        ? (ratedBooks.reduce((acc, b) => acc + b.rating, 0) / ratedBooks.length).toFixed(1)
        : '—';

    // Genre breakdown
    const genreCounts = {};
    safeBooks.forEach((b) => {
        (b.genres || []).forEach((g) => {
            genreCounts[g] = (genreCounts[g] || 0) + 1;
        });
    });
    const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    return {
        totalHours: (totalReadingMinutes / 60).toFixed(1),
        totalMinutes: totalReadingMinutes,
        totalPagesRead,
        completedCount: completedBooks.length,
        readingCount: readingBooks.length,
        wantToReadCount: wantToReadBooks.length,
        avgRating: avgBookRating,
        topGenres,
    };
}

/**
 * Computes analytics and metrics for Games.
 * Separates verified session playtime from baseline historical hours.
 * 
 * @param {Array<Object>} games
 * @param {Array<Object>} sessions
 * @param {'month'|'year'|'all'} [timeRange='all']
 * @param {string} [timeZone=DEFAULT_TIMEZONE]
 * @returns {Object}
 */
export function calculateGameInsights(games = [], sessions = [], timeRange = 'all', timeZone = DEFAULT_TIMEZONE) {
    const safeGames = Array.isArray(games) ? games : [];
    const gameMap = new Map();
    safeGames.forEach((g) => {
        if (g && g.id) gameMap.set(String(g.id), g);
    });

    const filteredSessions = filterSessionsByTimeRange(sessions, timeRange, timeZone);

    let verifiedSessionMinutes = 0;

    filteredSessions.forEach((s) => {
        const mediaId = s.mediaId || s.gameId;
        const isGame = s.mediaType === 'game' || gameMap.has(String(mediaId));
        if (isGame) {
            if (s.minutes) {
                verifiedSessionMinutes += Number(s.minutes) || 0;
            } else if (s.durationSeconds) {
                verifiedSessionMinutes += Math.round((Number(s.durationSeconds) || 0) / 60);
            }
        }
    });

    // Baseline hours from games metadata
    let totalBaselineHours = 0;
    safeGames.forEach((g) => {
        const manualHours = Number(g.hoursPlayed) || Number(g.baselineHours) || 0;
        totalBaselineHours += manualHours;
    });

    const verifiedHours = (verifiedSessionMinutes / 60).toFixed(1);
    const baselineHours = totalBaselineHours.toFixed(1);
    const totalPlaytimeHours = (totalBaselineHours + verifiedSessionMinutes / 60).toFixed(1);

    // Counts using normalized status
    const completedGames = safeGames.filter((g) => normalizeGameStatus(g.status) === 'completed');
    const playingGames = safeGames.filter((g) => normalizeGameStatus(g.status) === 'playing');
    const backlogGames = safeGames.filter((g) => normalizeGameStatus(g.status) === 'backlog');
    const replayGames = safeGames.filter((g) => normalizeGameStatus(g.status) === 'replay');

    const ratedGames = safeGames.filter((g) => typeof g.rating === 'number' && g.rating > 0);
    const avgGameRating = ratedGames.length > 0
        ? (ratedGames.reduce((acc, g) => acc + g.rating, 0) / ratedGames.length).toFixed(1)
        : '—';

    // Platform breakdown
    const platformCounts = {};
    safeGames.forEach((g) => {
        if (g.platform) {
            platformCounts[g.platform] = (platformCounts[g.platform] || 0) + 1;
        }
    });
    const topPlatforms = Object.entries(platformCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    return {
        verifiedHours,
        baselineHours,
        totalPlaytimeHours,
        verifiedMinutes: verifiedSessionMinutes,
        completedCount: completedGames.length,
        playingCount: playingGames.length,
        backlogCount: backlogGames.length,
        replayCount: replayGames.length,
        avgRating: avgGameRating,
        topPlatforms,
    };
}
