import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BsBook, BsController } from 'react-icons/bs';

/**
 * Segmented control switching between Books and Games library views.
 * Synchronizes deterministically with location.pathname.
 */
export default function LibrarySegmentedSwitch() {
    const location = useLocation();
    const isGames = location.pathname.includes('/library/games') || location.pathname.includes('/app/games');
    const isBooks = !isGames;

    return (
        <div
            className="flex items-center p-1 bg-gray-100 dark:bg-gray-800/80 rounded-2xl w-full sm:max-w-xs mb-6 border border-border/60 dark:border-gray-800"
            role="tablist"
            aria-label="Library media type switch"
        >
            <Link
                to="/app/library/books"
                role="tab"
                aria-selected={isBooks}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isBooks
                        ? 'bg-white dark:bg-gray-900 text-primary dark:text-gray-100 shadow-sm'
                        : 'text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                }`}
            >
                <BsBook className="w-3.5 h-3.5" />
                <span>Books</span>
            </Link>

            <Link
                to="/app/library/games"
                role="tab"
                aria-selected={isGames}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isGames
                        ? 'bg-white dark:bg-gray-900 text-primary dark:text-gray-100 shadow-sm'
                        : 'text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                }`}
            >
                <BsController className="w-3.5 h-3.5" />
                <span>Games</span>
            </Link>
        </div>
    );
}
