import React from 'react';
import { Icons } from './Icons';
import { Stars } from './BookCard';
import { statusConfig } from '../../data/books';

const BookModal = ({ book, onClose }) => {
    if (!book) return null;
    const config = statusConfig[book.status];
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
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
                <div className="p-6">
                    <div className="flex items-start justify-between">
                        <div>
                            <h3 className="text-xl font-display font-bold text-primary dark:text-gray-100">{book.title}</h3>
                            <p className="text-sm text-secondary dark:text-gray-400 mt-0.5">by {book.author}</p>
                        </div>
                        {book.favorite && <span className="text-pink-500">{Icons.heart('w-6 h-6')}</span>}
                    </div>
                    <div className="mt-3"><Stars rating={book.rating} /></div>
                    <div className="mt-4 flex items-center gap-3">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${config.color}`}>{config.label}</span>
                        <span className="text-xs text-secondary dark:text-gray-400">{book.progress}% complete</span>
                    </div>
                    <div className="mt-3 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${config.barColor} transition-all duration-700`} style={{ width: `${book.progress}%` }} />
                    </div>
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

export default BookModal;
