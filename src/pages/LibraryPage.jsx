import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Lenis from 'lenis';
import GenreFilter from '../components/library/GenreFilter';
import { observePublicShelf } from '../services/publicShelfService';
import { OWNER_UID, isFirebaseConfigured } from '../lib/config';
import fallbackBooks from '../data/books';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { useAuth } from '../context/AuthContext';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
    CartesianGrid,
} from 'recharts';

import { Icons } from '../components/library/Icons';
import BookCard from '../components/library/BookCard';
import { StatCard, ProgressRing } from '../components/library/Stats';
import BookModal from '../components/library/BookModal';
import SteamShowcaseCard from '../components/steam/SteamShowcaseCard';
import { loadSteamStats, findSteamGameHours, normalizeTitle } from '../lib/steam';
import {
    BsController,
    BsBook,
    BsBookHalf,
    BsCheckCircleFill,
    BsBookmarkHeart,
    BsPauseCircle,
    BsHeartFill,
    BsStarFill,
    BsClock,
    BsCalendarCheck,
    BsLaptop,
    BsArrowRight,
    BsBarChart,
    BsSteam,
    BsBoxArrowUpRight,
} from 'react-icons/bs';

const BOOK_CATEGORIES = [
    {
        key: 'reading',
        title: 'Reading',
        match: (b) => b.status === 'reading',
        icon: <BsBookHalf className="w-4 h-4 text-blue-500" />,
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
    },
    {
        key: 'completed',
        title: 'Read',
        match: (b) => b.status === 'completed',
        icon: <BsCheckCircleFill className="w-4 h-4 text-emerald-500" />,
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    },
    {
        key: 'want-to-read',
        title: 'To be Read',
        match: (b) => b.status === 'want-to-read',
        icon: <BsBookmarkHeart className="w-4 h-4 text-purple-500" />,
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
    },
    {
        key: 'dropped',
        title: 'Dropped',
        match: (b) => b.status === 'dropped' || !['reading', 'completed', 'want-to-read'].includes(b.status),
        icon: <BsPauseCircle className="w-4 h-4 text-rose-500" />,
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    },
];

const SINGLE_FILTER_META = {
    reading: {
        title: 'Reading',
        icon: <BsBookHalf className="w-4 h-4 text-blue-500" />,
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
    },
    completed: {
        title: 'Read',
        icon: <BsCheckCircleFill className="w-4 h-4 text-emerald-500" />,
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    },
    'want-to-read': {
        title: 'To be Read',
        icon: <BsBookmarkHeart className="w-4 h-4 text-purple-500" />,
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
    },
    dropped: {
        title: 'Dropped',
        icon: <BsPauseCircle className="w-4 h-4 text-rose-500" />,
        badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    },
    favorites: {
        title: 'Favorites',
        icon: <BsHeartFill className="w-4 h-4 text-pink-500" />,
        badgeColor: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800/60',
    },
};

const getRatingColor = (score) => {
    if (score >= 9) return '#10b981';
    if (score >= 8) return '#8b5cf6';
    if (score >= 7) return '#3b82f6';
    if (score >= 6) return '#f59e0b';
    return '#ef4444';
};

const CustomChartTooltip = ({ active, payload, label, darkMode, suffix = 'games' }) => {
    if (active && payload && payload.length) {
        const val = payload[0].value;
        return (
            <div
                className={`px-3 py-1.5 rounded-lg text-xs shadow-lg border backdrop-blur-md ${
                    darkMode
                        ? 'bg-gray-900/95 border-gray-700 text-gray-100'
                        : 'bg-white/95 border-gray-200 text-gray-800'
                }`}
            >
                <p className="font-semibold">{label}</p>
                <p className="text-[11px] text-secondary dark:text-gray-400 mt-0.5">
                    <span className="font-bold text-primary dark:text-gray-100">{val}</span>{' '}
                    {val === 1 ? suffix.replace(/s$/, '') : suffix}
                </p>
            </div>
        );
    }
    return null;
};

CustomChartTooltip.propTypes = {
    active: PropTypes.bool,
    payload: PropTypes.array,
    label: PropTypes.any,
    darkMode: PropTypes.bool,
    suffix: PropTypes.string,
};

/**
 * Resolves context-aware candidate book pool for the random picker.
 * - Base candidate pool: books where status === 'reading' || status === 'want-to-read'.
 * - If genreFilter is active (truthy and not 'all'): filter candidate pool strictly by that genre.
 * - If no books match the filtered pool, gracefully fall back to all reading/to-read books.
 */
function getCandidateBooks(books, genreFilter) {
    const basePool = (books || []).filter(
        (b) => b.status === 'reading' || b.status === 'want-to-read'
    );
    if (genreFilter && genreFilter !== 'all') {
        const filteredPool = basePool.filter(
            (b) => b.genre === genreFilter || (Array.isArray(b.genres) && b.genres.includes(genreFilter))
        );
        if (filteredPool.length > 0) {
            return filteredPool;
        }
    }
    return basePool;
}

/**
 * LibraryPage component that displays the user's reading collection, finished games, and stats.
 */
const LibraryPage = ({ darkMode, setDarkMode, initialTab = 'books' }) => {
    const { isOwner } = useAuth();
    const isNative = typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
    const showDiaryButton = isOwner || isNative;

    const [activeTab, setActiveTab] = useState(initialTab);
    const [books, setBooks] = useState([]);
    const [games, setGames] = useState([]);
    const [steamData, setSteamData] = useState(null);
    const [gamesLoading, setGamesLoading] = useState(true);
    const [shelfError, setShelfError] = useState(null);
    useEffect(() => {
        loadSteamStats().then(setSteamData).catch(() => {});
    }, []);

    const [filter, setFilter] = useState('all');
    const [genreFilter, setGenreFilter] = useState('all');
    const [selectedBook, setSelectedBook] = useState(null);

    // Platform filter for games
    const [platformFilter, setPlatformFilter] = useState('all');

    const headerRef = useScrollAnimation();
    const statsRef = useScrollAnimation();
    const progressRef = useScrollAnimation();
    const favRef = useScrollAnimation();
    const pickRef = useScrollAnimation();
    const filterRef = useScrollAnimation();
    const gridRef = useScrollAnimation();
    const footerRef = useScrollAnimation();
    const gameStatsRef = useScrollAnimation();

    // Notify window and Lenis when active tab toggles to recalculate heights and trigger intersection observations
    useEffect(() => {
        window.dispatchEvent(new Event('resize'));
    }, [activeTab]);

    // Subscribe to public shelf for books and games
    useEffect(() => {
        const unsubscribe = observePublicShelf(OWNER_UID, (items) => {
            const publicBooks = items.filter((item) => item.mediaType === 'book' || !item.mediaType);
            const publicGames = items.filter((item) => item.mediaType === 'game');
            setBooks(publicBooks);
            setGames(publicGames);
            setGamesLoading(false);
            setShelfError(null);
        }, (error) => {
            if (!isFirebaseConfigured()) {
                setBooks(fallbackBooks);
                setShelfError(null);
            } else {
                setShelfError(error?.code || error?.message || 'Could not load published shelf');
            }
            setGamesLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        // Native touch and reduced-motion users do not need a continuous smooth-scroll loop.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || window.Capacitor?.isNativePlatform?.()) return undefined;
    const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
        });

        let rafId = 0;
    function raf(time) {
      rafId = 0;
      if (document.hidden) return;
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    const onVisibility = () => {
      if (!document.hidden && !rafId) rafId = requestAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVisibility);
    rafId = requestAnimationFrame(raf);
    lenis.scrollTo(0, { immediate: true });
    return () => {
            cancelAnimationFrame(rafId);
            document.removeEventListener('visibilitychange', onVisibility);
            lenis.destroy();
        };
    }, []);

    // Book metrics
    const completedBooks = books.filter(b => b.status === 'completed');
    const readingBooks = books.filter(b => b.status === 'reading');
    const favorites = books.filter(b => b.favorite);
    const ratedBooks = books.filter(b => b.rating);
    const avgRating = ratedBooks.length > 0
        ? (ratedBooks.reduce((s, b) => s + Number(b.rating), 0) / ratedBooks.length).toFixed(1)
        : '0.0';
    const pctComplete = Math.round((completedBooks.length / (books.length || 1)) * 100);

    const authorCounts = {};
    books.forEach(b => {
        if (b.author) authorCounts[b.author] = (authorCounts[b.author] || 0) + 1;
    });
    const topAuthors = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]);
    const maxAuthorCount = topAuthors[0]?.[1] || 1;

    const filteredBooks = books.filter(b => {
        const statusMatch = filter === 'all' || filter === b.status || (filter === 'favorites' && b.favorite);
        const bookGenres = Array.isArray(b.genres) ? b.genres : [];
        const genreMatch = genreFilter === 'all' || bookGenres.includes(genreFilter);
        return statusMatch && genreMatch;
    });

    const pickRandom = () => {
        const pool = getCandidateBooks(books, genreFilter);
        if (pool.length) setSelectedBook(pool[Math.floor(Math.random() * pool.length)]);
    };

    // Unified Games: Enrich with Steam data & include active Steam games
    const unifiedGames = useMemo(() => {
        const steamTitles = new Set();
        const enriched = games.map((g) => {
            const match = findSteamGameHours(g.title, steamData);
            if (match) {
                steamTitles.add(normalizeTitle(g.title));
                return {
                    ...g,
                    isSteam: true,
                    steamAppId: match.appId,
                    hoursPlayed: Number(g.hoursPlayed) || match.hours || 0,
                    storeUrl: match.appId ? `https://store.steampowered.com/app/${match.appId}` : null,
                };
            }
            return g;
        });

        const pool = [
            ...(Array.isArray(steamData?.ownedGamesSummary) ? steamData.ownedGamesSummary : []),
            ...(Array.isArray(steamData?.recentGames) ? steamData.recentGames : []),
        ];

        const seenAppIds = new Set(
            enriched.filter((g) => g.steamAppId).map((g) => String(g.steamAppId))
        );

        const additionalSteamGames = [];
        for (const sg of pool) {
            const safeAppId = String(sg.appId);
            const normTitle = normalizeTitle(sg.name);
            const hours = Number(sg.playtimeForeverHours) || 0;
            if (
                safeAppId !== '480' &&
                sg.name &&
                sg.name !== 'Spacewar' &&
                hours >= 1 &&
                !seenAppIds.has(safeAppId) &&
                !steamTitles.has(normTitle)
            ) {
                seenAppIds.add(safeAppId);
                steamTitles.add(normTitle);
                additionalSteamGames.push({
                    id: `steam-${safeAppId}`,
                    title: sg.name,
                    cover: sg.logoUrl || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${safeAppId}/header.jpg`,
                    platform: 'Steam',
                    hoursPlayed: Number(sg.playtimeForeverHours) || 0,
                    rating: null,
                    status: (Number(sg.playtimeForeverHours) || 0) > 0 ? 'playing' : 'backlog',
                    isSteam: true,
                    steamAppId: safeAppId,
                    storeUrl: sg.storeUrl || `https://store.steampowered.com/app/${safeAppId}`,
                    finishedOn: null,
                });
            }
        }

        additionalSteamGames.sort((a, b) => (b.hoursPlayed || 0) - (a.hoursPlayed || 0));

        return [...enriched, ...additionalSteamGames];
    }, [games, steamData]);

    // Games metrics
    const finishedGames = games.filter(g => g.status === 'finished' || g.finishedOn);
    const totalGameHours = games.reduce((sum, g) => sum + (Number(g.hoursPlayed) || 0), 0);
    const ratedGames = games.filter(g => Number(g.rating) > 0);
    const avgGameRating = ratedGames.length > 0
        ? (ratedGames.reduce((sum, g) => sum + Number(g.rating), 0) / ratedGames.length).toFixed(1)
        : '0.0';

    const hasSteamGames = unifiedGames.some(g => g.isSteam || g.platform === 'Steam');
    const platformsSet = new Set();
    if (hasSteamGames) platformsSet.add('Steam');
    unifiedGames.forEach(g => { if (g.platform && g.platform !== 'Steam') platformsSet.add(g.platform); });
    const allPlatforms = Array.from(platformsSet);

    const filteredGames = unifiedGames.filter(g => {
        if (platformFilter === 'all') return true;
        if (platformFilter === 'Steam') return g.isSteam || g.platform === 'Steam';
        return g.platform === platformFilter;
    });

    // Recharts colors
    const axisColor = darkMode ? '#374151' : '#e5e7eb';
    const textColor = darkMode ? '#9ca3af' : '#6b7280';
    const gridColor = darkMode ? '#1f2937' : '#f3f4f6';

    // Games rating distribution (1 to 10 scale)
    const ratingDistribution = useMemo(() => {
        const rated = games.filter(g => Number(g.rating) > 0);
        if (rated.length === 0) return [];

        const bucketCounts = {};
        for (let r = 1; r <= 10; r++) {
            bucketCounts[r] = 0;
        }

        rated.forEach(g => {
            const val = Math.round(Number(g.rating));
            if (val >= 1 && val <= 10) {
                bucketCounts[val] = (bucketCounts[val] || 0) + 1;
            }
        });

        const nonZeroRatings = Object.entries(bucketCounts)
            .filter(([, count]) => count > 0)
            .map(([r]) => Number(r));

        const minR = nonZeroRatings.length > 0 ? Math.max(1, Math.min(...nonZeroRatings) - 1) : 1;
        const maxR = 10;

        const data = [];
        for (let r = minR; r <= maxR; r++) {
            data.push({
                rating: `${r}/10`,
                rawRating: r,
                count: bucketCounts[r] || 0,
            });
        }
        return data;
    }, [games]);

    // Finished games by year
    const finishedByYear = useMemo(() => {
        const yearMap = {};
        games.forEach(g => {
            const dateStr = g.finishedOn || '';
            const year = dateStr.slice(0, 4);
            if (year && !isNaN(year) && year.length === 4) {
                yearMap[year] = (yearMap[year] || 0) + 1;
            }
        });

        return Object.entries(yearMap)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([year, count]) => ({
                year,
                count,
            }));
    }, [games]);

    // Top genres distribution
    const topGameGenres = useMemo(() => {
        const genreMap = {};
        games.forEach(g => {
            const list = Array.isArray(g.genres)
                ? g.genres
                : typeof g.genre === 'string'
                    ? g.genre.split(',').map(s => s.trim())
                    : [];
            list.forEach(genre => {
                if (genre && typeof genre === 'string') {
                    const clean = genre.trim();
                    if (clean) {
                        genreMap[clean] = (genreMap[clean] || 0) + 1;
                    }
                }
            });
        });

        return Object.entries(genreMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 7)
            .map(([genre, count]) => ({
                genre,
                count,
            }));
    }, [games]);

    return (
        <div className={`min-h-screen transition-colors ${darkMode ? 'dark bg-gray-950 text-gray-100' : 'bg-background text-primary'}`}>
            {shelfError && (
                <div role="alert" className="mx-auto max-w-4xl px-6 pt-4 text-sm text-amber-800 dark:text-amber-300">
                    Published shelf unavailable ({shelfError}). Check the Firebase project and deployed Firestore rules.
                </div>
            )}
            <header className="max-w-4xl mx-auto px-6 pt-10 pb-4" ref={headerRef} data-animate>
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        <Link
                            to="/portfolio"
                            className="inline-flex items-center gap-1.5 text-sm text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 transition-colors"
                        >
                            {Icons.chevronLeft()}
                            Back to Home
                        </Link>
                        {showDiaryButton && (
                            <Link
                                to="/app/games"
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 dark:bg-gray-800 text-primary dark:text-gray-200 hover:bg-primary hover:text-white dark:hover:bg-gray-700 text-xs font-semibold transition-all border border-primary/20 dark:border-gray-700"
                            >
                                <BsController className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                <span>Back to Diary</span>
                            </Link>
                        )}
                    </div>
                    <button
                        onClick={() => setDarkMode(!darkMode)}
                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
                        aria-label="Toggle Dark Mode"
                    >
                        {darkMode ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3c.132 0 .263 0 .393.007a9 9 0 0011.6 11.6A9 9 0 1112 3z"/></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 5.106a.75.75 0 011.06 0l1.591 1.591a.75.75 0 11-1.06 1.06l-1.591-1.591a.75.75 0 010-1.06zM21.75 12a.75.75 0 01.75.75h2.25a.75.75 0 010-1.5H22.5a.75.75 0 01.75.75zM18.894 18.894a.75.75 0 010 1.06l-1.591 1.591a.75.75 0 11-1.06-1.06l1.591-1.591a.75.75 0 011.06 0zM12 21.75a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V22.5a.75.75 0 01.75-.75zM5.106 18.894a.75.75 0 011.06 0l1.591 1.591a.75.75 0 11-1.06 1.06L5.106 19.954a.75.75 0 010-1.06zM2.25 12a.75.75 0 01.75-.75h2.25a.75.75 0 010 1.5H3a.75.75 0 01-.75-.75zM5.106 5.106a.75.75 0 010 1.06L3.515 7.757a.75.75 0 01-1.06-1.06l1.591-1.591a.75.75 0 011.06 0z"/></svg>
                        )}
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-primary dark:text-gray-100">
                                {activeTab === 'books' ? Icons.books('w-8 h-8') : <BsController className="w-8 h-8" />}
                            </span>
                            <h1 className="text-3xl font-display font-bold text-primary dark:text-gray-100">
                                {activeTab === 'books' ? 'My Library' : 'Game Logs'}
                            </h1>
                        </div>
                        <p className="text-secondary dark:text-gray-400 text-sm mt-1 flex items-center gap-1.5">
                            {activeTab === 'books'
                                ? "A cozy corner of everything I've been reading"
                                : "Completed titles, hours played, and personal ratings"}
                            <span className="text-amber-400">{Icons.sparkle()}</span>
                        </p>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-fit">
                        <button
                            onClick={() => setActiveTab('books')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                activeTab === 'books'
                                    ? 'bg-white dark:bg-gray-900 text-primary dark:text-gray-100 shadow-sm'
                                    : 'text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                            }`}
                        >
                            <BsBook className="w-3.5 h-3.5" />
                            Bookshelf ({books.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('games')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                activeTab === 'games'
                                    ? 'bg-white dark:bg-gray-900 text-primary dark:text-gray-100 shadow-sm'
                                    : 'text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                            }`}
                        >
                            <BsController className="w-3.5 h-3.5" />
                            Games ({unifiedGames.length})
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 pb-20">
                <div className={activeTab === 'books' ? 'block' : 'hidden'} key="books-tab-pane">
                    {/* Books Stats */}
                        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10" ref={statsRef} data-animate-stagger>
                            <StatCard icon={Icons.books('w-6 h-6')} label="Total Books" value={books.length} />
                            <StatCard icon={Icons.check('w-6 h-6 text-green-500')} label="Completed" value={completedBooks.length} />
                            <StatCard icon={Icons.bookOpen('w-6 h-6 text-blue-500')} label="Reading" value={readingBooks.length} />
                            <StatCard icon={Icons.star('w-6 h-6 text-amber-400')} label="Avg Rating" value={avgRating} />
                        </section>

                        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12" ref={progressRef} data-animate>
                            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center">
                                <h3 className="text-sm font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-4">Reading Progress</h3>
                                <div className="relative flex items-center justify-center">
                                    <ProgressRing pctComplete={pctComplete} completedCount={completedBooks.length} totalCount={books.length} />
                                </div>
                                <div className="flex gap-4 mt-6 text-xs text-secondary dark:text-gray-400">
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span> Completed</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Reading</span>
                                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> Want to Read</span>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
                                <h3 className="text-sm font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-4">Top Authors</h3>
                                <div className="space-y-3">
                                    {topAuthors.slice(0, 6).map(([author, count]) => (
                                        <div key={author}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-primary dark:text-gray-200 font-medium truncate mr-2">{author}</span>
                                                <span className="text-secondary dark:text-gray-400">{count} {count === 1 ? 'book' : 'books'}</span>
                                            </div>
                                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-pink-500 rounded-full transition-all duration-700"
                                                    style={{ width: `${(count / maxAuthorCount) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Favorites */}
                        {favorites.length > 0 && (
                            <section className="mb-12" ref={favRef} data-animate>
                                <h3 className="text-sm font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="text-pink-500">{Icons.heart('w-4 h-4')}</span>
                                    My Favorites
                                </h3>
                                <div className="flex gap-4 overflow-x-auto pb-4 scroll-smooth">
                                    {favorites.map((b, i) => (
                                        <div
                                            key={b.id || i}
                                            onClick={() => setSelectedBook(b)}
                                            className="flex-shrink-0 w-36 cursor-pointer group"
                                        >
                                            <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-2 bg-gray-100 dark:bg-gray-800 shadow-sm group-hover:shadow-md transition-shadow">
                                                {b.cover ? (
                                                    <img src={b.cover} alt={b.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                                ) : b.coverId ? (
                                                    <img src={`https://covers.openlibrary.org/b/id/${b.coverId}-L.jpg`} alt={b.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs text-secondary">{b.title}</div>
                                                )}
                                                <span className="absolute top-2 right-2 text-pink-500 drop-shadow-sm">{Icons.heart('w-4 h-4')}</span>
                                            </div>
                                            <p className="text-xs font-semibold text-primary dark:text-gray-200 truncate">{b.title}</p>
                                            <p className="text-[11px] text-secondary dark:text-gray-400 truncate">{b.author}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Random Picker */}
                        <section className="mb-10 text-center" ref={pickRef} data-animate>
                            <button
                                onClick={pickRandom}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                            >
                                <span className="text-amber-400">{Icons.sparkle()}</span>
                                Pick What I Should Read Next
                            </button>
                        </section>

                        {/* Filters */}
                        <section className="space-y-3 mb-8" ref={filterRef} data-animate>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { key: 'all', label: 'All Books' },
                                    { key: 'reading', label: 'Reading' },
                                    { key: 'completed', label: 'Read' },
                                    { key: 'want-to-read', label: 'To be Read' },
                                    { key: 'dropped', label: 'Dropped' },
                                    { key: 'favorites', label: 'Favorites' },
                                ].map((f) => (
                                    <button
                                        key={f.key}
                                        onClick={() => setFilter(f.key)}
                                        className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                            filter === f.key
                                                ? 'bg-primary text-white border-primary dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100'
                                                : 'bg-white dark:bg-gray-900 text-secondary dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            <GenreFilter books={books} value={genreFilter} onChange={setGenreFilter} />
                        </section>

                        {/* Book Grid / Categorized Shelves */}
                        <div ref={gridRef} data-animate className="space-y-12">
                            {filteredBooks.length === 0 ? (
                                <p className="text-center text-secondary dark:text-gray-400 py-12 text-sm">
                                    No books match this filter
                                </p>
                            ) : filter === 'all' ? (
                                BOOK_CATEGORIES.map((cat) => {
                                    const sectionBooks = filteredBooks.filter(cat.match);
                                    if (sectionBooks.length === 0) return null;
                                    return (
                                        <section key={cat.key} className="space-y-4">
                                            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                                        {cat.icon}
                                                    </span>
                                                    <h3 className="text-base sm:text-lg font-display font-semibold text-primary dark:text-gray-100 tracking-tight">
                                                        {cat.title}
                                                    </h3>
                                                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${cat.badgeColor}`}>
                                                        {sectionBooks.length}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                                {sectionBooks.map((book, i) => (
                                                    <BookCard key={book.id || i} book={book} onClick={setSelectedBook} />
                                                ))}
                                            </div>
                                        </section>
                                    );
                                })
                            ) : (
                                <section className="space-y-4">
                                    {SINGLE_FILTER_META[filter] && (
                                        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                                            <div className="flex items-center gap-2.5">
                                                <span className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                                    {SINGLE_FILTER_META[filter].icon}
                                                </span>
                                                <h3 className="text-base sm:text-lg font-display font-semibold text-primary dark:text-gray-100 tracking-tight">
                                                    {SINGLE_FILTER_META[filter].title}
                                                </h3>
                                                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${SINGLE_FILTER_META[filter].badgeColor}`}>
                                                    {filteredBooks.length}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                        {filteredBooks.map((book, i) => (
                                            <BookCard key={book.id || i} book={book} onClick={setSelectedBook} />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    </div>

                    {/* Games Tab */}
                    <div className={activeTab === 'games' ? 'block' : 'hidden'} key="games-tab-pane">
                        {/* Game Stats */}
                        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10" ref={gameStatsRef} data-animate-stagger>
                            <StatCard icon={<BsController className="w-6 h-6 text-purple-500" />} label="Finished Games" value={finishedGames.length} />
                            <StatCard icon={<BsClock className="w-6 h-6 text-blue-500" />} label="Total Hours" value={`${totalGameHours} hrs`} />
                            <StatCard icon={<BsStarFill className="w-6 h-6 text-amber-400" />} label="Avg Rating" value={`${avgGameRating} / 10`} />
                            <StatCard icon={<BsLaptop className="w-6 h-6 text-emerald-500" />} label="Platforms" value={allPlatforms.length || 1} />
                        </section>

                        {/* Steam Live Profile & Activity */}
                        <SteamShowcaseCard className="mb-10" onFilterSteam={() => setPlatformFilter('Steam')} />

                        {/* Gaming Analytics & Visualizations */}
                        <section className="mb-10 space-y-6">
                            <div className="flex items-center gap-2">
                                <BsBarChart className="w-4 h-4 text-purple-500" />
                                <h3 className="text-sm font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider">
                                    Gaming Analytics
                                </h3>
                            </div>

                            {/* Top Charts Row: Rating Distribution & Finished Games by Year */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Rating Distribution */}
                                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <BsStarFill className="w-3.5 h-3.5 text-amber-400" />
                                            <h4 className="text-xs font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider">
                                                Rating Distribution
                                            </h4>
                                        </div>
                                        <span className="text-[11px] text-secondary dark:text-gray-400">
                                            {ratedGames.length} rated
                                        </span>
                                    </div>

                                    {ratingDistribution.length === 0 || games.length === 0 ? (
                                        <div className="h-56 flex flex-col items-center justify-center text-secondary dark:text-gray-500 text-xs">
                                            <BsStarFill className="w-6 h-6 mb-2 opacity-30 text-amber-400" />
                                            No rating data logged yet
                                        </div>
                                    ) : (
                                        <div className="w-full h-56 min-h-[220px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={ratingDistribution}
                                                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                                    <XAxis
                                                        dataKey="rating"
                                                        stroke={textColor}
                                                        fontSize={11}
                                                        tickLine={false}
                                                        axisLine={{ stroke: axisColor }}
                                                    />
                                                    <YAxis
                                                        stroke={textColor}
                                                        fontSize={11}
                                                        tickLine={false}
                                                        axisLine={{ stroke: axisColor }}
                                                        allowDecimals={false}
                                                    />
                                                    <Tooltip content={<CustomChartTooltip darkMode={darkMode} suffix="games" />} />
                                                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                                        {ratingDistribution.map((entry) => (
                                                            <Cell
                                                                key={`cell-rating-${entry.rawRating}`}
                                                                fill={getRatingColor(entry.rawRating)}
                                                            />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>

                                {/* Finished Games by Year */}
                                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <BsCalendarCheck className="w-3.5 h-3.5 text-purple-500" />
                                            <h4 className="text-xs font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider">
                                                Finished by Year
                                            </h4>
                                        </div>
                                        <span className="text-[11px] text-secondary dark:text-gray-400">
                                            {finishedGames.length} finished
                                        </span>
                                    </div>

                                    {finishedByYear.length === 0 || games.length === 0 ? (
                                        <div className="h-56 flex flex-col items-center justify-center text-secondary dark:text-gray-500 text-xs">
                                            <BsCalendarCheck className="w-6 h-6 mb-2 opacity-30 text-purple-400" />
                                            No finish dates recorded yet
                                        </div>
                                    ) : (
                                        <div className="w-full h-56 min-h-[220px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={finishedByYear}
                                                    margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
                                                >
                                                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                                                    <XAxis
                                                        dataKey="year"
                                                        stroke={textColor}
                                                        fontSize={11}
                                                        tickLine={false}
                                                        axisLine={{ stroke: axisColor }}
                                                    />
                                                    <YAxis
                                                        stroke={textColor}
                                                        fontSize={11}
                                                        tickLine={false}
                                                        axisLine={{ stroke: axisColor }}
                                                        allowDecimals={false}
                                                    />
                                                    <Tooltip content={<CustomChartTooltip darkMode={darkMode} suffix="games finished" />} />
                                                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Top Genres Distribution */}
                            <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <BsLaptop className="w-3.5 h-3.5 text-emerald-500" />
                                        <h4 className="text-xs font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider">
                                            Top Genres Distribution
                                        </h4>
                                    </div>
                                    <span className="text-[11px] text-secondary dark:text-gray-400">
                                        {topGameGenres.length} genres
                                    </span>
                                </div>

                                {topGameGenres.length === 0 || games.length === 0 ? (
                                    <div className="h-48 flex flex-col items-center justify-center text-secondary dark:text-gray-500 text-xs">
                                        <BsController className="w-6 h-6 mb-2 opacity-30 text-emerald-400" />
                                        No genre tags recorded in game logs yet
                                    </div>
                                ) : (
                                    <div className="w-full h-64 min-h-[220px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={topGameGenres}
                                                layout="vertical"
                                                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                                                <XAxis
                                                    type="number"
                                                    stroke={textColor}
                                                    fontSize={11}
                                                    tickLine={false}
                                                    axisLine={{ stroke: axisColor }}
                                                    allowDecimals={false}
                                                />
                                                <YAxis
                                                    type="category"
                                                    dataKey="genre"
                                                    stroke={textColor}
                                                    fontSize={11}
                                                    tickLine={false}
                                                    axisLine={{ stroke: axisColor }}
                                                    width={100}
                                                />
                                                <Tooltip content={<CustomChartTooltip darkMode={darkMode} suffix="games" />} />
                                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                                    {topGameGenres.map((entry, index) => {
                                                        const colors = ['#10b981', '#06b6d4', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#3b82f6'];
                                                        return <Cell key={`cell-genre-${index}`} fill={colors[index % colors.length]} />;
                                                    })}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Platform Filters */}
                        {allPlatforms.length > 0 && (
                            <section className="flex flex-wrap gap-2 mb-8">
                                <button
                                    onClick={() => setPlatformFilter('all')}
                                    className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all cursor-pointer ${
                                        platformFilter === 'all'
                                            ? 'bg-primary text-white border-primary dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100'
                                            : 'bg-white dark:bg-gray-900 text-secondary dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                                    }`}
                                >
                                    All Platforms
                                </button>
                                {allPlatforms.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPlatformFilter(p)}
                                        className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                                            platformFilter === p
                                                ? 'bg-purple-600 text-white border-purple-600'
                                                : 'bg-white dark:bg-gray-900 text-secondary dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                                        }`}
                                    >
                                        {p === 'Steam' && <BsSteam className="w-3 h-3 text-blue-400" />}
                                        {p}
                                    </button>
                                ))}
                            </section>
                        )}

                        {/* Games Grid */}
                        {gamesLoading ? (
                            <div className="py-20 text-center text-secondary dark:text-gray-400 text-sm">
                                Loading game logs...
                            </div>
                        ) : filteredGames.length === 0 ? (
                            <div className="py-20 text-center bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-8 shadow-sm">
                                <BsController className="w-12 h-12 text-secondary dark:text-gray-600 mx-auto mb-3" />
                                <h3 className="text-base font-semibold text-primary dark:text-gray-200 mb-1">
                                    No games logged yet
                                </h3>
                                <p className="text-xs text-secondary dark:text-gray-400 max-w-sm mx-auto">
                                    Games completed and logged through the Diary app will be showcased here with ratings and stats.
                                </p>
                            </div>
                        ) : (
                            <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {filteredGames.map((game) => (
                                    <div
                                        key={game.id}
                                        className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
                                    >
                                        <div className="relative w-full aspect-[16/10] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                            {game.cover ? (
                                                <img
                                                    src={game.cover}
                                                    alt={game.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center p-3 text-center">
                                                    <BsController className="w-8 h-8 text-secondary dark:text-gray-600" />
                                                </div>
                                            )}

                                            {game.rating && (
                                                <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 text-amber-300 backdrop-blur-sm flex items-center gap-1">
                                                    <BsStarFill className="w-2.5 h-2.5" />
                                                    {game.rating}/10
                                                </span>
                                            )}

                                            {(game.platform || game.isSteam) && (
                                                <div className="absolute bottom-2 left-2 flex items-center gap-1 flex-wrap">
                                                    {game.platform && game.platform !== 'Steam' && (
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 dark:bg-gray-900/90 text-primary dark:text-gray-100 backdrop-blur-sm shadow-xs">
                                                            {game.platform}
                                                        </span>
                                                    )}
                                                    {game.isSteam && (
                                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#171a21]/90 text-blue-200 border border-blue-500/30 backdrop-blur-sm shadow-xs inline-flex items-center gap-1">
                                                            <BsSteam className="w-2.5 h-2.5 text-blue-400" />
                                                            Steam
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-3">
                                            <h4 className="font-semibold text-xs text-primary dark:text-gray-100 truncate">
                                                {game.title}
                                            </h4>
                                            <div className="flex items-center justify-between text-[11px] text-secondary dark:text-gray-400 mt-1">
                                                <span className="flex items-center gap-1">
                                                    <BsClock className="w-3 h-3" />
                                                    {game.hoursPlayed || 0} hrs
                                                </span>
                                                {!game.finishedOn && game.storeUrl && (
                                                    <a
                                                        href={game.storeUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center gap-0.5 text-[10px] font-medium"
                                                        title="Steam Store Page"
                                                    >
                                                        <span>Store</span>
                                                        <BsBoxArrowUpRight className="w-2 h-2" />
                                                    </a>
                                                )}
                                                {game.finishedOn && (
                                                    <span className="flex items-center gap-1">
                                                        <BsCalendarCheck className="w-3 h-3" />
                                                        {game.finishedOn.slice(0, 4)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </section>
                        )}
                    </div>

                <footer className="text-center mt-16 pt-8 border-t border-gray-100 dark:border-gray-800" ref={footerRef} data-animate>
                    <p className="text-xs text-secondary dark:text-gray-500 flex items-center justify-center gap-1">
                        Live stats synchronized from Firebase &middot; Made with {Icons.coffee()} &amp; {Icons.bookOpen('w-3.5 h-3.5 inline')}
                    </p>
                </footer>
            </main>

            <BookModal book={selectedBook} onClose={() => setSelectedBook(null)} />

            <style>{`[class*="overflow-x-auto"]::-webkit-scrollbar { display: none; }`}</style>
        </div>
    );
};

LibraryPage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
    initialTab: PropTypes.string,
};

export default LibraryPage;
