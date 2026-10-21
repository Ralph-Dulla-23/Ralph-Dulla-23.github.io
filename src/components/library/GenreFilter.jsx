import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { BsChevronDown, BsChevronUp, BsSearch, BsX } from 'react-icons/bs';

import { getAvailableGenres } from '../../domain/selectors/availableGenres.js';

export default function GenreFilter({ books, value, onChange }) {
    const [expanded, setExpanded] = useState(false);
    const [search, setSearch] = useState('');
    const searchRef = useRef(null);
    const genres = useMemo(() => getAvailableGenres(books), [books]);
    const matching = useMemo(() => genres.filter(({ name }) => name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [genres, search]);
    const popular = genres.slice(0, 5);
    const selected = genres.find((genre) => genre.name === value);
    const quickTags = selected && !popular.some(({ name }) => name === selected.name) ? [...popular, selected] : popular;

    useEffect(() => {
        if (expanded) searchRef.current?.focus();
    }, [expanded]);

    const chip = (name, count) => (
        <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            aria-pressed={value === name}
            className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                value === name
                    ? 'bg-pink-500 text-white border-pink-500'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-pink-400'
            }`}
        >
            {name}{count != null && <span className="ml-1 opacity-70">{count}</span>}
        </button>
    );

    return (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/40 p-3 sm:p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Genres</span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">{genres.length} available</span>
                </div>
                <div className="flex items-center gap-2">
                    {value !== 'all' && (
                        <button type="button" onClick={() => onChange('all')} className="text-xs text-pink-600 dark:text-pink-300 hover:underline">Clear filter</button>
                    )}
                    {genres.length > popular.length && (
                        <button type="button" onClick={() => setExpanded((prev) => !prev)} aria-expanded={expanded} aria-controls="genre-filter-panel" className="inline-flex min-h-9 items-center gap-1 rounded-full border border-gray-200 dark:border-gray-700 px-3 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800">
                            {expanded ? 'Fewer genres' : 'All genres'} {expanded ? <BsChevronUp aria-hidden="true" /> : <BsChevronDown aria-hidden="true" />}
                        </button>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                {chip('all', null)}
                {quickTags.map(({ name, count }) => chip(name, count))}
            </div>
            {expanded && (
                <div id="genre-filter-panel" className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                    <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3">
                        <BsSearch className="shrink-0 text-gray-400" aria-hidden="true" />
                        <input ref={searchRef} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search genres" aria-label="Search genres" className="w-full min-w-0 bg-transparent py-2.5 text-sm text-gray-900 dark:text-gray-100 outline-none" />
                        {search && <button type="button" onClick={() => setSearch('')} aria-label="Clear genre search"><BsX /></button>}
                    </div>
                    <div className="flex max-h-48 flex-wrap content-start gap-2 overflow-y-auto overscroll-contain pr-1" aria-label="Available book genres">
                        {matching.map(({ name, count }) => chip(name, count))}
                        {matching.length === 0 && <p className="py-2 text-xs text-gray-500">No matching genres.</p>}
                    </div>
                </div>
            )}
        </div>
    );
}

GenreFilter.propTypes = {
    books: PropTypes.array.isRequired,
    value: PropTypes.string.isRequired,
    onChange: PropTypes.func.isRequired,
};
