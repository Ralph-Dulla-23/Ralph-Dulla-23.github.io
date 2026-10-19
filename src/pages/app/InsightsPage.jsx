import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { DiaryShell } from '../../components/diary/DiaryShell';
import { useAuth } from '../../context/AuthContext';
import {
    watchPublicBooks,
    watchPublicGames,
    getAllSessions,
} from '../../lib/db';
import { useDiarySessions } from '../../hooks/useDiarySessions';
import { toLocalDateKey } from '../../domain/dates';
import {
    filterSessionsByTimeRange,
    calculateBookInsights,
    calculateGameInsights,
} from '../../domain/selectors/insightsSelectors';
import {
    BsBarChart,
    BsBook,
    BsController,
    BsCalendarCheck,
    BsClock,
    BsStarFill,
    BsCheckCircle,
    BsBookmarkCheck,
    BsFire,
    BsGrid1X2,
    BsCloudCheck,
    BsCloudArrowUp,
} from 'react-icons/bs';

export default function InsightsPage({ darkMode, setDarkMode }) {
    const { user } = useAuth();
    const [books, setBooks] = useState([]);
    const [games, setGames] = useState([]);
    const [legacySessions, setLegacySessions] = useState([]);

    // Live reactive subscription to canonical sessions (PR 08)
    const { sessions: canonicalSessions, metadata: sessionMetadata } = useDiarySessions();

    // Filters
    const [viewSegment, setViewSegment] = useState('combined'); // 'combined' | 'books' | 'games'
    const [timeRange, setTimeRange] = useState('all'); // 'month' | 'year' | 'all'

    // Observe books and games
    useEffect(() => {
        if (!user) return;
        const unsubBooks = watchPublicBooks(user.uid, setBooks);
        const unsubGames = watchPublicGames(user.uid, setGames);

        return () => {
            unsubBooks();
            unsubGames();
        };
    }, [user]);

    // Load legacy sessions asynchronously for backward compatibility
    useEffect(() => {
        if (!user) return;
        let active = true;

        (async () => {
            try {
                const all = await getAllSessions(user.uid);
                if (active) {
                    setLegacySessions(Array.isArray(all) ? all : []);
                }
            } catch (err) {
                console.error('Failed to load sessions for insights:', err);
            }
        })();

        return () => {
            active = false;
        };
    }, [user]);

    // Merged sessions: canonical priority + legacy backwards compatibility
    const sessions = useMemo(() => {
        const sessionMap = new Map();
        (legacySessions || []).forEach((s) => {
            if (s && s.id) sessionMap.set(String(s.id), s);
        });
        (canonicalSessions || []).forEach((s) => {
            if (s && s.id) sessionMap.set(String(s.id), s);
        });
        return Array.from(sessionMap.values());
    }, [legacySessions, canonicalSessions]);

    // Filter sessions by date range using localized dates
    const filteredSessions = useMemo(() => {
        return filterSessionsByTimeRange(sessions, timeRange);
    }, [sessions, timeRange]);

    // Metrics for Books computed via centralized domain selectors
    const bookMetrics = useMemo(() => {
        return calculateBookInsights(books, sessions, timeRange);
    }, [books, sessions, timeRange]);

    // Metrics for Games computed via centralized domain selectors (normalizes finished -> completed)
    const gameMetrics = useMemo(() => {
        return calculateGameInsights(games, sessions, timeRange);
    }, [games, sessions, timeRange]);

    // Combined active days calculated with toLocalDateKey
    const combinedActiveDays = useMemo(() => {
        const uniqueDates = new Set();
        filteredSessions.forEach((s) => {
            const dateStr = toLocalDateKey(s.startedAt || s.date);
            if (dateStr) uniqueDates.add(dateStr);
        });
        return uniqueDates.size;
    }, [filteredSessions]);

    return (
        <DiaryShell title="Insights" darkMode={darkMode} setDarkMode={setDarkMode}>
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold font-display text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <BsBarChart className="w-6 h-6 text-indigo-500" />
                            Insights & Analytics
                        </h1>
                        {sessionMetadata?.hasPendingWrites ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full" title="Changes queued offline; will sync when reconnected">
                                <BsCloudArrowUp className="w-3 h-3 animate-pulse" /> Syncing offline...
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full" title="Real-time cloud sync active">
                                <BsCloudCheck className="w-3 h-3" /> Live Sync
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Transparent reading pace, playtime records, and verified activity metrics.
                    </p>
                </div>

                {/* Time Range Filter */}
                <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 self-start sm:self-auto border border-gray-200 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={() => setTimeRange('month')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            timeRange === 'month'
                                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        Month
                    </button>
                    <button
                        type="button"
                        onClick={() => setTimeRange('year')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            timeRange === 'year'
                                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        Year
                    </button>
                    <button
                        type="button"
                        onClick={() => setTimeRange('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            timeRange === 'all'
                                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        All Time
                    </button>
                </div>
            </div>

            {/* Segmented View Switcher: Combined | Books | Games */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6">
                <button
                    type="button"
                    onClick={() => setViewSegment('combined')}
                    className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                        viewSegment === 'combined'
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <BsGrid1X2 className="w-4 h-4" />
                    Combined
                </button>
                <button
                    type="button"
                    onClick={() => setViewSegment('books')}
                    className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                        viewSegment === 'books'
                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <BsBook className="w-4 h-4" />
                    Books
                </button>
                <button
                    type="button"
                    onClick={() => setViewSegment('games')}
                    className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                        viewSegment === 'games'
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <BsController className="w-4 h-4" />
                    Games
                </button>
            </div>

            {/* COMBINED SEGMENT */}
            {viewSegment === 'combined' && (
                <div className="space-y-6">
                    {/* Top Overview Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                <BsCalendarCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Active Days
                                </p>
                                <p className="text-2xl font-bold font-display text-gray-900 dark:text-gray-100 mt-0.5">
                                    {combinedActiveDays}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <BsBook className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Books Finished
                                </p>
                                <p className="text-2xl font-bold font-display text-gray-900 dark:text-gray-100 mt-0.5">
                                    {bookMetrics.completedCount}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                                <BsCheckCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Games Completed
                                </p>
                                <p className="text-2xl font-bold font-display text-gray-900 dark:text-gray-100 mt-0.5">
                                    {gameMetrics.completedCount}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Reading vs Gaming Side-by-Side Comparison (Transparent Units) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Reading Column */}
                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <BsBook className="w-5 h-5 text-emerald-500" />
                                    Reading Activity
                                </h3>
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                                    {bookMetrics.readingCount} in progress
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Pages Logged</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                                        {bookMetrics.totalPagesRead.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Reading Time</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                                        {bookMetrics.totalHours} hrs
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Average Rating</p>
                                    <p className="text-xl font-bold text-amber-500 mt-0.5 flex items-center gap-1">
                                        <BsStarFill className="w-4 h-4" />
                                        {bookMetrics.avgRating}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Books</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                                        {books.length}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Gaming Column */}
                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                                <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <BsController className="w-5 h-5 text-indigo-500" />
                                    Gaming Playtime
                                </h3>
                                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-1 rounded-full">
                                    {gameMetrics.playingCount} currently playing
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Verified Sessions</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                                        {gameMetrics.verifiedHours} hrs
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Baseline Historical</p>
                                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                                        {gameMetrics.baselineHours} hrs
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Playtime</p>
                                    <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                                        {gameMetrics.totalPlaytimeHours} hrs
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Average Rating</p>
                                    <p className="text-xl font-bold text-amber-500 mt-0.5 flex items-center gap-1">
                                        <BsStarFill className="w-4 h-4" />
                                        {gameMetrics.avgRating}
                                    </p>
                                </div>
                            </div>

                            <p className="text-[11px] text-gray-400 italic pt-1">
                                Historical baseline hours and timer-verified sessions are displayed transparently to avoid double-counting.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* BOOKS SEGMENT */}
            {viewSegment === 'books' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Pages Read</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                                {bookMetrics.totalPagesRead.toLocaleString()}
                            </p>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Reading Time</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                                {bookMetrics.totalHours} hrs
                            </p>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Completed</p>
                            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                {bookMetrics.completedCount}
                            </p>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Avg Rating</p>
                            <p className="text-2xl font-bold text-amber-500 mt-1 flex items-center gap-1">
                                <BsStarFill className="w-5 h-5" />
                                {bookMetrics.avgRating}
                            </p>
                        </div>
                    </div>

                    {/* Top Genres */}
                    {bookMetrics.topGenres.length > 0 && (
                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                            <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 mb-4">
                                Top Reading Genres
                            </h3>
                            <div className="space-y-3">
                                {bookMetrics.topGenres.map(([genre, count]) => {
                                    const percent = Math.min(100, Math.round((count / (books.length || 1)) * 100));
                                    return (
                                        <div key={genre} className="space-y-1">
                                            <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                <span>{genre}</span>
                                                <span>{count} books ({percent}%)</span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* GAMES SEGMENT */}
            {viewSegment === 'games' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Tracked Sessions</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                                {gameMetrics.verifiedHours} hrs
                            </p>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Baseline Hours</p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                                {gameMetrics.baselineHours} hrs
                            </p>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Finished Games</p>
                            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                                {gameMetrics.completedCount}
                            </p>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 border border-gray-200 dark:border-gray-800 shadow-sm">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Avg Rating</p>
                            <p className="text-2xl font-bold text-amber-500 mt-1 flex items-center gap-1">
                                <BsStarFill className="w-5 h-5" />
                                {gameMetrics.avgRating}
                            </p>
                        </div>
                    </div>

                    {/* Top Platforms */}
                    {gameMetrics.topPlatforms.length > 0 && (
                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                            <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 mb-4">
                                Platforms Breakdown
                            </h3>
                            <div className="space-y-3">
                                {gameMetrics.topPlatforms.map(([platform, count]) => {
                                    const percent = Math.min(100, Math.round((count / (games.length || 1)) * 100));
                                    return (
                                        <div key={platform} className="space-y-1">
                                            <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                <span>{platform}</span>
                                                <span>{count} games ({percent}%)</span>
                                            </div>
                                            <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                                                    style={{ width: `${percent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </DiaryShell>
    );
}

InsightsPage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};
