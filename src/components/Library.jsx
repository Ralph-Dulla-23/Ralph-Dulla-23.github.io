import React, { useEffect, useRef } from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import books, { statusConfig } from '../data/books';
import Lenis from 'lenis';
import { Link } from 'react-router-dom';
import {lenisRef} from '../App';

const Library = () => {
    const animRef = useScrollAnimation();
    const carouselRef = useRef(null);
    const readingCount = books.filter(b => b.status === 'reading').length;

    const scroll = (direction) => {
        if (carouselRef.current) {
            const scrollAmount = direction === 'left' ? -400 : 400;
            carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    return (
        <section id="library" className="py-16 border-b border-border dark:border-gray-800" ref={animRef} data-animate>
            <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-lg font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider">
                    Library
                </h2>
                <Link
                    to="/library"
                    onClick={() => {
                        if (lenisRef.current) {
                            lenisRef.current.scrollTo(0, { immediate: true });
                        } else {
                            window.scrollTo({ top: 0, behavior: 'instant' });
                        }
                    }}
                    className="text-sm font-medium text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 transition-colors cursor-pointer"
                >
                    View All →
                </Link>
            </div>
            <p className="text-sm text-secondary dark:text-gray-400 mb-10">
                {books.length} books · Currently reading {readingCount}
            </p>

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
                    {books.map((book, index) => {
                        const config = statusConfig[book.status];
                        return (
                            <div
                                key={index}
                                className="flex-shrink-0 w-[180px] snap-start cursor-pointer group/card transition-transform duration-200 hover:-translate-y-1"
                            >
                                <div className="relative w-[180px] h-[260px] rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow mb-3 bg-gray-100 dark:bg-gray-800">
                                    {book.coverId ? (
                                        <img
                                            src={`https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg`}
                                            alt={book.title}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.parentElement.classList.add('flex', 'items-center', 'justify-center');
                                                const fallback = document.createElement('span');
                                                fallback.className = 'text-xs text-secondary dark:text-gray-500 text-center px-2 font-medium';
                                                fallback.textContent = book.title;
                                                e.target.parentElement.appendChild(fallback);
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className="text-xs text-secondary dark:text-gray-500 text-center px-2 font-medium">{book.title}</span>
                                        </div>
                                    )}
                                    <span className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.color}`}>
                                        {config.label}
                                    </span>
                                </div>

                                <p className="text-sm font-semibold text-primary dark:text-gray-100 truncate">
                                    {book.title}
                                </p>
                                <p className="text-xs text-secondary dark:text-gray-400 truncate mt-0.5">
                                    {book.author}
                                </p>

                                <div className="mt-2 h-[3px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${config.barColor}`}
                                        style={{ width: `${book.progress}%` }}
                                    ></div>
                                </div>
                                <p className="text-[10px] text-secondary dark:text-gray-500 mt-1">
                                    {book.status === 'completed' ? 'Completed' : book.status === 'want-to-read' ? 'Want to Read' : `${book.progress}%`}
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            <style>{`
                [class*="overflow-x-auto"]::-webkit-scrollbar { display: none; }
            `}</style>
        </section>
    );
};

export default Library;
