import React, { useState, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { Link, useSearchParams } from 'react-router-dom';
import { DiaryShell } from '../../components/diary/DiaryShell';
import { useAuth } from '../../context/AuthContext';
import {
    watchPublicBooks,
    watchPublicGames,
    watchJournalEntries,
    saveJournalEntry,
    deleteJournalEntry,
    publishHighlight,
    unpublishHighlight,
    isHighlightPublished,
} from '../../lib/db';
import ShareableHighlightModal from '../../components/highlights/ShareableHighlightModal';
import {
    BsJournalText,
    BsPlusLg,
    BsSearch,
    BsTrash3,
    BsQuote,
    BsLightbulb,
    BsController,
    BsBook,
    BsStarFill,
    BsCalendar3,
    BsX,
    BsLink45Deg,
    BsShare,
    BsCloudCheck,
    BsCloudArrowUp,
} from 'react-icons/bs';

const ENTRY_TYPES = [
    { id: 'reflection', label: 'Reflection', icon: BsLightbulb, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-400' },
    { id: 'book_quote', label: 'Quote', icon: BsQuote, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400' },
    { id: 'game_moment', label: 'Game Moment', icon: BsController, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-400' },
    { id: 'session_note', label: 'Session Note', icon: BsCalendar3, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400' },
    { id: 'review', label: 'Review', icon: BsStarFill, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400' },
];

export default function JournalPage({ darkMode, setDarkMode }) {
    const { user } = useAuth();
    const [entries, setEntries] = useState([]);
    const [books, setBooks] = useState([]);
    const [games, setGames] = useState([]);

    // Filtering & search
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    // Write / Edit Modal State
    const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
    const [entryTitle, setEntryTitle] = useState('');
    const [entryBody, setEntryBody] = useState('');
    const [entryType, setEntryType] = useState('reflection');
    const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
    const [linkedMediaId, setLinkedMediaId] = useState('');
    const [saving, setSaving] = useState(false);

    // Shareable Highlights Modal State
    const [selectedHighlight, setSelectedHighlight] = useState(null);
    const [publishedHighlightIds, setPublishedHighlightIds] = useState(new Set());
    const [syncMetadata, setSyncMetadata] = useState({ hasPendingWrites: false, fromCache: false });
    const [searchParams, setSearchParams] = useSearchParams();

    // Subscribe to books and games for linked media
    useEffect(() => {
        if (!user) return;
        const unsubBooks = watchPublicBooks(user.uid, setBooks);
        const unsubGames = watchPublicGames(user.uid, setGames);
        const unsubJournal = watchJournalEntries(user.uid, (data, meta) => {
            setEntries(data);
            if (meta) {
                setSyncMetadata(meta);
            }
        });

        return () => {
            unsubBooks();
            unsubGames();
            unsubJournal();
        };
    }, [user]);

    // Map for fast media lookup
    const mediaMap = useMemo(() => {
        const map = new Map();
        books.forEach((b) => {
            if (b && b.id) map.set(String(b.id), { ...b, mediaType: 'book' });
        });
        games.forEach((g) => {
            if (g && g.id) map.set(String(g.id), { ...g, mediaType: 'game' });
        });
        return map;
    }, [books, games]);

    // Filtered entries
    const filteredEntries = useMemo(() => {
        return entries.filter((entry) => {
            // Type filter
            if (typeFilter !== 'all' && entry.type !== typeFilter) {
                return false;
            }

            // Search query filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const titleMatch = (entry.title || '').toLowerCase().includes(q);
                const bodyMatch = (entry.body || '').toLowerCase().includes(q);

                let mediaMatch = false;
                if (entry.linkedMediaId && mediaMap.has(String(entry.linkedMediaId))) {
                    const item = mediaMap.get(String(entry.linkedMediaId));
                    mediaMatch = (item.title || '').toLowerCase().includes(q);
                }

                return titleMatch || bodyMatch || mediaMatch;
            }

            return true;
        });
    }, [entries, typeFilter, searchQuery, mediaMap]);

    const openWriteModal = () => {
        setEntryTitle('');
        setEntryBody('');
        setEntryType('reflection');
        setEntryDate(new Date().toISOString().split('T')[0]);
        setLinkedMediaId('');
        setIsWriteModalOpen(true);
    };

    // Query-based quick action consumption (UX-01)
    const consumedActionRef = useRef(null);
    useEffect(() => {
        const action = searchParams.get('action');
        if (!action || consumedActionRef.current === action) return;
        consumedActionRef.current = action;

        const timer = setTimeout(() => {
            if (action === 'new') {
                openWriteModal();
            }
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('action');
                return next;
            }, { replace: true });
        }, 0);

        return () => clearTimeout(timer);
    }, [searchParams, setSearchParams]);

    const handleSaveEntry = async (e) => {
        e.preventDefault();
        if (!user || !entryBody.trim()) return;

        setSaving(true);
        try {
            let linkedMediaType = null;
            if (linkedMediaId && mediaMap.has(String(linkedMediaId))) {
                linkedMediaType = mediaMap.get(String(linkedMediaId)).mediaType;
            }

            await saveJournalEntry(user.uid, {
                title: entryTitle.trim(),
                body: entryBody.trim(),
                type: entryType,
                date: entryDate,
                linkedMediaId: linkedMediaId || null,
                linkedMediaType,
            });

            setIsWriteModalOpen(false);
            setEntryTitle('');
            setEntryBody('');
        } catch (err) {
            console.error('Failed to save journal entry:', err);
            alert('Failed to save journal entry. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (entryId) => {
        if (!user || !entryId) return;
        if (!window.confirm('Are you sure you want to delete this journal entry? This action cannot be undone.')) {
            return;
        }

        try {
            await deleteJournalEntry(user.uid, entryId);
        } catch (err) {
            console.error('Failed to delete journal entry:', err);
            alert('Failed to delete journal entry. Please try again.');
        }
    };

    const handleOpenShareHighlight = (entry, linkedItem) => {
        setSelectedHighlight({
            ...entry,
            mediaTitle: linkedItem?.title || entry.title,
            mediaCover: linkedItem?.cover,
            mediaType: linkedItem?.mediaType || (entry.type === 'game_moment' ? 'game' : 'book'),
        });
    };

    const handlePublishHighlight = async (highlight) => {
        if (!user || !highlight?.id) return;
        const isCurrentlyPublished = isHighlightPublished(user.uid, highlight.id);
        try {
            if (isCurrentlyPublished) {
                await unpublishHighlight(user.uid, highlight.id);
                setPublishedHighlightIds((prev) => {
                    const next = new Set(prev);
                    next.delete(String(highlight.id));
                    return next;
                });
            } else {
                await publishHighlight(user.uid, highlight);
                setPublishedHighlightIds((prev) => {
                    const next = new Set(prev);
                    next.add(String(highlight.id));
                    return next;
                });
            }
        } catch (err) {
            alert('Failed to update highlight publication: ' + err.message);
        }
    };

    return (
        <DiaryShell title="Journal" darkMode={darkMode} setDarkMode={setDarkMode}>
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold font-display text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            <BsJournalText className="w-6 h-6 text-amber-500" />
                            Journal & Reflections
                        </h1>
                        {syncMetadata?.hasPendingWrites ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full" title="Changes queued offline; will sync when reconnected">
                                <BsCloudArrowUp className="w-3 h-3 animate-pulse" /> Syncing offline...
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full" title="Real-time cloud sync active">
                                <BsCloudCheck className="w-3 h-3" /> Live Sync
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Private thoughts, book quotes, gameplay impressions, and milestone reviews.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={openWriteModal}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-sm transition-all hover:shadow active:scale-[0.98] self-start sm:self-auto"
                >
                    <BsPlusLg className="w-4 h-4" />
                    Write Entry
                </button>
            </div>

            {/* Filter Bar & Search */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-4 sm:p-5 border border-gray-200 dark:border-gray-800 shadow-sm mb-6 space-y-4">
                {/* Search field */}
                <div className="relative">
                    <BsSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search reflections, quotes, books, or games..."
                        className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                            <BsX className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Entry Type Filter Pills */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                        type="button"
                        onClick={() => setTypeFilter('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            typeFilter === 'all'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        All
                    </button>
                    {ENTRY_TYPES.map((t) => {
                        const Icon = t.icon;
                        const isSelected = typeFilter === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTypeFilter(t.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                                    isSelected
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5" />
                                {t.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Entries Timeline */}
            <div className="space-y-4">
                {filteredEntries.length === 0 ? (
                    <div className="p-12 rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-4">
                            <BsJournalText className="w-8 h-8" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                            {searchQuery || typeFilter !== 'all' ? 'No matching journal entries' : 'Your Journal is Empty'}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-6">
                            {searchQuery || typeFilter !== 'all'
                                ? 'Try adjusting your search terms or filter selection.'
                                : 'Record private reflections, save favorite quotes, or log gameplay thoughts.'}
                        </p>
                        <button
                            type="button"
                            onClick={openWriteModal}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm shadow-sm transition-all"
                        >
                            <BsPlusLg className="w-4 h-4" />
                            Write First Entry
                        </button>
                    </div>
                ) : (
                    filteredEntries.map((entry) => {
                        const typeInfo = ENTRY_TYPES.find((t) => t.id === entry.type) || ENTRY_TYPES[0];
                        const TypeIcon = typeInfo.icon;
                        const linkedItem = entry.linkedMediaId ? mediaMap.get(String(entry.linkedMediaId)) : null;

                        return (
                            <article
                                key={entry.id}
                                className="bg-white dark:bg-gray-900 rounded-3xl p-5 sm:p-6 border border-gray-200/80 dark:border-gray-800 shadow-sm transition-all hover:shadow-md relative group"
                            >
                                {/* Card Header */}
                                <div className="flex items-center justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${typeInfo.color}`}
                                        >
                                            <TypeIcon className="w-3.5 h-3.5" />
                                            {typeInfo.label}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                            <BsCalendar3 className="w-3 h-3" />
                                            {entry.date || entry.createdAt?.split('T')[0]}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        {(entry.type === 'book_quote' || entry.type === 'game_moment' || entry.type === 'reflection') && (
                                            <button
                                                type="button"
                                                aria-label="Share highlight"
                                                onClick={() => handleOpenShareHighlight(entry, linkedItem)}
                                                className="p-1.5 rounded-xl text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors opacity-70 group-hover:opacity-100"
                                                title="Share / Publish Highlight"
                                            >
                                                <BsShare className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            aria-label="Delete entry"
                                            onClick={() => handleDelete(entry.id)}
                                            className="p-1.5 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors opacity-70 group-hover:opacity-100"
                                        >
                                            <BsTrash3 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Title (if present) */}
                                {entry.title && (
                                    <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">
                                        {entry.title}
                                    </h3>
                                )}

                                {/* Body */}
                                {entry.type === 'book_quote' ? (
                                    <blockquote className="my-2 pl-4 border-l-4 border-amber-500/80 italic text-gray-800 dark:text-gray-200 text-sm sm:text-base leading-relaxed bg-amber-50/40 dark:bg-amber-950/20 p-3 rounded-r-2xl">
                                        &ldquo;{entry.body}&rdquo;
                                    </blockquote>
                                ) : (
                                    <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line mb-3">
                                        {entry.body}
                                    </p>
                                )}

                                {/* Linked Media Footer */}
                                {linkedItem && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                                        <Link
                                            to={linkedItem.mediaType === 'book' ? `/app/books/${linkedItem.id}` : `/app/games/${linkedItem.id}`}
                                            className="inline-flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
                                        >
                                            <div className="w-6 h-8 rounded overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 border border-gray-200 dark:border-gray-700">
                                                {linkedItem.cover ? (
                                                    <img
                                                        src={linkedItem.cover}
                                                        alt={linkedItem.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : linkedItem.mediaType === 'book' ? (
                                                    <div className="w-full h-full flex items-center justify-center text-emerald-500">
                                                        <BsBook className="w-3 h-3" />
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-indigo-500">
                                                        <BsController className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className="font-semibold line-clamp-1">{linkedItem.title}</span>
                                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                                                {linkedItem.mediaType}
                                            </span>
                                        </Link>
                                    </div>
                                )}
                            </article>
                        );
                    })
                )}
            </div>

            {/* Write Entry Modal */}
            {isWriteModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
                    onClick={() => !saving && setIsWriteModalOpen(false)}
                >
                    <div
                        className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                            <h3 className="text-lg font-bold font-display text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <BsJournalText className="w-5 h-5 text-amber-500" />
                                New Journal Entry
                            </h3>
                            <button
                                type="button"
                                disabled={saving}
                                aria-label="Close modal"
                                onClick={() => setIsWriteModalOpen(false)}
                                className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <BsX className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSaveEntry} className="overflow-y-auto py-4 flex-1 space-y-4">
                            {/* Type selector */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    Entry Type
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {ENTRY_TYPES.map((t) => {
                                        const Icon = t.icon;
                                        const isSelected = entryType === t.id;
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setEntryType(t.id)}
                                                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                                                    isSelected
                                                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20'
                                                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                                }`}
                                            >
                                                <Icon className="w-4 h-4 shrink-0" />
                                                <span className="truncate">{t.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Title (optional) */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    Title (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={entryTitle}
                                    onChange={(e) => setEntryTitle(e.target.value)}
                                    placeholder="e.g. Chapter 4 Epiphany, Mid-game Boss Fight..."
                                    className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                />
                            </div>

                            {/* Date */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    Date
                                </label>
                                <input
                                    type="date"
                                    value={entryDate}
                                    onChange={(e) => setEntryDate(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                />
                            </div>

                            {/* Link to media (books / games) */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                                    <BsLink45Deg className="w-4 h-4 text-amber-500" />
                                    Link to Book or Game (Optional)
                                </label>
                                <select
                                    value={linkedMediaId}
                                    onChange={(e) => setLinkedMediaId(e.target.value)}
                                    className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                >
                                    <option value="">None (General Reflection)</option>
                                    <optgroup label="Books">
                                        {books.map((b) => (
                                            <option key={`b-${b.id}`} value={b.id}>
                                                📖 {b.title} {b.author ? `— ${b.author}` : ''}
                                            </option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Games">
                                        {games.map((g) => (
                                            <option key={`g-${g.id}`} value={g.id}>
                                                🎮 {g.title} {g.platform ? `(${g.platform})` : ''}
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            {/* Body (required) */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                                    {entryType === 'book_quote' ? 'Quote Text' : 'Notes & Reflection'}
                                </label>
                                <textarea
                                    required
                                    rows={5}
                                    value={entryBody}
                                    onChange={(e) => setEntryBody(e.target.value)}
                                    placeholder={
                                        entryType === 'book_quote'
                                            ? 'Enter the quote passage...'
                                            : 'Write your thoughts, takeaways, or impressions...'
                                    }
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                                />
                            </div>

                            {/* Modal Footer */}
                            <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => setIsWriteModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || !entryBody.trim()}
                                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white shadow-sm transition-all"
                                >
                                    {saving ? 'Saving...' : 'Save Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Shareable Highlight Modal */}
            <ShareableHighlightModal
                isOpen={Boolean(selectedHighlight)}
                onClose={() => setSelectedHighlight(null)}
                highlight={selectedHighlight}
                isPublished={
                    selectedHighlight
                        ? publishedHighlightIds.has(String(selectedHighlight.id)) ||
                          isHighlightPublished(user?.uid, selectedHighlight.id)
                        : false
                }
                onTogglePublish={handlePublishHighlight}
            />
        </DiaryShell>
    );
}

JournalPage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};
