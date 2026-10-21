/**
 * Activity and session aggregation selectors for Books & Games Diary.
 * Grounded in DIARY_STABILIZATION_IMPLEMENTATION.md (Sections 7, 8 & 9).
 */

import { toLocalDateKey, DEFAULT_TIMEZONE } from '../dates.js';

/**
 * Filters out multi-day historical aggregates (isDailySession === false)
 * to ensure that only genuine daily sessions appear on calendar views.
 * 
 * @param {Array<Object>} sessions
 * @returns {Array<Object>}
 */
export function filterDailySessions(sessions) {
    if (!Array.isArray(sessions)) return [];
    return sessions.filter((s) => s && s.isDailySession !== false);
}

/**
 * Groups daily sessions by their local date string ('YYYY-MM-DD') in the chosen timezone.
 * Strictly excludes multi-day historical aggregates (isDailySession === false).
 * 
 * @param {Array<Object>} sessions
 * @param {string} [timeZone=DEFAULT_TIMEZONE]
 * @returns {Map<string, Array<Object>>}
 */
export function groupSessionsByLocalDate(sessions, timeZone = DEFAULT_TIMEZONE) {
    const map = new Map();
    if (!Array.isArray(sessions)) return map;

    sessions.forEach((s) => {
        // Invariant: Non-daily historical aggregates must NEVER be interpolated into daily cells
        if (!s || s.isDailySession === false || /^bookmory_/i.test(s.id || "") || s.source === "bookmory") return;

        const dateKey = toLocalDateKey(s.startedAt || s.date, timeZone);
        if (!dateKey) return;

        if (!map.has(dateKey)) {
            map.set(dateKey, []);
        }
        map.get(dateKey).push(s);
    });

    return map;
}

/**
 * Retrieves all daily sessions occurring on a specific local date ('YYYY-MM-DD').
 * 
 * @param {Array<Object>} sessions
 * @param {string} targetDateKey 'YYYY-MM-DD'
 * @param {string} [timeZone=DEFAULT_TIMEZONE]
 * @returns {Array<Object>}
 */
export function getSessionsForDate(sessions, targetDateKey, timeZone = DEFAULT_TIMEZONE) {
    if (!Array.isArray(sessions) || !targetDateKey) return [];
    return sessions.filter((s) => {
        if (!s || s.isDailySession === false || /^bookmory_/i.test(s.id || "") || s.source === "bookmory") return false;
        const dateKey = toLocalDateKey(s.startedAt || s.date, timeZone);
        return dateKey === targetDateKey;
    });
}
