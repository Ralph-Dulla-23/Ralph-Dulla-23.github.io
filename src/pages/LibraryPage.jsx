import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Lenis from 'lenis';
import books, { statusConfig, allGenres } from '../data/books';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

import { Icons } from '../components/library/Icons';
import BookCard from '../components/library/BookCard';
import { StatCard, ProgressRing } from '../components/library/Stats';
import BookModal from '../components/library/BookModal';

const completedBooks = books.filter(b => b.status === 'completed');
const readingBooks = books.filter(b => b.status === 'reading');
const favorites = books.filter(b => b.favorite);
const avgRating = (books.filter(b => b.rating).reduce((s, b) => s + b.rating, 0) / (books.filter(b => b.rating).length || 1)).toFixed(1);
const pctComplete = Math.round((completedBooks.length / (books.length || 1)) * 100);

const authorCounts = {};
books.forEach(b => { authorCounts[b.author] = (authorCounts[b.author] || 0) + 1; });
const topAuthors = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]);
const maxAuthorCount = topAuthors[0]?.[1] || 1;

/**
 * LibraryPage component that displays the user's reading collection and stats.
 * 
 * @component
 * @param {Object} props
 * @param {boolean} props.darkMode - Current theme state
 * @param {Function} props.setDarkMode - Function to toggle theme state
 */
const LibraryPage = ({ darkMode, setDarkMode }) => {
    const [filter, setFilter] = useState('all');
    const [genreFilter, setGenreFilter] = useState('all');
    const [selectedBook, setSelectedBook] = useState(null);

    const headerRef = useScrollAnimation();
    const statsRef = useScrollAnimation();
    const progressRef = useScrollAnimation();
    const favRef = useScrollAnimation();
    const pickRef = useScrollAnimation();
    const filterRef = useScrollAnimation();
    const gridRef = useScrollAnimation();
    const readingRef = useScrollAnimation();
    const footerRef = useScrollAnimation();

    useEffect(() => {
        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
        });

        function raf(time) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);
        lenis.scrollTo(0, { immediate: true });
        return () => lenis.destroy();
    }, []);

    const filtered = books.filter(b => {
        const statusMatch = filter === 'all' || filter === b.status || (filter === 'favorites' && b.favorite);
        const genreMatch = genreFilter === 'all' || b.genres.includes(genreFilter);
        return statusMatch && genreMatch;
    });

    const pickRandom = () => {
        const pool = books.filter(b => b.status === 'want-to-read' || b.status === 'reading');
        if (pool.length) setSelectedBook(pool[Math.floor(Math.random() * pool.length)]);
    };

    return (
        <div className={`min-h-screen transition-colors ${darkMode ? 'dark bg-gray-950' : 'bg-background'}`}>
            <header className="max-w-4xl mx-auto px-6 pt-10 pb-4" ref={headerRef} data-animate>
                <div className="flex justify-between items-start mb-6">
                    <a href="/" className="inline-flex items-center gap-1.5 text-sm text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 transition-colors">
                        {Icons.chevronLeft()}
                        Back to Home
                    </a>
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
                <div className="flex items-center gap-3 mb-1">
                    <span className="text-primary dark:text-gray-100">{Icons.books('w-8 h-8')}</span>
                    <h1 className="text-3xl font-display font-bold text-primary dark:text-gray-100">My Library</h1>
                </div>
                <p className="text-secondary dark:text-gray-400 text-sm mt-1 flex items-center gap-1.5">
                    A cozy corner of everything I've been reading
                    <span className="text-amber-400">{Icons.sparkle()}</span>
                </p>
            </header>

            <main className="max-w-4xl mx-auto px-6 pb-20">
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
                                            className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-500 transition-all duration-700"
                                            style={{ width: `${(count / maxAuthorCount) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="mb-12" ref={favRef} data-animate>
                    <h3 className="text-sm font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <span className="text-pink-500">{Icons.heart('w-4 h-4')}</span>
                        My Favorites
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                        {favorites.map((book, i) => (
                            <div
                                key={i}
                                onClick={() => setSelectedBook(book)}
                                className="flex-shrink-0 w-[120px] cursor-pointer hover:-translate-y-1 transition-transform duration-200"
                            >
                                <div className="w-[120px] h-[170px] rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow bg-gray-100 dark:bg-gray-800 ring-2 ring-pink-300 dark:ring-pink-700">
                                    {book.coverId && (
                                        <img src={`https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                                    )}
                                </div>
                                <p className="text-xs font-medium text-primary dark:text-gray-200 truncate mt-2">{book.title}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <div className="text-center mb-10" ref={pickRef} data-animate>
                    <button
                        onClick={pickRandom}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                    >
                        {Icons.dice('w-4 h-4')} What should I read next?
                    </button>
                </div>

                <section className="mb-6" ref={filterRef} data-animate>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs text-secondary dark:text-gray-400 mr-1">Status:</span>
                        {[
                            { key: 'all', label: 'All' },
                            { key: 'reading', label: 'Reading' },
                            { key: 'completed', label: 'Done' },
                            { key: 'want-to-read', label: 'To Read' },
                            { key: 'dropped', label: 'Dropped' },
                            { key: 'favorites', label: 'Faves' },
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all cursor-pointer
                                    ${filter === f.key
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
                            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all cursor-pointer
                                ${genreFilter === 'all'
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
                                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all cursor-pointer
                                    ${genreFilter === g
                                        ? 'bg-pink-500 text-white border-pink-500'
                                        : 'bg-white dark:bg-gray-900 text-secondary dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                                    }`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </section>

                <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" ref={gridRef} data-animate>
                    {filtered.map((book, i) => (
                        <BookCard key={i} book={book} onClick={setSelectedBook} />
                    ))}
                    {filtered.length === 0 && (
                        <p className="col-span-full text-center text-secondary dark:text-gray-400 py-12 text-sm">No books match this filter</p>
                    )}
                </section>

                {readingBooks.length > 0 && (
                    <section className="mt-14" ref={readingRef} data-animate>
                        <h3 className="text-sm font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="text-blue-500">{Icons.bookOpen('w-4 h-4')}</span>
                            Currently Reading
                        </h3>
                        <div className="space-y-3">
                            {readingBooks.map((book, i) => {
                                const config = statusConfig[book.status];
                                return (
                                    <div key={i} onClick={() => setSelectedBook(book)} className="flex items-center gap-4 bg-white dark:bg-gray-900 rounded-2xl p-4 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all cursor-pointer">
                                        <div className="w-14 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                                            {book.coverId && <img src={`https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg`} alt={book.title} className="w-full h-full object-cover" loading="lazy" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-primary dark:text-gray-100 truncate">{book.title}</p>
                                            <p className="text-xs text-secondary dark:text-gray-400">{book.author}</p>
                                            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" >
                                                <div className={`h-full rounded-full ${config.barColor}`} style={{ width: `${book.progress}%` }} />
                                            </div>
                                        </div>
                                        <span className="text-sm font-display font-bold text-blue-500">{book.progress}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                <footer className="text-center mt-16 pt-8 border-t border-gray-100 dark:border-gray-800" ref={footerRef} data-animate>
                    <p className="text-xs text-secondary dark:text-gray-500 flex items-center justify-center gap-1">
                        Book covers from <a href="https://openlibrary.org" target="_blank" rel="noreferrer" className="underline hover:text-primary dark:hover:text-gray-300">Open Library</a>
                        · Made with {Icons.coffee()} &amp; {Icons.bookOpen('w-3.5 h-3.5 inline')}
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
};

export default LibraryPage;
