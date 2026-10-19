import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { NavLink, Link } from 'react-router-dom';
import { DiaryShell } from '../../components/diary/DiaryShell';
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
    BsPlayFill,
    BsPlusLg,
    BsCloudCheck,
    BsCloudArrowUp,
} from 'react-icons/bs';

export default function HomePage({ darkMode, setDarkMode }) {
    const { user } = useAuth();
    const { startTimer } = useTimer();

    const [activeBooks, setActiveBooks] = useState([]);
    const [activeGames, setActiveGames] = useState([]);
    const [loading, setLoading] = useState(true);

    // Live reactive subscription to canonical sessions (PR 08)
    const { sessions: liveSessions, metadata: sessionMetadata } = useDiarySessions();

    const todayFormatted = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    }).format(new Date());

    const todayDateKey = useMemo(() => getCurrentLocalDateKey(), []);

    const todayStats = useMemo(() => {
        let readingMinutes = 0;
        let pagesLogged = 0;
        let gamingMinutes = 0;
        let sessionCount = 0;

        (liveSessions || []).forEach((s) => {
            if (s.isDailySession === false) return;
            const dateStr = toLocalDateKey(s.startedAt || s.date);
            if (dateStr !== todayDateKey) return;

            sessionCount += 1;
            const isBook = s.mediaType === 'book' || s.fromPage !== undefined || s.pagesRead !== undefined;
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
            <div className="mb-8">
                <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
                        {todayFormatted}
                    </div>
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
                <h1 className="text-2xl sm:text-3xl font-bold font-display text-gray-900 dark:text-gray-100">
                    Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Resume your reading, track gaming playtime, and record reflections.
                </p>
            </div>

            {/* Currently Active Section */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        Currently Active
                    </h2>
                    <NavLink
                        to="/app/library/books"
                        className="text-xs font-semibold text-primary dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                        View all <BsArrowRight className="w-3 h-3" />
                    </NavLink>
                </div>

                {loading ? (
                    <div className="p-8 text-center bg-white dark:bg-gray-900 rounded-2xl border border-border dark:border-gray-800">
                        <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-xs text-secondary">Loading active items...</p>
                    </div>
                ) : activeBooks.length === 0 && activeGames.length === 0 ? (
                    <div className="p-6 text-center bg-white dark:bg-gray-900 rounded-2xl border border-dashed border-border dark:border-gray-800">
                        <p className="text-sm font-semibold text-primary dark:text-gray-200">
                            No books or games currently in progress
                        </p>
                        <p className="text-xs text-secondary dark:text-gray-400 mt-1 mb-4">
                            Pick an item from your collection or add a new one to start tracking.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <Link
                                to="/app/library/books"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold"
                            >
                                <BsPlusLg className="w-3 h-3" /> Browse Books
                            </Link>
                            <Link
                                to="/app/library/games"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-primary dark:text-gray-200 text-xs font-semibold"
                            >
                                <BsController className="w-3 h-3" /> Browse Games
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Currently Reading Books */}
                        {activeBooks.map((book) => {
                            const safeId = String(book.id || book.coverId || (book.title || 'book').replace(/\s+/g, '-').toLowerCase());
                            const coverSrc = book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg` : '');
                            return (
                                <div
                                    key={`book-${safeId}`}
                                    className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-border dark:border-gray-800 shadow-sm flex items-center gap-4 hover:border-primary/40 dark:hover:border-gray-700 transition-colors"
                                >
                                    <Link to={`/app/books/${safeId}`} className="shrink-0">
                                        <div className="w-14 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-border/40">
                                            {coverSrc ? (
                                                <img src={coverSrc} alt={book.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <BsBook className="w-5 h-5 text-secondary" />
                                                </div>
                                            )}
                                        </div>
                                    </Link>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300">
                                                Reading
                                            </span>
                                        </div>
                                        <Link to={`/app/books/${safeId}`}>
                                            <h3 className="text-sm font-bold text-primary dark:text-gray-100 truncate hover:text-blue-500 transition-colors">
                                                {book.title}
                                            </h3>
                                        </Link>
                                        <p className="text-xs text-secondary dark:text-gray-400 truncate">
                                            {book.author}
                                        </p>
                                        <p className="text-[11px] text-secondary dark:text-gray-500 mt-1">
                                            {book.pages ? `${book.currentPage || 0} / ${book.pages} pages (${book.progress || 0}%)` : `${book.currentPage || 0} pages read`}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => handleContinueBook(book)}
                                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                                        title="Continue reading session"
                                    >
                                        <BsPlayFill className="w-4 h-4" />
                                        <span>Continue</span>
                                    </button>
                                </div>
                            );
                        })}

                        {/* Currently Playing Games */}
                        {activeGames.map((game) => {
                            const safeId = String(game.id || game.rawgId || game.title);
                            return (
                                <div
                                    key={`game-${safeId}`}
                                    className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-border dark:border-gray-800 shadow-sm flex items-center gap-4 hover:border-primary/40 dark:hover:border-gray-700 transition-colors"
                                >
                                    <Link to={`/app/games/${safeId}`} className="shrink-0">
                                        <div className="w-14 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-border/40">
                                            {game.cover ? (
                                                <img src={game.cover} alt={game.title} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <BsController className="w-5 h-5 text-secondary" />
                                                </div>
                                            )}
                                        </div>
                                    </Link>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300">
                                                Playing
                                            </span>
                                        </div>
                                        <Link to={`/app/games/${safeId}`}>
                                            <h3 className="text-sm font-bold text-primary dark:text-gray-100 truncate hover:text-blue-500 transition-colors">
                                                {game.title}
                                            </h3>
                                        </Link>
                                        <p className="text-xs text-secondary dark:text-gray-400 truncate">
                                            {game.platform || 'General'}
                                        </p>
                                        <p className="text-[11px] text-secondary dark:text-gray-500 mt-1">
                                            {game.hoursPlayed ? `${game.hoursPlayed}h played` : '0h played'}
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => handleContinueGame(game)}
                                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                                        title="Continue gaming session"
                                    >
                                        <BsPlayFill className="w-4 h-4" />
                                        <span>Continue</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Today Summary */}
            <div className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                    Today&apos;s Summary
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 shadow-sm">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1">
                            <BsClock className="w-3.5 h-3.5 text-primary dark:text-emerald-400" />
                            Reading Time
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {todayStats.readingMinutes > 0 ? todayStats.readingMinutes : '—'}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">minutes</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 shadow-sm">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1">
                            <BsBook className="w-3.5 h-3.5 text-primary dark:text-emerald-400" />
                            Pages Logged
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {todayStats.pagesLogged > 0 ? todayStats.pagesLogged : '—'}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">pages</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 shadow-sm">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1">
                            <BsController className="w-3.5 h-3.5 text-primary dark:text-emerald-400" />
                            Gaming Time
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {todayStats.gamingMinutes > 0 ? todayStats.gamingMinutes : '—'}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">minutes</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 shadow-sm">
                        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mb-1">
                            <BsCalendar3 className="w-3.5 h-3.5 text-primary dark:text-emerald-400" />
                            Activities
                        </div>
                        <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {todayStats.sessionCount > 0 ? todayStats.sessionCount : 0}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">sessions today</div>
                    </div>
                </div>
            </div>

            {/* Quick Navigation Cards */}
            <div className="mb-8">
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                    Diary Sections
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <NavLink
                        to="/app/library/books"
                        className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 shadow-sm hover:shadow transition-all group flex items-center justify-between"
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
                        className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 shadow-sm hover:shadow transition-all group flex items-center justify-between"
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
                        className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 shadow-sm hover:shadow transition-all group flex items-center justify-between"
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
                        className="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/70 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 shadow-sm hover:shadow transition-all group flex items-center justify-between"
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
