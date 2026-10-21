import AnimatedNumber from '../../components/motion/AnimatedNumber';
import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { NavLink, Link } from 'react-router-dom';
import { DiaryShell } from '../../components/diary/DiaryShell';
import HomeHighlights from '../../components/home/HomeHighlights';
import { useAuth } from '../../context/AuthContext';
import { useTimer } from '../../context/TimerContext';
import { watchPublicBooks, watchPublicGames } from '../../lib/db';
import { useDiarySessions } from '../../hooks/useDiarySessions';
import { toLocalDateKey, getCurrentLocalDateKey } from '../../domain/dates';
import {
    BsBook,
    BsController,
    BsCalendar3,
    BsJournalText,
    BsClock,
    BsArrowRight,
    BsPlusLg,
    BsCloudArrowUp,
} from 'react-icons/bs';

export default function HomePage({ darkMode, setDarkMode }) {
    const { user } = useAuth();
    const { startTimer } = useTimer();

    const [activeBooks, setActiveBooks] = useState([]);
    const [activeGames, setActiveGames] = useState([]);
    const [loading, setLoading] = useState(true);

    // Live reactive subscription to canonical sessions (PR 08)
    const { sessions: liveSessions, loading: sessionLoading, metadata: sessionMetadata, error: sessionError } = useDiarySessions();

    const todayFormatted = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    }).format(new Date());

    const [todayDateKey, setTodayDateKey] = useState(getCurrentLocalDateKey);
    useEffect(() => {
        const refreshToday = () => setTodayDateKey(getCurrentLocalDateKey());
        document.addEventListener('visibilitychange', refreshToday);
        const id = setInterval(refreshToday, 60_000);
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', refreshToday); };
    }, []);

    const todayStats = useMemo(() => {
        let readingMinutes = 0;
        let pagesLogged = 0;
        let gamingMinutes = 0;
        let sessionCount = 0;

        (liveSessions || []).forEach((s) => {
            if (s.isDailySession === false) return;
            const dateStr = toLocalDateKey(s.date || s.startedAt);
            if (dateStr !== todayDateKey) return;

            sessionCount += 1;
            const isBook = s.mediaType ? s.mediaType === 'book' : (s.fromPage !== undefined || s.pagesRead !== undefined);
            const durationMins = s.durationMinutes || (s.activeSeconds ? Math.round(s.activeSeconds / 60) : 0);

            if (isBook) {
                readingMinutes += durationMins;
                if (typeof s.pagesRead === 'number') {
                    pagesLogged += s.pagesRead;
                } else if (s.endPage !== undefined && s.startPage !== undefined) {
                    pagesLogged += Math.max(0, Number(s.endPage) - Number(s.startPage));
                }
            } else {
                gamingMinutes += durationMins;
            }
        });

        return {
            readingMinutes,
            pagesLogged,
            gamingMinutes,
            sessionCount,
            hasData: sessionCount > 0,
        };
    }, [liveSessions, todayDateKey]);

    useEffect(() => {
        if (!user) return;
        let booksLoaded = false;
        let gamesLoaded = false;

        const unsubBooks = watchPublicBooks(user.uid, (books) => {
            const reading = books.filter((b) => b.status === 'reading');
            setActiveBooks(reading);
            booksLoaded = true;
            if (gamesLoaded) setLoading(false);
        });

        const unsubGames = watchPublicGames(user.uid, (games) => {
            const playing = games.filter((g) => {
                const s = g.status || (g.finishedOn ? 'finished' : 'playing');
                return s === 'playing';
            });
            setActiveGames(playing);
            gamesLoaded = true;
            if (booksLoaded) setLoading(false);
        });

        return () => {
            unsubBooks();
            unsubGames();
        };
    }, [user]);

    const handleContinueBook = (book) => {
        const safeId = String(book.id || book.coverId || (book.title || 'book').replace(/\s+/g, '-').toLowerCase());
        startTimer({
            mediaType: 'book',
            itemId: safeId,
            itemTitle: book.title,
            itemCover: book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg` : ''),
            fromPage: book.currentPage || 0,
            totalPages: book.pages || null,
        });
    };

    const handleContinueGame = (game) => {
        const safeId = String(game.id || game.rawgId || game.title);
        startTimer({
            mediaType: 'game',
            itemId: safeId,
            itemTitle: game.title,
            itemCover: game.cover || '',
            fromHours: game.hoursPlayed || 0,
        });
    };

    return (
        <DiaryShell title="Diary Home" darkMode={darkMode} setDarkMode={setDarkMode}>
            {/* Header Greeting */}
            <div className="mb-8 diary-section-motion">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                        {todayFormatted}
                    </div>
                    {sessionError ? (
                            <span role="alert" className="text-xs text-red-600 dark:text-red-400">Sessions unavailable: {sessionError.code || sessionError.message}</span>
                        ) : sessionMetadata?.hasPendingWrites ? (
                            <span className="text-xs text-amber-700 dark:text-amber-300" role="status"><BsCloudArrowUp className="inline-block mr-1" />Unsynced changes</span>
                        ) : null}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-gray-900 dark:text-gray-100">
                    Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    A little reading, a little adventure. Make today yours.
                </p>
            </div>

            <HomeHighlights books={activeBooks} games={activeGames} sessions={liveSessions} loading={loading} onRead={handleContinueBook} onPlay={handleContinueGame} />

            {/* Today Summary */}
            <div className="mb-8 diary-section-motion">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                    Today&apos;s Summary
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="diary-stat-card p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 shadow-sm">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1">
                            <BsClock className="w-3.5 h-3.5 text-primary dark:text-emerald-400" />
                            Reading Time
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {sessionError || sessionLoading ? '—' : <AnimatedNumber value={todayStats.readingMinutes} />}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">minutes</div>
                    </div>

                    <div className="diary-stat-card p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 shadow-sm">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1">
                            <BsBook className="w-3.5 h-3.5 text-primary dark:text-emerald-400" />
                            Pages Logged
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {sessionError || sessionLoading ? '—' : <AnimatedNumber value={todayStats.pagesLogged} />}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">pages</div>
                    </div>

                    <div className="diary-stat-card p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 shadow-sm">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1">
                            <BsController className="w-3.5 h-3.5 text-primary dark:text-emerald-400" />
                            Gaming Time
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {sessionError || sessionLoading ? '—' : <AnimatedNumber value={todayStats.gamingMinutes} />}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">minutes</div>
                    </div>

                    <div className="diary-stat-card p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 shadow-sm">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1">
                            <BsCalendar3 className="w-3.5 h-3.5 text-primary dark:text-emerald-400" />
                            Activities
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            <AnimatedNumber value={Math.max(0, todayStats.sessionCount)} />
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">sessions today</div>
                    </div>
                </div>
            </div>

            {/* Quick Navigation Cards */}
            <div className="mb-8 diary-section-motion">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                    Diary Sections
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <NavLink
                        to="/app/library/books"
                        className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 shadow-sm diary-card-interactive group flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                <BsBook className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                    Books Collection
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Browse reading status, pages & reviews
                                </div>
                            </div>
                        </div>
                        <BsArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                    </NavLink>

                    <NavLink
                        to="/app/library/games"
                        className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 shadow-sm diary-card-interactive group flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                <BsController className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                    Games Backlog
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Track playing titles, platforms & hours
                                </div>
                            </div>
                        </div>
                        <BsArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                    </NavLink>

                    <NavLink
                        to="/app/calendar"
                        className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 shadow-sm diary-card-interactive group flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <BsCalendar3 className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                    Activity Calendar
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Cover-based reading and gaming history
                                </div>
                            </div>
                        </div>
                        <BsArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                    </NavLink>

                    <NavLink
                        to="/app/journal"
                        className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 shadow-sm diary-card-interactive group flex items-center justify-between"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                                <BsJournalText className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">
                                    Journal & Notes
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Private reflections and quotes
                                </div>
                            </div>
                        </div>
                        <BsArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-1 transition-transform" />
                    </NavLink>
                </div>
            </div>
        </DiaryShell>
    );
}

HomePage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};
