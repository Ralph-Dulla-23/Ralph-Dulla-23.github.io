import React from 'react';
import { Icons } from './Icons';
import { statusConfig } from '../../data/books';

export const Stars = ({ rating }) => {
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

const BookCard = ({ book, onClick }) => {
    const config = statusConfig[book.status];
    return (
        <div
            onClick={() => onClick(book)}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer group"
        >
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
                <span className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.color}`}>
                    {config.label}
                </span>
                {book.favorite && (
                    <span className="absolute top-2 left-2 text-pink-500 drop-shadow-sm">{Icons.heart('w-4 h-4')}</span>
                )}
            </div>
            <div className="p-3">
                <p className="text-sm font-semibold text-primary dark:text-gray-100 truncate">{book.title}</p>
                <p className="text-xs text-secondary dark:text-gray-400 truncate mt-0.5">{book.author}</p>
                <div className="mt-1.5"><Stars rating={book.rating} /></div>
                <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${config.barColor}`} style={{ width: `${book.progress}%` }} />
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                    {book.genres.map(g => (
                        <span key={g} className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400">{g}</span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default BookCard;
