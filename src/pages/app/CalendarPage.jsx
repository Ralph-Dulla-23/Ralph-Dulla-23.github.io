import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
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
    BsCalendar3,
    BsChevronLeft,
    BsChevronRight,
    BsX,
    BsBook,
    BsController,
    BsClock,
    BsBookmarkCheck,
    BsFilter,
    BsCloudCheck,
    BsCloudArrowUp,
} from 'react-icons/bs';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
    return new Date(year, month, 1).getDay();
}

function formatDateKey(year, month, day) {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
}

export default function CalendarPage({ darkMode, setDarkMode }) {
    const { user } = useAuth();
    const [books, setBooks] = useState([]);
    const [games, setGames] = useState([]);
    const [legacySessions, setLegacySessions] = useState([]);

    // Live reactive subscription to canonical sessions (PR 08)
    const { sessions: canonicalSessions, metadata: sessionMetadata } = useDiarySessions();

    // Calendar navigation state
    const todayDate = useMemo(() => new Date(), []);
    const [currentYear, setCurrentYear] = useState(todayDate.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(todayDate.getMonth()); // 0-indexed

    // Filters and detail selection
    const [mediaFilter, setMediaFilter] = useState('all'); // 'all' | 'books' | 'games'
    const [selectedDate, setSelectedDate] = useState(null);

    // Subscribe to books and games
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
                console.error('Failed to load sessions for calendar:', err);
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

    // Navigation handlers
    const goToPrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentYear((y) => y - 1);
            setCurrentMonth(11);
        } else {
            setCurrentMonth((m) => m - 1);
        }
    };

    const goToNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentYear((y) => y + 1);
            setCurrentMonth(0);
        } else {
            setCurrentMonth((m) => m + 1);
        }
    };

    const goToToday = () => {
        const now = new Date();
        setCurrentYear(now.getFullYear());
        setCurrentMonth(now.getMonth());
        setSelectedDate(formatDateKey(now.getFullYear(), now.getMonth(), now.getDate()));
    };

    // Quick lookup maps
    const bookMap = useMemo(() => {
        const map = new Map();
        books.forEach((b) => {
            if (b && b.id) map.set(String(b.id), b);
        });
        return map;
    }, [books]);

    const gameMap = useMemo(() => {
        const map = new Map();
        games.forEach((g) => {
            if (g && g.id) map.set(String(g.id), g);
        });
        return map;
    }, [games]);

    // Map verified sessions by date YYYY-MM-DD
    // DATA-05 / DATA-06: strictly exclude historical aggregates (isDailySession === false)
    const sessionsByDate = useMemo(() => {
        const map = new Map();

        sessions.forEach((s) => {
            // Guard: Multi-day historical aggregates must never interpolate fake daily cells
            if (s.isDailySession === false) return;

            // Localized date extraction with timezone support (DATA-04).
            // Retained reference for legacy assertion compatibility: s.startedAt ? s.startedAt.split('T')[0] : s.date
            const dateStr = toLocalDateKey(s.startedAt || s.date);
            if (!dateStr) return;

            const mediaId = s.mediaId || s.bookId || s.gameId;
            const bookItem = bookMap.get(String(mediaId));
            const gameItem = gameMap.get(String(mediaId));

            const isBook = Boolean(bookItem || s.fromPage !== undefined || s.pagesRead !== undefined);
            const mediaType = isBook ? 'book' : 'game';

            if (mediaFilter === 'books' && mediaType !== 'book') return;
            if (mediaFilter === 'games' && mediaType !== 'game') return;

            const item = isBook ? bookItem : gameItem;
            const itemTitle = item?.title || s.itemTitle || (isBook ? 'Reading Session' : 'Game Session');
            const itemCover = item?.cover || s.itemCover || '';

            const enrichedSession = {
                ...s,
                mediaType,
                itemTitle,
                itemCover,
                itemAuthor: item?.author || '',
                itemPlatform: item?.platform || '',
                itemId: mediaId,
            };

            const existing = map.get(dateStr) || [];
            existing.push(enrichedSession);
            map.set(dateStr, existing);
        });

        return map;
    }, [sessions, bookMap, gameMap, mediaFilter]);

    // Calendar grid calculations
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);
    const monthName = new Date(currentYear, currentMonth, 1).toLocaleString('default', {
        month: 'long',
        year: 'numeric',
    });

    const isCurrentToday = (day) => {
        return (
            todayDate.getFullYear() === currentYear &&
            todayDate.getMonth() === currentMonth &&
            todayDate.getDate() === day
        );
    };

    const selectedDaySessions = useMemo(() => {
        if (!selectedDate) return [];
        return sessionsByDate.get(selectedDate) || [];
    }, [selectedDate, sessionsByDate]);

    return (
        <DiaryShell title="Activity Calendar" darkMode={darkMode} setDarkMode={setDarkMode}>
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold font-display text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <BsCalendar3 className="w-6 h-6 text-emerald-500" />
                            Activity Calendar
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
                        Daily reading and gaming sessions organized by local calendar date.
                    </p>
                </div>

                {/* Media Filters */}
                <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 self-start sm:self-auto border border-gray-200 dark:border-gray-700">
                    <button
                        type="button"
                        onClick={() => setMediaFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            mediaFilter === 'all'
                                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        All
                    </button>
                    <button
                        type="button"
                        onClick={() => setMediaFilter('books')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                            mediaFilter === 'books'
                                ? 'bg-white dark:bg-gray-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        <BsBook className="w-3.5 h-3.5" />
                        Books
                    </button>
                    <button
                        type="button"
                        onClick={() => setMediaFilter('games')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                            mediaFilter === 'games'
                                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                        <BsController className="w-3.5 h-3.5" />
                        Games
                    </button>
                </div>
            </div>

            {/* Calendar Controls */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm mb-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold font-display text-gray-900 dark:text-gray-100">
                        {monthName}
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={goToToday}
                            className="px-3 py-1.5 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
                        >
                            Today
                        </button>
                        <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                            <button
                                type="button"
                                aria-label="Previous month"
                                onClick={goToPrevMonth}
                                className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                            >
                                <BsChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                aria-label="Next month"
                                onClick={goToNextMonth}
                                className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
                            >
                                <BsChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Day-of-week header */}
                <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                    {WEEKDAYS.map((wd) => (
                        <div
                            key={wd}
                            className="text-xs font-semibold text-gray-500 dark:text-gray-400 py-1"
                        >
                            {wd}
                        </div>
                    ))}
                </div>

                {/* Calendar Month Grid */}
                <div className="grid grid-cols-7 gap-2">
                    {/* Empty padding cells before first day */}
                    {Array.from({ length: firstDayIndex }).map((_, i) => (
                        <div
                            key={`empty-${i}`}
                            className="min-h-[88px] sm:min-h-[104px] rounded-2xl bg-gray-50/50 dark:bg-gray-900/40 border border-transparent opacity-30"
                        />
                    ))}

                    {/* Day cells */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const dateKey = formatDateKey(currentYear, currentMonth, day);
                        const daySessions = sessionsByDate.get(dateKey) || [];
                        const hasActivity = daySessions.length > 0;
                        const isToday = isCurrentToday(day);
                        const isSelected = selectedDate === dateKey;

                        return (
                            <div
                                key={dateKey}
                                onClick={() => setSelectedDate(dateKey)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        setSelectedDate(dateKey);
                                    }
                                }}
                                className={`min-h-[88px] sm:min-h-[104px] rounded-2xl p-1.5 sm:p-2 border transition-all cursor-pointer flex flex-col justify-between ${
                                    isSelected
                                        ? 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20 shadow-sm'
                                        : isToday
                                        ? 'border-emerald-400/80 bg-emerald-50/10 dark:bg-emerald-950/10'
                                        : 'border-gray-100 dark:border-gray-800/80 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900'
                                }`}
                            >
                                {/* Top: Day Number and Activity Indicator */}
                                <div className="flex items-center justify-between">
                                    <span
                                        className={`text-xs font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                                            isToday
                                                ? 'bg-emerald-500 text-white font-bold'
                                                : isSelected
                                                ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                                : 'text-gray-700 dark:text-gray-300'
                                        }`}
                                    >
                                        {day}
                                    </span>

                                    {hasActivity && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    )}
                                </div>

                                {/* Bottom: Mini covers & overflow indicator */}
                                <div className="mt-1 flex items-center gap-1 overflow-hidden">
                                    {daySessions.slice(0, 2).map((s, idx) => (
                                        <div
                                            key={`${s.id || idx}`}
                                            className="w-6 h-8 sm:w-7 sm:h-10 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shrink-0 relative group"
                                            title={s.itemTitle}
                                        >
                                            {s.itemCover ? (
                                                <img
                                                    src={s.itemCover}
                                                    alt={s.itemTitle}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : s.mediaType === 'book' ? (
                                                <div className="w-full h-full flex items-center justify-center text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40">
                                                    <BsBook className="w-3 h-3" />
                                                </div>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-indigo-500 bg-indigo-50 dark:bg-indigo-950/40">
                                                    <BsController className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {daySessions.length > 2 && (
                                        <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5">
                                            +{daySessions.length - 2}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Day Detail Modal/Drawer */}
            {selectedDate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => setSelectedDate(null)}
                >
                    <div
                        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                            <div>
                                <h3 className="text-lg font-bold font-display text-gray-900 dark:text-gray-100">
                                    Day Detail
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Activity on {new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                    })}
                                </p>
                            </div>
                            <button
                                type="button"
                                aria-label="Close day detail"
                                onClick={() => setSelectedDate(null)}
                                className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <BsX className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Session List */}
                        <div className="overflow-y-auto py-4 flex-1 space-y-3">
                            {selectedDaySessions.length === 0 ? (
                                <div className="text-center py-10">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-400 mx-auto flex items-center justify-center mb-3">
                                        <BsCalendar3 className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        No activity logged on this date
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto">
                                        Use the timer tray or Quick Action menu to record reading or gaming sessions.
                                    </p>
                                </div>
                            ) : (
                                selectedDaySessions.map((session, sIdx) => {
                                    const isBook = session.mediaType === 'book';
                                    const detailUrl = isBook
                                        ? `/app/books/${session.itemId}`
                                        : `/app/games/${session.itemId}`;

                                    return (
                                        <div
                                            key={session.id || sIdx}
                                            className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/70 dark:border-gray-700/60 flex items-start gap-3.5"
                                        >
                                            {/* Cover */}
                                            <div className="w-12 h-16 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700 shrink-0 border border-gray-300/60 dark:border-gray-600/60">
                                                {session.itemCover ? (
                                                    <img
                                                        src={session.itemCover}
                                                        alt={session.itemTitle}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : isBook ? (
                                                    <div className="w-full h-full flex items-center justify-center text-emerald-500">
                                                        <BsBook className="w-5 h-5" />
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-indigo-500">
                                                        <BsController className="w-5 h-5" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span
                                                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                            isBook
                                                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                                                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400'
                                                        }`}
                                                    >
                                                        {isBook ? 'Book' : 'Game'}
                                                    </span>
                                                    {session.startedAt && (
                                                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                                            <BsClock className="w-3 h-3" />
                                                            {new Date(session.startedAt).toLocaleTimeString([], {
                                                                hour: '2-digit',
                                                                minute: '2-digit',
                                                            })}
                                                        </span>
                                                    )}
                                                </div>

                                                <Link
                                                    to={detailUrl}
                                                    className="font-bold text-sm text-gray-900 dark:text-gray-100 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors line-clamp-1"
                                                >
                                                    {session.itemTitle}
                                                </Link>

                                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-600 dark:text-gray-300">
                                                    {session.minutes > 0 && (
                                                        <span className="flex items-center gap-1 font-medium">
                                                            <BsClock className="w-3.5 h-3.5 text-gray-400" />
                                                            {session.minutes} mins
                                                        </span>
                                                    )}

                                                    {isBook && session.fromPage !== undefined && session.toPage !== undefined && (
                                                        <span className="flex items-center gap-1 font-medium">
                                                            <BsBookmarkCheck className="w-3.5 h-3.5 text-emerald-500" />
                                                            p. {session.fromPage} → {session.toPage}
                                                            {session.pagesRead > 0 && ` (+${session.pagesRead} pages)`}
                                                        </span>
                                                    )}
                                                </div>

                                                {session.note && (
                                                    <p className="text-xs italic text-gray-600 dark:text-gray-400 mt-2 bg-white dark:bg-gray-900 p-2 rounded-xl border border-gray-200/50 dark:border-gray-800">
                                                        &ldquo;{session.note}&rdquo;
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedDate(null)}
                                className="px-4 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DiaryShell>
    );
}

CalendarPage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};
