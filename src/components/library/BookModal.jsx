import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Icons } from './Icons';
import { Stars } from './BookCard';
import { statusConfig } from '../../data/books';
import { useCircularReveal } from '../motion/useCircularReveal';

const BookModal = ({ book, origin = null, onClose }) => {
    const { surfaceRef, closeWithReveal } = useCircularReveal(origin, onClose);
    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeWithReveal();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [closeWithReveal]);

    if (!book) return null;

    const config = statusConfig[book.status] || {
        label: book.status === 'want-to-read' ? 'To Read' : (book.status || 'Book'),
        color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        barColor: 'bg-blue-500'
    };
    const coverSrc = book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg` : '');
    const genres = Array.isArray(book.genres) ? book.genres : [];

    const startedDate = book.startedOn
        ? new Date(book.startedOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null;
    const finishedDate = book.finishedOn
        ? new Date(book.finishedOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : (book.status === 'completed' ? 'Completed' : 'In progress');

    const totalPages = book.pages || null;
    const readPages = book.currentPage || (book.status === 'completed' ? totalPages : 0);

    return (
        <div
            className="fixed inset-0 z-[55] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
            onClick={closeWithReveal}
            role="presentation"
        >
            <div
                ref={surfaceRef}
                role="dialog"
                aria-modal="true"
                aria-label={book.title}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-white dark:bg-gray-900 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 z-[60] my-auto flex flex-col md:flex-row p-5 sm:p-6 gap-6"
            >
                {/* Close Button Top Right */}
                <button
                    type="button"
                    onClick={closeWithReveal}
                    aria-label="Close dialog"
                    className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-secondary dark:text-gray-300 hover:text-primary dark:hover:text-gray-100 flex items-center justify-center transition-colors cursor-pointer"
                >
                    {Icons.close('w-4 h-4')}
                </button>

                {/* Left Side: Full Vertical Book Cover (Matching User's Sketch) */}
                <div className="w-full md:w-[220px] flex-shrink-0 flex justify-center">
                    <div className="relative aspect-[2/3] w-[180px] sm:w-[200px] md:w-full rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-gray-800 bg-gray-100 dark:bg-gray-800">
                        {coverSrc && !imageError ? (
                            <img
                                src={coverSrc}
                                alt={book.title}
                                className="w-full h-full object-cover rounded-2xl"
                                onError={() => setImageError(true)}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                                <span className="text-sm text-secondary dark:text-gray-400 text-center font-medium">
                                    {book.title}
                                </span>
                            </div>
                        )}
                        <span className={`absolute top-2.5 right-2.5 text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${config.color} shadow-sm backdrop-blur-md`}>
                            {config.label}
                        </span>
                        {book.favorite && (
                            <span className="absolute top-2.5 left-2.5 text-pink-500 drop-shadow-sm">
                                {Icons.heart('w-4 h-4')}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right Side: Details & Lower Box (Matching User's Sketch) */}
                <div className="flex-1 flex flex-col justify-between min-w-0 pr-0 md:pr-4">
                    <div>
                        {/* Title & Author */}
                        <div className="pr-8">
                            <h3 className="text-xl sm:text-2xl font-display font-bold text-primary dark:text-gray-100 leading-snug">
                                {book.title}
                            </h3>
                            <p className="text-sm text-secondary dark:text-gray-400 font-medium mt-1">
                                by {book.author || (book.authors ? book.authors.join(', ') : 'Unknown Author')}
                            </p>
                        </div>

                        {/* Rating, Status & Progress */}
                        <div className="mt-3 flex items-center gap-3 flex-wrap">
                            <Stars rating={book.rating} />
                            <span className="text-xs text-secondary dark:text-gray-400">
                                {book.progress || 0}% complete
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-2.5 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${config.barColor} transition-all duration-700`}
                                style={{ width: `${book.progress || 0}%` }}
                            />
                        </div>

                        {/* Genres / Tags */}
                        {genres.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                                {genres.map((g) => (
                                    <span
                                        key={g}
                                        className="text-[11px] px-2.5 py-0.5 rounded-full bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400 font-medium"
                                    >
                                        {g}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Divider Line (as drawn in sketch) */}
                    <hr className="my-4 border-gray-100 dark:border-gray-800" />

                    {/* Lower Box: Description and Stats (as requested by user) */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3.5 sm:p-4 border border-gray-100 dark:border-gray-800/80 space-y-2.5">
                        {/* Stats Row */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            <div className="bg-white dark:bg-gray-900/80 rounded-xl p-2 border border-gray-100 dark:border-gray-800 text-center">
                                <span className="block text-[10px] text-secondary dark:text-gray-400 uppercase tracking-wider font-semibold">Pages</span>
                                <span className="font-bold text-primary dark:text-gray-100 mt-0.5 block">
                                    {readPages ? `${readPages} / ${totalPages || '—'}` : (totalPages ? `${totalPages} pgs` : '—')}
                                </span>
                            </div>

                            <div className="bg-white dark:bg-gray-900/80 rounded-xl p-2 border border-gray-100 dark:border-gray-800 text-center">
                                <span className="block text-[10px] text-secondary dark:text-gray-400 uppercase tracking-wider font-semibold">Started</span>
                                <span className="font-bold text-primary dark:text-gray-100 mt-0.5 block truncate">
                                    {startedDate || '—'}
                                </span>
                            </div>

                            <div className="bg-white dark:bg-gray-900/80 rounded-xl p-2 border border-gray-100 dark:border-gray-800 text-center col-span-2 sm:col-span-1">
                                <span className="block text-[10px] text-secondary dark:text-gray-400 uppercase tracking-wider font-semibold">Finished</span>
                                <span className="font-bold text-primary dark:text-gray-100 mt-0.5 block truncate">
                                    {finishedDate}
                                </span>
                            </div>
                        </div>

                        {/* Description / Summary */}
                        {book.description || book.summary ? (
                            <p className="text-xs text-secondary dark:text-gray-300 leading-relaxed max-h-24 overflow-y-auto pr-1">
                                {book.description || book.summary}
                            </p>
                        ) : book.notes || book.review ? (
                            <p className="text-xs text-secondary dark:text-gray-300 leading-relaxed italic max-h-24 overflow-y-auto pr-1">
                                "{book.notes || book.review}"
                            </p>
                        ) : (
                            <p className="text-[11px] text-secondary dark:text-gray-400 italic">
                                Tracked in Ralph's reading diary · {genres.slice(0, 2).join(', ') || 'Literary selection'}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

BookModal.propTypes = {
    book: PropTypes.object,
    origin: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number,
        width: PropTypes.number,
        height: PropTypes.number,
    }),
    onClose: PropTypes.func.isRequired,
};

export default BookModal;
