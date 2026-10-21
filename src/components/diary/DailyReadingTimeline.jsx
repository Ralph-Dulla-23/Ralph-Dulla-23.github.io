import PropTypes from 'prop-types';
import { useMemo } from 'react';
import { calculateDailyReadingTimeline } from '../../domain/selectors/dailyReadingTimeline.js';

export default function DailyReadingTimeline({ books, sessions }) {
    const { daily, streak, totalMinutes, totalPages } = useMemo(() => calculateDailyReadingTimeline(books, sessions), [books, sessions]);
    const maxMinutes = Math.max(1, ...daily.map(({ minutes }) => minutes));
    const maxPages = Math.max(0, ...daily.map(({ pages }) => pages));
    // Both quantities are visible without requiring a user gesture.
    return (
        <section aria-label="Daily reading statistics" className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900 sm:p-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">Daily Reading Timeline</h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Last 14 days · Actual recorded sessions</p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">{streak} day streak</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-blue-50 p-3 dark:bg-blue-950/30"><p className="text-xs text-blue-700 dark:text-blue-300">Reading time</p><p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{Math.round(totalMinutes)} <span className="text-xs font-medium">min</span></p></div>
                <div className="rounded-2xl bg-pink-50 p-3 dark:bg-pink-950/30"><p className="text-xs text-pink-700 dark:text-pink-300">Pages logged</p><p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{totalPages} <span className="text-xs font-medium">pages</span></p></div>
            </div>
            <div className="mt-5 grid items-end gap-1.5" style={{ gridTemplateColumns: `repeat(${daily.length}, minmax(0, 1fr))` }} role="img" aria-label={`Last 14 days: ${Math.round(totalMinutes)} minutes and ${totalPages} pages` }>
                {daily.map((day) => (
                    <div key={day.date} className="flex min-w-0 flex-col items-center gap-1.5" title={`${day.date}: ${Math.round(day.minutes)} minutes, ${day.pages} pages`}>
                        <div className="flex h-24 w-full max-w-5 items-end rounded-md bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div className="w-full rounded-md bg-blue-500 motion-safe:transition-[height] motion-safe:duration-300" style={{ height: `${Math.max(day.minutes > 0 ? 4 : 0, 100 * day.minutes / maxMinutes)}%` }} />
                        </div>
                        <span className="text-[9px] tabular-nums text-gray-400">{Number(day.date.slice(-2))}</span>
                    </div>
                ))}
            </div>
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Each blue bar represents minutes read that day. Highest daily pages logged: {Math.round(maxPages)}.</p>
        </section>
    );
}

DailyReadingTimeline.propTypes = { books: PropTypes.array.isRequired, sessions: PropTypes.array.isRequired };
