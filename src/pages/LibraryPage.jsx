import React, { useState, useEffect, useRef } from 'react';
import Lenis from 'lenis';
import books, { statusConfig, allGenres } from '../data/books';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

/* ─── SVG Icons ─── */
const Icons = {
    books: (cls = 'w-6 h-6') => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
    ),
    check: (cls = 'w-6 h-6') => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    bookOpen: (cls = 'w-6 h-6') => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
    ),
    star: (cls = 'w-6 h-6') => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
    ),
    starFilled: (cls = 'w-4 h-4') => (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
    ),
    starEmpty: (cls = 'w-4 h-4') => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
    ),
    heart: (cls = 'w-5 h-5') => (
        <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
    ),
    dice: (cls = 'w-5 h-5') => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
    ),
    sparkle: (cls = 'w-4 h-4') => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
    ),
    chevronLeft: (cls = 'w-4 h-4') => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
    ),
    close: (cls = 'w-4 h-4') => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    ),
    coffee: (cls = 'w-3.5 h-3.5 inline') => (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        </svg>
    ),
};

/* ─── helpers ─── */
const completedBooks = books.filter(b => b.status === 'completed');
const readingBooks = books.filter(b => b.status === 'reading');
const wantToRead = books.filter(b => b.status === 'want-to-read');
const favorites = books.filter(b => b.favorite);
const avgRating = (books.filter(b => b.rating).reduce((s, b) => s + b.rating, 0) / books.filter(b => b.rating).length).toFixed(1);
const pctComplete = Math.round((completedBooks.length / books.length) * 100);

// Author counts
const authorCounts = {};
books.forEach(b => { authorCounts[b.author] = (authorCounts[b.author] || 0) + 1; });
const topAuthors = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]);
const maxAuthorCount = topAuthors[0]?.[1] || 1;

/* ─── Animated counter hook ─── */
const useCounter = (target, duration = 1200) => {
    const [val, setVal] = useState(0);
    const ref = useRef(null);
    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) {
                let start = 0;
                const step = target / (duration / 16);
                const tick = () => {
                    start += step;
                    if (start >= target) { setVal(target); return; }
                    setVal(Math.floor(start));
                    requestAnimationFrame(tick);
                };
                tick();
                obs.disconnect();
            }
        }, { threshold: 0.3 });
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [target, duration]);
    return [val, ref];
};

/* ─── Stars (SVG) ─── */
const Stars = ({ rating }) => {
    if (!rating) return <span className="text-xs text-gray-400">—</span>;
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className={i <= Math.ceil(rating) ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}>
                    {i <= Math.floor(rating) ? Icons.starFilled('w-3.5 h-3.5') : i - 0.5 <= rating ? Icons.starFilled('w-3.5 h-3.5') : Icons.starEmpty('w-3.5 h-3.5')}
                </span>
            ))}
        </div>
    );
};

/* ─── Stat Card ─── */
const StatCard = ({ icon, label, value, suffix = '' }) => {
    const [count, ref] = useCounter(typeof value === 'number' ? value : 0);
    const display = typeof value === 'number' ? count + suffix : value;
    return (
        <div ref={ref} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 text-center">
            <div className="flex justify-center mb-1 text-secondary dark:text-gray-400">{icon}</div>
            <p className="text-2xl font-display font-bold text-primary dark:text-gray-100">{display}</p>
            <p className="text-xs text-secondary dark:text-gray-400 mt-1">{label}</p>
        </div>
    );
};

/* ─── Progress Ring ─── */
const ProgressRing = () => {
    const [animated, setAnimated] = useState(false);
    const ref = useRef(null);
    const r = 70, circ = 2 * Math.PI * r;
    const offset = circ - (pctComplete / 100) * circ;

    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) { setAnimated(true); obs.disconnect(); }
        }, { threshold: 0.3 });
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);

    return (
        <div ref={ref} className="flex flex-col items-center justify-center">
            <svg width="180" height="180" className="transform -rotate-90">
                <circle cx="90" cy="90" r={r} stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="12" fill="none" />
                <circle cx="90" cy="90" r={r} stroke="url(#ringGrad)" strokeWidth="12" fill="none" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={animated ? offset : circ}
                    style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
                />
                <defs>
                    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6ee7b7" />
                        <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute text-center">
                <p className="text-3xl font-display font-bold text-primary dark:text-gray-100">{pctComplete}%</p>
                <p className="text-xs text-secondary dark:text-gray-400 mt-0.5">{completedBooks.length} / {books.length} read</p>
            </div>
        </div>
    );
};

/* ─── Book Card ─── */
const BookCard = ({ book, onClick }) => {
    const config = statusConfig[book.status];
    return (
        <div
            onClick={() => onClick(book)}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
        >
            {/* Cover */}
            <div className="relative w-full aspect-[2/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                {book.coverId ? (
                    <img
                        src={`https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg`}
                        alt={book.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center p-4">
                        <span className="text-sm text-secondary dark:text-gray-500 text-center font-medium">{book.title}</span>
                    </div>
                )}
                {/* Badges */}
                <span className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.color}`}>
                    {config.label}
                </span>
                {book.favorite && (
                    <span className="absolute top-2 left-2 text-pink-500 drop-shadow-sm">{Icons.heart('w-4 h-4')}</span>
                )}
            </div>
            {/* Info */}
            <div className="p-3">
                <p className="text-sm font-semibold text-primary dark:text-gray-100 truncate">{book.title}</p>
                <p className="text-xs text-secondary dark:text-gray-400 truncate mt-0.5">{book.author}</p>
                {/* Stars */}
                <div className="mt-1.5"><Stars rating={book.rating} /></div>
                {/* Progress */}
                <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${config.barColor}`} style={{ width: `${book.progress}%` }} />
                </div>
                {/* Genre tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                    {book.genres.map(g => (
                        <span key={g} className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400">{g}</span>
                    ))}
                </div>
            </div>
        </div>
    );
};

/* ─── Book Modal ─── */
const BookModal = ({ book, onClose }) => {
    if (!book) return null;
    const config = statusConfig[book.status];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Cover */}
                <div className="relative w-full aspect-[3/2] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    {book.coverId ? (
                        <img
                            src={`https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg`}
                            alt={book.title}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <span className="text-lg text-secondary">{book.title}</span>
                        </div>
                    )}
                    <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer">
                        {Icons.close()}
                    </button>
                </div>
                {/* Details */}
                <div className="p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-xl font-display font-bold text-primary dark:text-gray-100">{book.title}</h3>
                            <p className="text-sm text-secondary dark:text-gray-400 mt-0.5">by {book.author}</p>
                        </div>
                        {book.favorite && <span className="text-pink-500">{Icons.heart('w-6 h-6')}</span>}
                    </div>
                    <div className="mt-3"><Stars rating={book.rating} /></div>
                    {/* Status + Progress */}
                    <div className="mt-4 flex items-center gap-3">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${config.color}`}>{config.label}</span>
                        <span className="text-xs text-secondary dark:text-gray-400">{book.progress}% complete</span>
                    </div>
                    <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${config.barColor} transition-all duration-700`} style={{ width: `${book.progress}%` }} />
                    </div>
                    {/* Genres */}
                    <div className="flex flex-wrap gap-1.5 mt-4">
                        {book.genres.map(g => (
                            <span key={g} className="text-xs px-2.5 py-1 rounded-full bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400 font-medium">{g}</span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── Main Page ─── */
const LibraryPage = () => {
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

    // Lenis smooth scroll
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
        return () => lenis.destroy();
    }, []);

    const filtered = books.filter(b => {
        const statusMatch = filter === 'all' || filter === b.status || (filter === 'favorites' && b.favorite);
        const genreMatch = genreFilter === 'all' || b.genres.includes(genreFilter);
        return statusMatch && genreMatch;
    });

    // Random "What should I read next?"
    const pickRandom = () => {
        const pool = books.filter(b => b.status === 'want-to-read' || b.status === 'reading');
        if (pool.length) setSelectedBook(pool[Math.floor(Math.random() * pool.length)]);
    };

    return (
        <div className="min-h-screen bg-background dark:bg-gray-950 transition-colors">
            {/* Header */}
            <header className="max-w-4xl mx-auto px-6 pt-10 pb-4" ref={headerRef} data-animate>
                <a href="/" className="inline-flex items-center gap-1.5 text-sm text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 transition-colors mb-6">
                    {Icons.chevronLeft()}
                    Back to Home
                </a>
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

                {/* ── Stats Grid ── */}
                <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10" ref={statsRef} data-animate-stagger>
                    <StatCard icon={Icons.books('w-6 h-6')} label="Total Books" value={books.length} />
                    <StatCard icon={Icons.check('w-6 h-6 text-green-500')} label="Completed" value={completedBooks.length} />
                    <StatCard icon={Icons.bookOpen('w-6 h-6 text-blue-500')} label="Reading" value={readingBooks.length} />
                    <StatCard icon={Icons.star('w-6 h-6 text-amber-400')} label="Avg Rating" value={avgRating} />
                </section>

                {/* ── Progress + Authors Row ── */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12" ref={progressRef} data-animate>
                    {/* Progress Ring */}
                    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col items-center">
                        <h3 className="text-sm font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-4">Reading Progress</h3>
                        <div className="relative flex items-center justify-center">
                            <ProgressRing />
                        </div>
                        <div className="flex gap-4 mt-6 text-xs text-secondary dark:text-gray-400">
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span> Completed</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> Reading</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> Want to Read</span>
                        </div>
                    </div>

                    {/* Author Breakdown */}
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

                {/* ── Favorites ── */}
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
                    <style>{`[class*="overflow-x-auto"]::-webkit-scrollbar{display:none;}`}</style>
                </section>

                {/* ── Random Pick Button ── */}
                <div className="text-center mb-10" ref={pickRef} data-animate>
                    <button
                        onClick={pickRandom}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                    >
                        {Icons.dice('w-4 h-4')} What should I read next?
                    </button>
                </div>

                {/* ── Filters ── */}
                <section className="mb-6" ref={filterRef} data-animate>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="text-xs text-secondary dark:text-gray-400 mr-1">Status:</span>
                        {[
                            { key: 'all', label: 'All' },
                            { key: 'reading', label: 'Reading' },
                            { key: 'completed', label: 'Done' },
                            { key: 'want-to-read', label: 'To Read' },
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

                {/* ── Book Grid ── */}
                <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4" ref={gridRef} data-animate>
                    {filtered.map((book, i) => (
                        <BookCard key={i} book={book} onClick={setSelectedBook} />
                    ))}
                    {filtered.length === 0 && (
                        <p className="col-span-full text-center text-secondary dark:text-gray-400 py-12 text-sm">No books match this filter</p>
                    )}
                </section>

                {/* ── Currently Reading ── */}
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
                                            <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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

                {/* ── Footer ── */}
                <footer className="text-center mt-16 pt-8 border-t border-gray-100 dark:border-gray-800" ref={footerRef} data-animate>
                    <p className="text-xs text-secondary dark:text-gray-500 flex items-center justify-center gap-1">
                        Book covers from <a href="https://openlibrary.org" target="_blank" rel="noreferrer" className="underline hover:text-primary dark:hover:text-gray-300">Open Library</a>
                        · Made with {Icons.coffee()} &amp; {Icons.bookOpen('w-3.5 h-3.5 inline')}
                    </p>
                </footer>
            </main>

            {/* ── Modal ── */}
            <BookModal book={selectedBook} onClose={() => setSelectedBook(null)} />
        </div>
    );
};

export default LibraryPage;
