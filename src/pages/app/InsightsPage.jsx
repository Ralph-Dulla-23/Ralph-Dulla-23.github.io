import AdvancedInsights from '../../components/diary/AdvancedInsights';
import ReadingGoals from '../../components/diary/ReadingGoals';
import PremiumInsights from '../../components/diary/PremiumInsights';
import { useBookmoryHistory } from '../../hooks/useBookmoryHistory';
import AnimatedNumber from '../../components/motion/AnimatedNumber';
import DailyReadingTimeline from '../../components/diary/DailyReadingTimeline';
import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { DiaryShell } from '../../components/diary/DiaryShell';
import { useAuth } from '../../context/AuthContext';
import {
    watchPublicBooks,
    watchPublicGames,
    watchJournalEntries,
    getAllSessions,
} from '../../lib/db';
import { useDiarySessions } from '../../hooks/useDiarySessions';
import { toLocalDateKey, DEFAULT_TIMEZONE } from '../../domain/dates';
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
    BsCloudArrowUp,
} from 'react-icons/bs';

export default function InsightsPage({ darkMode, setDarkMode }) {
    const { user } = useAuth();
    const { aggregates, error: historyError } = useBookmoryHistory();
    const [books, setBooks] = useState([]);
    const [games, setGames] = useState([]);
    const [journal, setJournal] = useState([]);
    const [legacySessions, setLegacySessions] = useState([]);

    // Live reactive subscription to canonical sessions (PR 08)
    const { sessions: canonicalSessions, metadata: sessionMetadata, error: sessionError } = useDiarySessions();

    // Filters
    const [showClassic, setShowClassic] = useState(false);
    const [viewSegment, setViewSegment] = useState('combined'); // 'combined' | 'books' | 'games'
    const [timeRange, setTimeRange] = useState('all'); // 'month' | 'year' | 'all' | 'custom'
    const [customRange, setCustomRange] = useState({ from: '', to: '' });

    // Observe books and games
    useEffect(() => {
        if (!user) return;
        const unsubBooks = watchPublicBooks(user.uid, setBooks);
        const unsubGames = watchPublicGames(user.uid, setGames);
        const unsubJournal = watchJournalEntries(user.uid, setJournal);

        return () => {
            unsubBooks();
            unsubGames();
            unsubJournal();
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
        return filterSessionsByTimeRange(sessions, timeRange, DEFAULT_TIMEZONE, customRange);
    }, [sessions, timeRange, customRange]);

    // Metrics for Books computed via centralized domain selectors
    const bookMetrics = useMemo(() => {
        return calculateBookInsights(books, sessions, timeRange, DEFAULT_TIMEZONE, customRange);
    }, [books, sessions, timeRange, customRange]);

    // Metrics for Games computed via centralized domain selectors (normalizes finished -> completed)
    const gameMetrics = useMemo(() => {
        return calculateGameInsights(games, sessions, timeRange, DEFAULT_TIMEZONE, customRange);
    }, [games, sessions, timeRange, customRange]);

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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-base font-semibold font-display text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <BsBarChart className="w-4 h-4 text-sky-500" />
                            Overview
                        </h1>
                        {sessionError ? (
                            <span role="alert" className="text-xs text-red-600 dark:text-red-400">Sessions unavailable: {sessionError.code || sessionError.message}</span>
                        ) : sessionMetadata?.hasPendingWrites ? (
                            <span className="text-xs text-amber-700 dark:text-amber-300" role="status"><BsCloudArrowUp className="inline-block mr-1" />Unsynced changes</span>
                        ) : null}
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            timeRange === 'all'
                                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        All Time
                    </button>
                </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Insights date range">
              <button type="button" onClick={() => setTimeRange('custom')} aria-pressed={timeRange === 'custom'} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${timeRange === 'custom' ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-900/20 dark:text-sky-200' : 'border-gray-200 text-gray-600 dark:border-slate-700 dark:text-slate-300'}`}>Custom range</button>
              {timeRange === 'custom' && <div className="flex w-full gap-2 sm:w-auto">
                <label className="min-w-0 flex-1 text-xs text-gray-600 dark:text-slate-300">From<input type="date" aria-label="Insights start date" value={customRange.from} onChange={e => setCustomRange(prev => ({...prev, from:e.target.value}))} className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 bg-transparent px-2 py-2 dark:border-slate-600" /></label>
                <label className="min-w-0 flex-1 text-xs text-gray-600 dark:text-slate-300">To<input type="date" aria-label="Insights end date" value={customRange.to} onChange={e => setCustomRange(prev => ({...prev, to:e.target.value}))} className="mt-1 block w-full min-w-0 rounded-lg border border-gray-300 bg-transparent px-2 py-2 dark:border-slate-600" /></label>
              </div>}
              {timeRange === 'custom' && (!customRange.from || !customRange.to || customRange.from > customRange.to) && <p role="alert" className="w-full text-xs text-amber-700 dark:text-amber-300">Select a valid start and end date. Period statistics will remain empty until then.</p>}
            </div>

            {/* Segmented View Switcher: Combined | Books | Games */}
            <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-800 mb-4">
                <button
                    type="button"
                    onClick={() => setViewSegment('combined')}
                    className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
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
                    className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
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
                    className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
                        viewSegment === 'games'
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                >
                    <BsController className="w-4 h-4" />
                    Games
                </button>
            </div>

            <PremiumInsights
                books={books} games={games} sessions={sessions} aggregates={aggregates}
                timeRange={timeRange} customRange={customRange} segment={viewSegment} historyError={historyError}
            />
            <AdvancedInsights
                books={books} games={games} sessions={sessions} aggregates={aggregates}
                journal={journal} timeRange={timeRange} customRange={customRange} segment={viewSegment}
            />
            {(viewSegment === 'books' || viewSegment === 'combined') && (
                <ReadingGoals books={books} games={games} sessions={sessions} />
            )}

            <button type="button" onClick={() => setShowClassic((previous) => !previous)}
                aria-expanded={showClassic}
                className="mt-4 mb-3 px-3 py-2 text-xs rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
                {showClassic ? 'Hide classic summary' : 'Show classic summary'}
            </button>
            {showClassic && <>
            {/* COMBINED SEGMENT */}
            {viewSegment === 'combined' && (
                <div className="space-y-6">
                    <DailyReadingTimeline books={books} sessions={filteredSessions} />
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
                                    <AnimatedNumber value={combinedActiveDays} />
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
                                    <AnimatedNumber value={bookMetrics.completedCount} />
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
                                    <AnimatedNumber value={gameMetrics.completedCount} />
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
                                        <AnimatedNumber value={books.length} />
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
                    <DailyReadingTimeline books={books} sessions={filteredSessions} />
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
            </>}
        </DiaryShell>
    );
}

InsightsPage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};
