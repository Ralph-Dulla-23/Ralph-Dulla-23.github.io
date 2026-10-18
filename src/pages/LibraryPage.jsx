import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import Lenis from 'lenis';
import fallbackBooks, { statusConfig, allGenres } from '../data/books';
import { watchPublicBooks, watchPublicGames } from '../lib/db';
import { OWNER_UID } from '../lib/config';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

import { Icons } from '../components/library/Icons';
import BookCard from '../components/library/BookCard';
import { StatCard, ProgressRing } from '../components/library/Stats';
import BookModal from '../components/library/BookModal';
import {
    BsController,
    BsBook,
    BsStarFill,
    BsClock,
    BsCalendarCheck,
    BsLaptop,
    BsArrowRight,
} from 'react-icons/bs';

/**
 * LibraryPage component that displays the user's reading collection, finished games, and stats.
 */
const LibraryPage = ({ darkMode, setDarkMode, initialTab = 'books' }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [books, setBooks] = useState(fallbackBooks);
    const [games, setGames] = useState([]);
    const [gamesLoading, setGamesLoading] = useState(true);

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
    const readingRef = useScrollAnimation();
    const footerRef = useScrollAnimation();

    // Subscribe to public books
    useEffect(() => {
        const unsubscribe = watchPublicBooks(OWNER_UID, (liveBooks) => {
            if (liveBooks && liveBooks.length > 0) {
                setBooks(liveBooks);
            }
        });
        return () => unsubscribe();
    }, []);

    // Subscribe to public games
    useEffect(() => {
        const unsubscribe = watchPublicGames(OWNER_UID, (liveGames) => {
            setGames(liveGames || []);
            setGamesLoading(false);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
        });

        let rafId;
        function raf(time) {
            lenis.raf(time);
            rafId = requestAnimationFrame(raf);
        }

        rafId = requestAnimationFrame(raf);
        lenis.scrollTo(0, { immediate: true });
        return () => {
            cancelAnimationFrame(rafId);
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
        const pool = books.filter(b => b.status === 'want-to-read' || b.status === 'reading');
        if (pool.length) setSelectedBook(pool[Math.floor(Math.random() * pool.length)]);
    };

    // Games metrics
    const finishedGames = games.filter(g => g.status === 'finished' || g.finishedOn);
    const totalGameHours = games.reduce((sum, g) => sum + (Number(g.hoursPlayed) || 0), 0);
    const ratedGames = games.filter(g => Number(g.rating) > 0);
    const avgGameRating = ratedGames.length > 0
        ? (ratedGames.reduce((sum, g) => sum + Number(g.rating), 0) / ratedGames.length).toFixed(1)
        : '0.0';

    const platformsSet = new Set(games.map(g => g.platform).filter(Boolean));
    const allPlatforms = Array.from(platformsSet);

    const filteredGames = games.filter(g => {
        if (platformFilter === 'all') return true;
        return g.platform === platformFilter;
    });

    return (
        <div className={`min-h-screen transition-colors ${darkMode ? 'dark bg-gray-950 text-gray-100' : 'bg-background text-primary'}`}>
            <header className="max-w-4xl mx-auto px-6 pt-10 pb-4" ref={headerRef} data-animate>
                <div className="flex justify-between items-start mb-6">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 text-sm text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 transition-colors"
                    >
                        {Icons.chevronLeft()}
                        Back to Home
                    </Link>
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
                            Games ({games.length})
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 pb-20">
                {activeTab === 'books' ? (
                    <>
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
                                    { key: 'completed', label: 'Completed' },
                                    { key: 'want-to-read', label: 'Want to Read' },
                                    { key: 'favorites', label: 'Favorites' },
                                ].map((f) => (
                                    <button
                                        key={f.key}
                                        onClick={() => setFilter(f.key)}
                                        className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all cursor-pointer ${
                                            filter === f.key
                                                ? 'bg-primary text-white border-primary dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100'
                                                : 'bg-white dark:bg-gray-900 text-secondary dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs text-secondary dark:text-gray-400 mr-1">Genre:</span>
                                <button
                                    onClick={() => setGenreFilter('all')}
                                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all cursor-pointer ${
                                        genreFilter === 'all'
                                            ? 'bg-pink-500 text-white border-pink-500'
                                            : 'bg-white dark:bg-gray-900 text-secondary dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                                    }`}
                                >
                                    All
                                </button>
                                {allGenres.map(g => (
                                    <button
                                        key={g}
                                        onClick={() => setGenreFilter(g)}
                                        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all cursor-pointer ${
                                            genreFilter === g
                                                ? 'bg-pink-500 text-white border-pink-500'
                                                : 'bg-white dark:bg-gray-900 text-secondary dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                                        }`}
                                    >
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Book Grid */}
                        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" ref={gridRef} data-animate>
                            {filteredBooks.map((book, i) => (
                                <BookCard key={book.id || i} book={book} onClick={setSelectedBook} />
                            ))}
                            {filteredBooks.length === 0 && (
                                <p className="col-span-full text-center text-secondary dark:text-gray-400 py-12 text-sm">
                                    No books match this filter
                                </p>
                            )}
                        </section>

                        {/* Currently Reading List */}
                        {readingBooks.length > 0 && (
                            <section className="mt-14" ref={readingRef} data-animate>
                                <h3 className="text-sm font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <span className="text-blue-500">{Icons.bookOpen('w-4 h-4')}</span>
                                    Currently Reading
                                </h3>
                                <div className="space-y-3">
                                    {readingBooks.map((book, i) => {
                                        const config = statusConfig[book.status] || { barColor: 'bg-blue-500' };
                                        const coverSrc = book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg` : '');
                                        return (
                                            <div
                                                key={book.id || i}
                                                onClick={() => setSelectedBook(book)}
                                                className="flex items-center gap-4 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all cursor-pointer"
                                            >
                                                <div className="w-14 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                                                    {coverSrc ? (
                                                        <img src={coverSrc} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs">{book.title}</div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-primary dark:text-gray-100 truncate">{book.title}</p>
                                                    <p className="text-xs text-secondary dark:text-gray-400">{book.author}</p>
                                                    <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${config.barColor}`} style={{ width: `${book.progress || 0}%` }} />
                                                    </div>
                                                </div>
                                                <span className="text-sm font-display font-bold text-blue-500">{book.progress || 0}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}
                    </>
                ) : (
                    /* Games Tab */
                    <>
                        {/* Game Stats */}
                        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10" ref={statsRef} data-animate-stagger>
                            <StatCard icon={<BsController className="w-6 h-6 text-purple-500" />} label="Finished Games" value={finishedGames.length} />
                            <StatCard icon={<BsClock className="w-6 h-6 text-blue-500" />} label="Total Hours" value={`${totalGameHours} hrs`} />
                            <StatCard icon={<BsStarFill className="w-6 h-6 text-amber-400" />} label="Avg Rating" value={`${avgGameRating} / 10`} />
                            <StatCard icon={<BsLaptop className="w-6 h-6 text-emerald-500" />} label="Platforms" value={allPlatforms.length || 1} />
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
                                        className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-all cursor-pointer ${
                                            platformFilter === p
                                                ? 'bg-purple-600 text-white border-purple-600'
                                                : 'bg-white dark:bg-gray-900 text-secondary dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                                        }`}
                                    >
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

                                            {game.platform && (
                                                <span className="absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/90 dark:bg-gray-900/90 text-primary dark:text-gray-100 backdrop-blur-sm">
                                                    {game.platform}
                                                </span>
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
                    </>
                )}

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
