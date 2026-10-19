/**
 * Shared date and timezone helpers for Books & Games Diary.
 * Grounded in DIARY_STABILIZATION_IMPLEMENTATION.md (Section 8, DATA-04).
 */

export const DEFAULT_TIMEZONE = 'Asia/Manila';

/**
 * Converts an ISO string, timestamp number, Date object, or date string
 * into a localized 'YYYY-MM-DD' calendar date key for the given time zone.
 * 
 * Prevents UTC midnight misattribution where sessions late in UTC day (e.g. 16:30Z)
 * are misallocated to the previous day in the Philippines (UTC+8).
 * 
 * @param {string|number|Date} input
 * @param {string} [timeZone=DEFAULT_TIMEZONE]
 * @returns {string|null} Local date in 'YYYY-MM-DD' format or null if invalid.
 */
export function toLocalDateKey(input, timeZone = DEFAULT_TIMEZONE) {
    if (!input) return null;

    // Fast-path: If input is already an exact 'YYYY-MM-DD' without time component
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
        return input.trim();
    }

    const date = new Date(input);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    try {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(date);

        const val = (type) => parts.find((p) => p.type === type)?.value;
        const year = val('year');
        const month = val('month');
        const day = val('day');

        if (!year || !month || !day) return null;
        return `${year}-${month}-${day}`;
    } catch {
        return null;
    }
}

/**
 * Returns today's local date key in 'YYYY-MM-DD' format for the given timezone.
 * 
 * @param {string} [timeZone=DEFAULT_TIMEZONE]
 * @returns {string}
 */
export function getCurrentLocalDateKey(timeZone = DEFAULT_TIMEZONE) {
    return toLocalDateKey(new Date(), timeZone) || new Date().toISOString().split('T')[0];
}

/**
 * Formats duration in minutes into a human-readable string (e.g. "1h 30m" or "45m").
 * 
 * @param {number} totalMinutes
 * @returns {string}
 */
export function formatDurationMinutes(totalMinutes) {
    const mins = Math.max(0, Math.round(Number(totalMinutes) || 0));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}
