import React, { useEffect, useRef, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { statusConfig } from '../data/books';
import { observePublicShelf } from '../services/publicShelfService';
import { OWNER_UID } from '../lib/config';
import { Link } from 'react-router-dom';
import { lenisRef } from '../lib/scrollController';
import { BsBook, BsController, BsSteam, BsClock, BsBoxArrowUpRight } from 'react-icons/bs';
import { loadSteamStats, getUnifiedGames } from '../lib/steam';
import BookModal from './library/BookModal';

const LibraryBookCard = ({ book, onClick }) => {
    const [imageError, setImageError] = useState(false);
    const config = statusConfig[book.status] || {
        label: book.status === 'want-to-read' ? 'To Read' : (book.status || 'Book'),
        color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        barColor: 'bg-blue-500'
    };
    const coverSrc = book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg` : '');

    // Reset error state if coverSrc changes
    const [prevCoverSrc, setPrevCoverSrc] = useState(coverSrc);
    if (prevCoverSrc !== coverSrc) {
        setPrevCoverSrc(coverSrc);
        setImageError(false);
    }

    const handleClick = (e) => {
        if (!onClick) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const origin = {
            x: Math.round(rect.left + rect.width / 2),
            y: Math.round(rect.top + rect.height / 2),
            width: rect.width,
            height: rect.height,
        };
        onClick(book, origin);
    };

    return (
        <div onClick={handleClick} className="flex-shrink-0 w-[180px] snap-start cursor-pointer group/card transition-transform duration-200 hover:-translate-y-1">
            <div className="relative w-[180px] h-[260px] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow mb-3 bg-gray-100 dark:bg-gray-800">
                {coverSrc && !imageError ? (
                    <img
                        src={coverSrc}
                        alt={book.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs text-secondary dark:text-gray-500 text-center px-2 font-medium">
                            {book.title}
                        </span>
                    </div>
                )}
                <span className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.color}`}>
                    {config.label}
                </span>
            </div>

            <p className="text-sm font-semibold text-primary dark:text-gray-100 truncate" title={book.title}>
                {book.title}
            </p>
            <p className="text-xs text-secondary dark:text-gray-400 truncate mt-0.5">
                {book.author}
            </p>

            <div className="mt-2 h-[3px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${config.barColor}`}
                    style={{ width: `${book.progress}%` }}
                />
            </div>
            <p className="text-[10px] text-secondary dark:text-gray-500 mt-1">
                {book.status === 'completed' ? 'Completed' : book.status === 'want-to-read' ? 'Want to Read' : `${book.progress}%`}
            </p>
        </div>
    );
};

LibraryBookCard.propTypes = {
    book: PropTypes.object.isRequired,
    onClick: PropTypes.func,
};

const LibraryGameCard = ({ game }) => {
    const [imageError, setImageError] = useState(false);
    const coverSrc = game.cover || (game.steamAppId ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.steamAppId}/header.jpg` : '');

    const [prevCoverSrc, setPrevCoverSrc] = useState(coverSrc);
    if (prevCoverSrc !== coverSrc) {
        setPrevCoverSrc(coverSrc);
        setImageError(false);
    }

    const isRecent = Boolean(game.isRecent);

    return (
        <div className="flex-shrink-0 w-[180px] snap-start cursor-pointer group/card transition-transform duration-200 hover:-translate-y-1">
            <div className="relative w-[180px] h-[260px] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow mb-3 bg-gray-100 dark:bg-gray-800 flex flex-col justify-end">
                {coverSrc && !imageError ? (
                    <img
                        src={coverSrc}
                        alt={game.title}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                        onError={() => setImageError(true)}
                    />
                ) : (
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                        <span className="text-xs text-secondary dark:text-gray-400 text-center px-3 font-medium">
                            {game.title}
                        </span>
                    </div>
                )}

                {/* Subtle bottom shadow overlay for contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                {/* Platform Badge */}
                <span className="absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/75 text-white backdrop-blur-md border border-white/20 inline-flex items-center gap-1 shadow-sm">
                    <BsSteam className="w-2.5 h-2.5 text-blue-400" /> Steam
                </span>

                {/* Active / Recently played pill */}
                {isRecent && (
                    <span className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/90 text-white backdrop-blur-md inline-flex items-center gap-1 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Active
                    </span>
                )}
            </div>

            <p className="text-sm font-semibold text-primary dark:text-gray-100 truncate" title={game.title}>
                {game.title}
            </p>
            <p className="text-xs text-secondary dark:text-gray-400 truncate mt-0.5">
                {game.hoursPlayed ? `${game.hoursPlayed} hrs on record` : 'Steam Library'}
            </p>

            <div className="mt-2 h-[3px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all bg-emerald-500"
                    style={{ width: `${Math.min(100, Math.round(((game.hoursPlayed || 0) / 80) * 100))}%` }}
                />
            </div>

            <div className="flex items-center justify-between text-[10px] text-secondary dark:text-gray-500 mt-1">
                <span className="flex items-center gap-1">
                    <BsClock className="w-2.5 h-2.5" /> {game.hoursPlayed || 0} hrs
                </span>
                {game.storeUrl && (
                    <a
                        href={game.storeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                        Store <BsBoxArrowUpRight className="w-2 h-2" />
                    </a>
                )}
            </div>
        </div>
    );
};

LibraryGameCard.propTypes = {
    game: PropTypes.object.isRequired,
};

const Library = () => {
    const animRef = useScrollAnimation();
    const carouselRef = useRef(null);
    const [activeTab, setActiveTab] = useState('books');
    const [books, setBooks] = useState([]);
    const [rawGames, setRawGames] = useState([]);
    const [steamData, setSteamData] = useState(null);
    const [selectedBook, setSelectedBook] = useState(null);
    const [modalOrigin, setModalOrigin] = useState(null);

    const handleOpenBook = (book, origin = null) => {
        setModalOrigin(origin);
        setSelectedBook(book);
    };

    const handleCloseBook = () => {
        setSelectedBook(null);
        setModalOrigin(null);
    };

    useEffect(() => {
        let mounted = true;
        loadSteamStats().then((data) => {
            if (mounted && data) setSteamData(data);
        }).catch(() => {});
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const unsubscribe = observePublicShelf(OWNER_UID, (items) => {
            const publicBooks = items.filter((item) => item.mediaType === 'book' || !item.mediaType);
            const publicGames = items.filter((item) => item.mediaType === 'game');
            setBooks(publicBooks);
            setRawGames(publicGames);
        });
        return () => unsubscribe();
    }, []);

    const unifiedGames = useMemo(() => {
        return getUnifiedGames(rawGames, steamData);
    }, [rawGames, steamData]);

    const readingCount = books.filter((b) => b.status === 'reading').length;

    const scroll = (direction) => {
        if (carouselRef.current) {
            const scrollAmount = direction === 'left' ? -400 : 400;
            carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    const handleViewAllClick = () => {
        if (lenisRef.current) {
            lenisRef.current.scrollTo(0, { immediate: true });
        } else {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    };

    return (
        <section id="library" className="scroll-mt-20 py-16 border-b border-border dark:border-gray-800" ref={animRef} data-animate>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                    <h2 className="text-lg font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider">
                        Library
                    </h2>

                    {/* Segmented Switch: Books | Games */}
                    <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700/60 text-xs font-medium">
                        <button
                            type="button"
                            onClick={() => setActiveTab('books')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                activeTab === 'books'
                                    ? 'bg-white dark:bg-gray-900 text-primary dark:text-gray-100 shadow-sm font-semibold'
                                    : 'text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                            }`}
                        >
                            <BsBook className="w-3.5 h-3.5" />
                            Books ({books.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('games')}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                                activeTab === 'games'
                                    ? 'bg-white dark:bg-gray-900 text-primary dark:text-gray-100 shadow-sm font-semibold'
                                    : 'text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                            }`}
                        >
                            <BsController className="w-3.5 h-3.5" />
                            Games ({unifiedGames.length})
                        </button>
                    </div>
                </div>

                <Link
                    to={activeTab === 'games' ? '/library?tab=games' : '/library'}
                    onClick={handleViewAllClick}
                    className="text-sm font-medium text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 transition-colors cursor-pointer inline-flex items-center gap-1"
                >
                    View All →
                </Link>
            </div>

            {/* Dynamic Subtitle */}
            <div className="text-sm text-secondary dark:text-gray-400 mb-10 flex items-center gap-2 flex-wrap">
                {activeTab === 'books' ? (
                    <span>{books.length} books · Currently reading {readingCount}</span>
                ) : steamData?.onlineState === 'in-game' ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        Currently playing <strong className="font-semibold text-emerald-700 dark:text-emerald-300">{steamData.currentGame || (steamData.stateMessage || '').replace(/^Playing\s+/i, '')}</strong> · {unifiedGames.length} games on record
                    </span>
                ) : (
                    <span>{unifiedGames.length} games · Sorted by recent activity</span>
                )}
            </div>

            <div className="relative group">
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-[120px] -translate-x-1/2 z-10 w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-border dark:border-gray-700 shadow-md flex items-center justify-center text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                    aria-label="Scroll left"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>

                <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-[120px] translate-x-1/2 z-10 w-9 h-9 rounded-full bg-white dark:bg-gray-800 border border-border dark:border-gray-700 shadow-md flex items-center justify-center text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500 transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                    aria-label="Scroll right"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                <div
                    ref={carouselRef}
                    className="flex gap-5 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                >
                    {activeTab === 'books'
                        ? books.map((book, index) => (
                            <LibraryBookCard key={book.id || index} book={book} onClick={handleOpenBook} />
                        ))
                        : unifiedGames.map((game, index) => (
                            <LibraryGameCard key={game.id || game.steamAppId || index} game={game} />
                        ))}
                </div>
            </div>

            <style>{`
                [class*="overflow-x-auto"]::-webkit-scrollbar { display: none; }
            `}</style>

            <BookModal book={selectedBook} origin={modalOrigin} onClose={handleCloseBook} />
        </section>
    );
};

export default Library;
