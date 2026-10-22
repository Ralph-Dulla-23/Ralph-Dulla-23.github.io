import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Icons } from './Icons';
import { Stars } from './BookCard';
import { statusConfig } from '../../data/books';
import bookDescriptions from '../../data/bookDescriptions.js';

const OPEN_DURATION = 280;
const CLOSE_DURATION = 220;
const EASE_OUT = 'cubic-bezier(.22, 1, .36, 1)';
const EASE_IN = 'cubic-bezier(.4, 0, .2, 1)';

function reduceMotion() {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

const BookModal = ({ book, origin = null, onClose }) => {
    const backdropRef = useRef(null);
    const dialogRef = useRef(null);
    const closingRef = useRef(false);
    const [imageError, setImageError] = useState(false);

    // Guaranteed close handler: safe against any animation cancellation or error
    const handleClose = useCallback(() => {
        if (closingRef.current) return;
        closingRef.current = true;

        const backdrop = backdropRef.current;
        const dialog = dialogRef.current;

        let finished = false;
        const finalize = () => {
            if (finished) return;
            finished = true;
            onClose();
        };

        if (reduceMotion() || !dialog || typeof dialog.animate !== 'function') {
            finalize();
            return;
        }

        // Safety fallback: guaranteed to close even if animations reject or stall
        const fallbackTimer = setTimeout(finalize, CLOSE_DURATION + 40);

        try {
            // Animate backdrop fade out
            if (backdrop && typeof backdrop.animate === 'function') {
                backdrop.animate(
                    [{ opacity: 1 }, { opacity: 0 }],
                    { duration: CLOSE_DURATION, easing: EASE_IN, fill: 'forwards' }
                );
            }

            // Calculate transform origin relative to dialog
            const rect = dialog.getBoundingClientRect();
            const originX = Number.isFinite(origin?.x) ? `${origin.x - rect.left}px` : '50%';
            const originY = Number.isFinite(origin?.y) ? `${origin.y - rect.top}px` : '50%';
            dialog.style.transformOrigin = `${originX} ${originY}`;

            const shrink = dialog.animate([
                {
                    transform: 'scale(1)',
                    opacity: 1,
                },
                {
                    transform: 'scale(0.85)',
                    opacity: 0,
                },
            ], {
                duration: CLOSE_DURATION,
                easing: EASE_IN,
                fill: 'forwards',
            });

            shrink.finished.then(() => {
                clearTimeout(fallbackTimer);
                finalize();
            }).catch(() => {
                clearTimeout(fallbackTimer);
                finalize();
            });
        } catch {
            clearTimeout(fallbackTimer);
            finalize();
        }
    }, [origin, onClose]);

    // Entrance Animation from Clicked Card Origin
    useLayoutEffect(() => {
        const backdrop = backdropRef.current;
        const dialog = dialogRef.current;
        if (!dialog || reduceMotion() || typeof dialog.animate !== 'function') return undefined;

        try {
            // Animate backdrop fade in
            if (backdrop && typeof backdrop.animate === 'function') {
                backdrop.animate(
                    [{ opacity: 0 }, { opacity: 1 }],
                    { duration: OPEN_DURATION, easing: EASE_OUT, fill: 'forwards' }
                );
            }

            // Set transform origin at clicked card position
            const rect = dialog.getBoundingClientRect();
            const originX = Number.isFinite(origin?.x) ? `${origin.x - rect.left}px` : '50%';
            const originY = Number.isFinite(origin?.y) ? `${origin.y - rect.top}px` : '50%';
            dialog.style.transformOrigin = `${originX} ${originY}`;

            const grow = dialog.animate([
                {
                    transform: 'scale(0.85)',
                    opacity: 0,
                },
                {
                    transform: 'scale(1)',
                    opacity: 1,
                },
            ], {
                duration: OPEN_DURATION,
                easing: EASE_OUT,
            });

            grow.finished.then(() => {
                if (!closingRef.current && dialog) {
                    dialog.style.transform = '';
                    dialog.style.opacity = '';
                    dialog.style.transformOrigin = '';
                }
            }).catch(() => {});
        } catch {
            // Graceful fallback
        }

        return () => {};
    }, [origin]);

    // Escape Key Listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleClose]);

    if (!book) return null;

    const config = statusConfig[book.status] || {
        label: book.status === 'want-to-read' ? 'To Read' : (book.status || 'Book'),
        color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        barColor: 'bg-blue-500'
    };
    const coverSrc = book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg` : '');
    const genres = Array.isArray(book.genres) ? book.genres : [];
    const visibleGenres = genres.slice(0, 6);
    const extraGenres = genres.length - visibleGenres.length;

    const startedDate = book.startedOn
        ? new Date(book.startedOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : null;
    const finishedDate = book.finishedOn
        ? new Date(book.finishedOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        : (book.status === 'completed' ? 'Completed' : 'In progress');

    const totalPages = book.pages || null;
    const readPages = book.currentPage || (book.status === 'completed' ? totalPages : 0);

    const synopsis = book.description || bookDescriptions[book.id] || bookDescriptions[String(book.coverId)] || book.summary || '';

    const handleBackdropClick = (e) => {
        if (e.target === backdropRef.current) {
            handleClose();
        }
    };

    return (
        <div
            ref={backdropRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
            onClick={handleBackdropClick}
            role="presentation"
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={book.title}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-white dark:bg-gray-900 rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800 z-50 my-auto flex flex-col md:flex-row max-h-[90vh] md:max-h-[85vh]"
            >
                {/* Left Side: Edge-to-Edge Book Cover (Matches User Wireframe) */}
                <div className="w-full md:w-[260px] lg:w-[280px] shrink-0 relative bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center min-h-[240px] md:min-h-full">
                    {coverSrc && !imageError ? (
                        <img
                            src={coverSrc}
                            alt={book.title}
                            className="w-full h-full object-cover absolute inset-0"
                            onError={() => setImageError(true)}
                        />
                    ) : (
                        <div className="w-full h-full min-h-[240px] flex items-center justify-center p-6 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                            <span className="text-base text-secondary dark:text-gray-400 text-center font-semibold">
                                {book.title}
                            </span>
                        </div>
                    )}
                    {/* Status Pill on Cover */}
                    <span className={`absolute top-3.5 right-3.5 text-[11px] font-semibold px-3 py-1 rounded-full ${config.color} shadow-md backdrop-blur-md`}>
                        {config.label}
                    </span>
                    {/* Favorite Heart on Cover */}
                    {book.favorite && (
                        <span className="absolute top-3.5 left-3.5 text-pink-500 drop-shadow-md">
                            {Icons.heart('w-5 h-5')}
                        </span>
                    )}
                </div>

                {/* Right Side: Header, Tags, Divider, Description Box (Matches User Wireframe) */}
                <div className="flex-1 flex flex-col justify-between p-6 sm:p-7 min-w-0 relative overflow-y-auto">
                    {/* Close Button Top Right */}
                    <button
                        type="button"
                        onClick={handleClose}
                        aria-label="Close dialog"
                        className="absolute top-5 right-5 z-20 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-secondary dark:text-gray-300 hover:text-primary dark:hover:text-gray-100 flex items-center justify-center transition-colors cursor-pointer"
                    >
                        {Icons.close('w-4 h-4')}
                    </button>

                    <div>
                        {/* Title & Author */}
                        <div className="pr-10">
                            <h3 className="text-xl sm:text-2xl font-display font-bold text-primary dark:text-gray-100 leading-snug">
                                {book.title}
                            </h3>
                            <p className="text-sm text-secondary dark:text-gray-400 font-medium mt-1">
                                by {book.author || (book.authors ? book.authors.join(', ') : 'Unknown Author')}
                            </p>
                        </div>

                        {/* Rating & Progress */}
                        <div className="mt-3 flex items-center gap-3 flex-wrap">
                            <Stars rating={book.rating} />
                            <span className="text-xs text-secondary dark:text-gray-400 font-medium">
                                {book.progress || 0}% complete
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${config.barColor} transition-all duration-700`}
                                style={{ width: `${book.progress || 0}%` }}
                            />
                        </div>

                        {/* Tags / Badges (Directly under title/rating as in sketch) */}
                        {visibleGenres.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3.5">
                                {visibleGenres.map((g) => (
                                    <span
                                        key={g}
                                        className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-300 border border-pink-100 dark:border-pink-900/30"
                                    >
                                        {g}
                                    </span>
                                ))}
                                {extraGenres > 0 && (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-secondary dark:bg-gray-800 dark:text-gray-400">
                                        +{extraGenres}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Divider Line (as drawn in sketch) */}
                    <hr className="my-5 border-gray-100 dark:border-gray-800" />

                    {/* Lower Description Box (Matches User Wireframe) */}
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 sm:p-5 border border-gray-100 dark:border-gray-800/80 flex flex-col gap-3">
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-secondary dark:text-gray-400 pb-1 border-b border-gray-200/60 dark:border-gray-700/60">
                            <span>Synopsis</span>
                            <span className="font-normal lowercase tracking-normal text-secondary dark:text-gray-400">
                                {readPages ? `${readPages} / ${totalPages || '—'} pages` : (totalPages ? `${totalPages} pgs` : '')}
                            </span>
                        </div>

                        {/* Description Body */}
                        <div className="text-xs sm:text-sm text-secondary dark:text-gray-300 leading-relaxed max-h-48 overflow-y-auto pr-1 space-y-2.5 whitespace-pre-line">
                            {synopsis ? (
                                <p className="leading-relaxed">{synopsis}</p>
                            ) : book.notes || book.review ? (
                                <p className="italic">"{book.notes || book.review}"</p>
                            ) : (
                                <p className="italic text-secondary dark:text-gray-400">
                                    Tracked in Ralph's reading diary · {genres.join(', ') || 'Literary selection'}
                                </p>
                            )}
                        </div>

                        {/* Mini Stats Footer inside Description Box */}
                        {(startedDate || finishedDate) && (
                            <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between text-[11px] text-secondary dark:text-gray-400">
                                {startedDate && <span>Started: <strong className="text-primary dark:text-gray-200 font-semibold">{startedDate}</strong></span>}
                                {finishedDate && <span>Finished: <strong className="text-primary dark:text-gray-200 font-semibold">{finishedDate}</strong></span>}
                            </div>
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
