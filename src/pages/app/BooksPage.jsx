import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import DiaryEditorModal from '../../components/ui/DiaryEditorModal';
import DiarySelect from '../../components/ui/DiarySelect';
import ConfirmDiscardDialog from '../../components/ui/ConfirmDiscardDialog';
import BookmoryImportPreview from '../../components/diary/BookmoryImportPreview';
import { useEditorDraftGuard } from '../../hooks/useEditorDraftGuard';
import { Link, useSearchParams } from 'react-router-dom';
import BottomTabs from '../../components/navigation/BottomTabs';
import LibrarySegmentedSwitch from '../../components/library/LibrarySegmentedSwitch';
import { useAuth } from '../../context/AuthContext';
import {
    saveBook,
    deleteBook,
    watchPublicBooks,
    getBookPrivateNotes,
    getDiaryRepository,
    saveJournalEntry,
} from '../../lib/db';
import { searchBooks } from '../../lib/openlibrary';
import {
    parseBookmoryMarkdown,
    parseBookmoryMarkdownPure,
    previewMigrationBatch,
    executeMigrationBatch,
} from '../../lib/bookmory';
import { useTimer } from '../../context/TimerContext';
import {
    BsPlusLg,
    BsStarFill,
    BsBook,
    BsClock,
    BsTrash3,
    BsPencilSquare,
    BsSearch,
    BsHeartFill,
    BsFileEarmarkArrowUp,
} from 'react-icons/bs';

const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'reading', label: 'Reading' },
    { key: 'completed', label: 'Completed' },
    { key: 'want-to-read', label: 'To Read' },
    { key: 'paused', label: 'Paused' },
    { key: 'dropped', label: 'Dropped' },
    { key: 'rereading', label: 'Rereading' },
];

const BooksPage = ({ darkMode, setDarkMode }) => {
    const { user } = useAuth();
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [librarySearch, setLibrarySearch] = useState('');

    // Add / Edit Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState(null);
    const { startTimer } = useTimer();
    const handleStartReading = useCallback((book) => {
        if (!book) return;
        const id = String(book.id || book.coverId || (book.title || 'book').replace(/\s+/g, '-').toLowerCase());
        startTimer({
            mediaType: 'book',
            itemId: id,
            itemTitle: book.title,
            itemCover: book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg` : ''),
            fromPage: book.currentPage || 0,
            totalPages: book.pages || null,
        });
    }, [startTimer]);
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [pages, setPages] = useState('');
    const [currentPage, setCurrentPage] = useState('0');
    const [status, setStatus] = useState('reading');
    const [rating, setRating] = useState('5');
    const [cover, setCover] = useState('');
    const [favorite, setFavorite] = useState(false);
    const [genres, setGenres] = useState('');
    const [privateNotes, setPrivateNotes] = useState('');
    const [currentOlKey, setCurrentOlKey] = useState('');
    const [currentCoverId, setCurrentCoverId] = useState(null);
    const [saving, setSaving] = useState(false);
    const editSignature = JSON.stringify([title, author, pages, currentPage, status, rating, cover, favorite, genres, privateNotes]);
    const closeEditorNow = useCallback(() => setIsModalOpen(false), []);
    const draftGuard = useEditorDraftGuard(isModalOpen, editSignature, closeEditorNow);

    // Open Library + iTunes Books Auto-Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    // Bookmory import + cloud sync state
    const importInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [importPreview, setImportPreview] = useState(null);
    const [executingImport, setExecutingImport] = useState(false);
    const [importMsg, setImportMsg] = useState(null);
    const [searchParams, setSearchParams] = useSearchParams();

    useEffect(() => {
        if (!user) return;
        const unsubscribe = watchPublicBooks(user.uid, (data) => {
            setBooks(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    // Live debounced auto-search (350ms)
    useEffect(() => {
        if (!isModalOpen) return;
        const q = searchQuery.trim();
        if (q.length < 2) return;

        let cancelled = false;

        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const results = await searchBooks(q);
                if (!cancelled) {
                    setSearchResults(results);
                    setHasSearched(true);
                }
            } catch (err) {
                console.error('Book auto-search failed:', err);
                if (!cancelled) {
                    setSearchResults([]);
                    setHasSearched(true);
                }
            } finally {
                if (!cancelled) {
                    setSearching(false);
                }
            }
        }, 350);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [searchQuery, isModalOpen]);

    const handleSearchQueryChange = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        if (val.trim().length < 2) {
            setSearchResults([]);
            setSearching(false);
            setHasSearched(false);
        } else {
            setSearching(true);
        }
    };

    const openAddModal = () => {
        setEditingBook(null);
        setTitle('');
        setAuthor('');
        setPages('');
        setCurrentPage('0');
        setStatus('reading');
        setRating('5');
        setCover('');
        setFavorite(false);
        setGenres('');
        setPrivateNotes('');
        setCurrentOlKey('');
        setCurrentCoverId(null);
        setSearchQuery('');
        setSearchResults([]);
        setHasSearched(false);
        setIsModalOpen(true);
    };

    // Query-based quick action consumption (UX-01)
    const consumedActionRef = useRef(null);
    useEffect(() => {
        const action = searchParams.get('action');
        if (!action || consumedActionRef.current === action) return;
        consumedActionRef.current = action;

        const timer = setTimeout(() => {
            if (action === 'add') {
                openAddModal();
            } else if (action === 'log') {
                const readingBook = books.find((b) => b.status === 'reading') || books[0];
                if (readingBook) {
                    handleStartReading(readingBook);
                } else {
                    openAddModal();
                }
            }
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('action');
                return next;
            }, { replace: true });
        }, 0);

        return () => clearTimeout(timer);
    }, [searchParams, setSearchParams, books, handleStartReading]);

    const openEditModal = async (book) => {
        const safeBookId = String(
            book.id || book.coverId || (book.title || 'book').replace(/\s+/g, '-').toLowerCase()
        );
        setEditingBook({ ...book, id: safeBookId });
        setTitle(book.title || '');
        setAuthor(book.author || '');
        setPages(String(book.pages || ''));
        setCurrentPage(String(book.currentPage || '0'));
        setStatus(book.status || 'reading');
        setRating(String(book.rating || '5'));
        setCover(book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg` : ''));
        setFavorite(Boolean(book.favorite));
        setGenres(Array.isArray(book.genres) ? book.genres.join(', ') : (book.genres || ''));
        setCurrentOlKey(book.olKey || '');
        setCurrentCoverId(book.coverId || null);
        setSearchQuery('');
        setSearchResults([]);
        setHasSearched(false);
        setIsModalOpen(true);

        // Fetch existing private notes asynchronously and populate state
        if (user && safeBookId) {
            try {
                const notes = await getBookPrivateNotes(user.uid, safeBookId);
                setPrivateNotes(notes);
            } catch (err) {
                console.error('Error fetching book private notes:', err);
            }
        }
    };

    const handleSearchOL = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const results = await searchBooks(searchQuery.trim());
            setSearchResults(results);
            setHasSearched(true);
        } catch (err) {
            console.error('Book search failed:', err);
            setHasSearched(true);
        } finally {
            setSearching(false);
        }
    };

    const selectOLBook = (book) => {
        setTitle(book.title || '');
        setAuthor(book.author || (Array.isArray(book.authors) ? book.authors.join(', ') : '') || 'Unknown Author');
        setPages(book.pages != null ? String(book.pages) : '');
        if (book.cover) setCover(book.cover);
        if (book.genres?.length) setGenres(book.genres.join(', '));
        if (book.olKey) setCurrentOlKey(book.olKey);
        if (book.coverId) setCurrentCoverId(book.coverId);
        setSearchQuery('');
        setSearchResults([]);
        setHasSearched(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);

        try {
            const genresArray = genres.split(',').map(s => s.trim()).filter(Boolean);
            await saveBook(
                user.uid,
                {
                    ...(editingBook || {}),
                    id: editingBook?.id,
                    olKey: editingBook?.olKey || currentOlKey,
                    coverId: editingBook?.coverId || currentCoverId,
                    title: title.trim(),
                    author: author.trim(),
                    authors: [author.trim()],
                    pages: Number(pages) || 0,
                    currentPage: Number(currentPage) || 0,
                    status,
                    rating: Number(rating) || 0,
                    cover: cover.trim(),
                    favorite,
                    genres: genresArray,
                    startedOn: editingBook?.startedOn || '',
                    finishedOn: editingBook?.finishedOn || (status === 'completed' ? new Date().toISOString().split('T')[0] : ''),
                },
                privateNotes
            );
            setIsModalOpen(false);
        } catch (err) {
            console.error('Failed to save book:', err);
            alert('Failed to save book: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (bookId) => {
        if (!window.confirm('Are you sure you want to delete this book?')) return;
        try {
            await deleteBook(user.uid, String(bookId));
        } catch (err) {
            alert('Failed to delete book: ' + err.message);
        }
    };

    const handleImportFiles = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (!files.length) return;
        setImporting(true);
        setImportMsg({ type: 'ok', text: `Analyzing ${files.length} file(s)...` });
        try {
            const candidates = [];
            for (const f of files) {
                const text = await f.text();
                let markdownRecords = [text];
                if (f.name.toLowerCase().endsWith('.bookmory')) throw new Error('Native .bookmory is a SQLite backup. First run scripts/convert_bookmory_backup.py locally, then choose its private JSON output.');
                if (f.name.toLowerCase().endsWith('.json')) {
                    const batch = JSON.parse(text);
                    if (batch?.format === 'bookmory-native-candidates-v1' && Array.isArray(batch.entries)) {
                        if (batch.entries.length > 5000) throw new Error('Import too large.');
                        candidates.push(...batch.entries.filter((c) => c?.item?.title && c?.item?.mediaType === 'book'));
                        continue;
                    }
                    if (batch?.format !== 'bookmory-markdown-batch-v1' || !Array.isArray(batch.entries)) {
                        throw new Error('Choose the supplied Bookmory import JSON file or individual .md files.');
                    }
                    markdownRecords = batch.entries.map((entry) => entry.markdown);
                }
                for (const markdown of markdownRecords) {
                const pure = parseBookmoryMarkdownPure(markdown);
                if (pure && pure.item) {
                    candidates.push(pure);
                } else {
                    const fallback = parseBookmoryMarkdown(markdown);
                    if (fallback) {
                        candidates.push({
                            item: {
                                schemaVersion: 2,
                                id: fallback.id || fallback.title.replace(/\s+/g, '-').toLowerCase(),
                                mediaType: 'book',
                                title: fallback.title,
                                creators: fallback.authors || (fallback.author ? [fallback.author] : ['Unknown Author']),
                                status: fallback.status,
                                rating: fallback.rating,
                                progress: { unit: 'page', current: fallback.currentPage || 0, total: fallback.pages || null },
                                favorite: fallback.favorite,
                                visibility: 'private',
                            },
                            attempts: [],
                            historicalAggregates: [],
                            journalEntries: fallback.privateNotes ? [{
                                schemaVersion: 2,
                                id: `journal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                                body: fallback.privateNotes,
                                visibility: 'private',
                                type: 'review',
                            }] : [],
                        });
                    }
                }
                }
            }

            if (!candidates.length) {
                setImportMsg({ type: 'error', text: 'No Bookmory books found. Select the converted native JSON batch, prepared Markdown JSON batch, or individual .md files.' });
                return;
            }

            // Pure dry-run calculation without any mutations (DATA-01)
            const remoteState = await getDiaryRepository(user.uid).getImportState();
            const existingCanonicalIds = new Set(remoteState.items.map((item) => item.id));
            // The legacy Books screen remains authoritative for current page/cover during the cutover.
            const previewReport = previewMigrationBatch(candidates, {
                ...remoteState,
                items: [...books.filter((book) => !existingCanonicalIds.has(book.id)), ...remoteState.items],
            });

            setImportPreview({
                previewReport,
                candidates,
                filesCount: files.length,
            });
            setImportMsg(null);
        } catch (err) {
            setImportMsg({ type: 'error', text: `Preview analysis failed: ${err.message}` });
        } finally {
            setImporting(false);
        }
    };

    const handleConfirmImport = async () => {
        if (!importPreview || !user) return;
        setExecutingImport(true);
        setImportMsg({ type: 'ok', text: 'Executing safe import...' });

        try {
            const repo = getDiaryRepository(user.uid);
            const report = importPreview.previewReport;

            const executionResult = await executeMigrationBatch({
                uid: user.uid,
                previewReport: report,
                repository: repo,
                onProgress: ({ current, total, message }) => {
                    setImportMsg({ type: 'ok', text: `[${current}/${total}] ${message}` });
                },
            });

            // Mirror staged items to local storage mirror and saveBook for immediate UI reactivity
            const staged = report.stagedEntities || {};
            for (const item of (staged.items || [])) {
                try {
                    await saveBook(
                        user.uid,
                        {
                            id: item.id,
                            title: item.title,
                            author: item.creators?.join(', ') || item.author || '',
                            authors: item.creators || [item.author],
                            pages: item.progress?.total ?? item.pages ?? null,
                            currentPage: item.progress?.current ?? item.currentPage ?? 0,
                            status: item.status,
                            rating: item.rating,
                            favorite: item.favorite,
                            isbn: item.isbn || null,
                            publisher: item.publisher || null,
                            publicationDate: item.publicationDate || null,
                            language: item.language || null,
                            bookFormat: item.bookFormat || null,
                            purchases: item.purchases || [],
                            wishlist: item.wishlist || false,
                            bookmoryLogCount: item.bookmoryLogCount || 0,
                            cover: item.cover || '', 
                            coverId: item.coverId || null,
                            olKey: item.olKey || '',
                            genres: item.tags || item.genres || [],
                            startedOn: item.startedOn || '',
                            finishedOn: item.finishedOn || '',
                        },
                        undefined // Never overwrite a private note during metadata import.
                    );
                } catch (err) {
                    console.warn(`Local mirror update for ${item.title}:`, err);
                }
            }

            // Mirror staged journal entries to saveJournalEntry
            for (const j of (staged.journalEntries || [])) {
                try {
                    await saveJournalEntry(user.uid, {
                        ...j,
                        entryType: j.type || 'review',
                        body: j.body,
                        title: j.title || `Review: ${staged.items?.find(i => i.id === j.linkedMediaId)?.title || 'Book'}`,
                        linkedMediaId: j.linkedMediaId,
                        linkedMediaType: 'book',
                    });
                } catch (err) {
                    console.warn('Journal entry mirror update:', err);
                }
            }

            setImportPreview(null);
            const summaryText = `Safe import complete: ${executionResult.importedCount} books, ${executionResult.sessionsCount || 0} precisely timed sessions, ${report.summary.duplicates} duplicates skipped.`;
            setImportMsg({ type: 'ok', text: summaryText + '\nChanges are saved to Firebase automatically when connected.' });
        } catch (err) {
            setImportMsg({ type: 'error', text: `Execution failed: ${err.message}` });
        } finally {
            setExecutingImport(false);
        }
    };

    const filtered = books.filter(b => {
        if (filter !== 'all' && b.status !== filter) return false;
        if (librarySearch.trim()) {
            const q = librarySearch.toLowerCase().trim();
            const titleMatch = (b.title || '').toLowerCase().includes(q);
            const authorMatch = (b.author || '').toLowerCase().includes(q);
            if (!titleMatch && !authorMatch) return false;
        }
        return true;
    }).sort((a, b) => {
        if (filter === 'completed') {
            const timeA = a.finishedOn ? new Date(a.finishedOn).getTime() : 0;
            const timeB = b.finishedOn ? new Date(b.finishedOn).getTime() : 0;
            if (timeA !== timeB) return timeB - timeA;
        }
        if (filter === 'all') {
            if (a.status === 'reading' && b.status !== 'reading') return -1;
            if (b.status === 'reading' && a.status !== 'reading') return 1;
            if (a.status === 'completed' && b.status === 'completed') {
                const timeA = a.finishedOn ? new Date(a.finishedOn).getTime() : 0;
                const timeB = b.finishedOn ? new Date(b.finishedOn).getTime() : 0;
                if (timeA !== timeB) return timeB - timeA;
            }
            if (a.status === 'completed' && b.status !== 'completed') return -1;
            if (b.status === 'completed' && a.status !== 'completed') return 1;
            if (a.status === 'want-to-read' && b.status === 'dropped') return -1;
            if (a.status === 'want-to-read' && a.status === 'dropped') return 1;
        }
        return 0;
    });

    const readingCount = books.filter(b => b.status === 'reading').length;
    const completedCount = books.filter(b => b.status === 'completed').length;

    return (
        <BottomTabs title="Books Diary" darkMode={darkMode} setDarkMode={setDarkMode}>
            {/* Library Switch */}
            <LibrarySegmentedSwitch />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-display font-bold text-primary dark:text-gray-100">
                        Bookshelf &amp; Reading
                    </h1>
                    <p className="text-xs text-secondary dark:text-gray-400 mt-0.5">
                        Track reading progress, log finished books, and record sessions
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <input
                        ref={importInputRef}
                        type="file"
                        accept=".md,.txt,.json,text/markdown,text/plain,application/json"
                        multiple
                        className="hidden"
                        onChange={handleImportFiles}
                    />

                    <button
                        onClick={() => importInputRef.current?.click()}
                        disabled={importing}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-secondary dark:text-gray-300 hover:text-primary dark:hover:text-gray-100 transition-colors cursor-pointer disabled:opacity-60"
                        title="Choose private native-converted Bookmory JSON, prepared 51-book JSON, or exported .md files"
                    >
                        <BsFileEarmarkArrowUp className="w-4 h-4" />
                        {importing ? 'Importing...' : 'Import Files'}
                    </button>

                    <button
                        onClick={openAddModal}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 font-semibold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                    >
                        <BsPlusLg className="w-3.5 h-3.5" />
                        Add Book
                    </button>
                </div>
            </div>

            {importMsg && (
                <div
                    className={`mb-4 p-3 rounded-xl text-xs whitespace-pre-line border ${
                        importMsg.type === 'error'
                            ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300'
                            : importMsg.type === 'warn'
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-300'
                            : 'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-300'
                    }`}
                >
                    {importMsg.text}
                </div>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-display font-bold text-primary dark:text-gray-100">
                        {books.length}
                    </p>
                    <p className="text-[11px] text-secondary dark:text-gray-400 mt-1 uppercase tracking-wider">
                        Total Books
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-display font-bold text-blue-500">
                        {readingCount}
                    </p>
                    <p className="text-[11px] text-secondary dark:text-gray-400 mt-1 uppercase tracking-wider">
                        Reading
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-display font-bold text-green-500">
                        {completedCount}
                    </p>
                    <p className="text-[11px] text-secondary dark:text-gray-400 mt-1 uppercase tracking-wider">
                        Done
                    </p>
                </div>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {statusTabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                                filter === tab.key
                                    ? 'bg-primary text-white dark:bg-gray-100 dark:text-gray-900'
                                    : 'bg-white dark:bg-gray-900 text-secondary dark:text-gray-400 border border-border dark:border-gray-800 hover:border-gray-400'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative min-w-[200px]">
                    <BsSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary dark:text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search books..."
                        value={librarySearch}
                        onChange={(e) => setLibrarySearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-gray-900 border border-border dark:border-gray-800 text-primary dark:text-gray-100 focus:outline-none focus:border-primary dark:focus:border-gray-600"
                    />
                </div>
            </div>

            {/* Books Grid */}
            {loading ? (
                <div className="py-20 text-center">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary dark:border-gray-700 dark:border-t-gray-100 rounded-full animate-spin mx-auto" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-900 border border-dashed border-border dark:border-gray-800 rounded-2xl p-8">
                    <BsBook className="w-10 h-10 text-secondary dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-primary dark:text-gray-200">
                        {books.length === 0 ? 'Your bookshelf is waiting' : 'No books match these filters'}
                    </p>
                    {books.length > 0 && <button type="button" onClick={() => { setFilter('all'); setLibrarySearch(''); }} className="diary-press mt-4 min-h-11 px-4 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold">Clear filters</button>}
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filtered.map((book) => {
                        const safeBookId = String(
                            book.id || book.coverId || (book.title || 'book').replace(/\s+/g, '-').toLowerCase()
                        );
                        const bookWithId = { ...book, id: safeBookId };
                        const coverSrc = book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg` : '');
                        return (
                            <div
                                key={safeBookId}
                                className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between group hover:border-primary/40 dark:hover:border-gray-700 transition-colors"
                            >
                                <Link to={`/app/books/${safeBookId}`} className="block flex-1 cursor-pointer">
                                    <div className="relative aspect-[2/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                        {coverSrc ? (
                                            <img
                                                src={coverSrc}
                                                alt={book.title}
                                                className="w-full h-full object-contain group-hover:scale-[1.025] transition-transform duration-300"
                                                loading="lazy"
                                                decoding="async"
                                                width="176" height="264"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center p-2 text-center text-xs text-secondary">
                                                {book.title}
                                            </div>
                                        )}
                                        {book.favorite && (
                                            <span className="absolute top-2 left-2 text-pink-500 drop-shadow-sm">
                                                <BsHeartFill className="w-3.5 h-3.5" />
                                            </span>
                                        )}
                                        {book.rating && (
                                            <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm flex items-center gap-1">
                                                <BsStarFill className="w-2.5 h-2.5 text-amber-400" />
                                                {book.rating}
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-3">
                                        <h3 className="font-semibold text-xs text-primary dark:text-gray-100 line-clamp-2 min-h-[2rem] group-hover:text-blue-500 transition-colors">
                                            {book.title}
                                        </h3>
                                        <p className="text-[11px] text-secondary dark:text-gray-400 truncate mt-0.5">
                                            {book.author}
                                        </p>

                                        {/* Progress bar */}
                                        <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full diary-progress-fill ${
                                                    book.status === 'completed'
                                                        ? 'bg-green-500'
                                                        : book.status === 'want-to-read'
                                                        ? 'bg-amber-400'
                                                        : 'bg-blue-500'
                                                }`}
                                                style={{ width: `${book.progress || 0}%` }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-secondary dark:text-gray-500 mt-1">
                                            {book.status === 'completed' ? 'Completed' : (book.pages ? `${book.currentPage || 0} / ${book.pages} p. (${book.progress || 0}%)` : `${book.currentPage || 0} pages read`)}
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {((Array.isArray(book.genres) && book.genres.length > 0 ? book.genres : (Array.isArray(book.tags) ? book.tags : [])).slice(0, 2)).map(g => (
                                                <span key={g} className="text-[9px] px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-600 dark:bg-pink-900/20 dark:text-pink-400 font-medium">
                                                    {g}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </Link>

                                <div className="px-3 pb-2 pt-1 border-t border-border/40 dark:border-gray-800/40 flex items-center justify-end gap-1">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleStartReading(bookWithId);
                                        }}
                                        className="diary-press min-w-11 min-h-11 inline-flex items-center justify-center text-secondary dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 cursor-pointer"
                                        title="Reading Timer"
                                        aria-label={`Reading timer for ${book.title}`}
                                    >
                                        <BsClock className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openEditModal(bookWithId);
                                        }}
                                        className="diary-press min-w-11 min-h-11 inline-flex items-center justify-center text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 cursor-pointer"
                                        title="Edit Book"
                                        aria-label={`Edit ${book.title}`}
                                    >
                                        <BsPencilSquare className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(safeBookId);
                                        }}
                                        className="diary-press min-w-11 min-h-11 inline-flex items-center justify-center text-secondary dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                        title="Delete Book"
                                        aria-label={`Delete ${book.title}`}
                                    >
                                        <BsTrash3 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add / Edit Book Modal */}
            {isModalOpen && (
                <DiaryEditorModal title={editingBook ? 'Edit Book' : 'Add Book to Shelf'} onClose={draftGuard.requestClose} busy={saving} footer={<>
                    <button type="button" onClick={draftGuard.requestClose} disabled={saving} className="min-h-11 rounded-xl px-5 text-sm font-semibold text-gray-600 dark:text-gray-300">Cancel</button>
                    <button type="submit" form="book-editor-form" disabled={saving} className="min-h-11 rounded-xl bg-sky-600 px-6 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save Book'}</button>
                </>}>

                        {/* Auto-Search Books (Open Library + iTunes Books) */}
                        <form onSubmit={handleSearchOL} className="mb-4">
                            <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                Auto-Fill Book Info (Type title or author to search automatically)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={handleSearchQueryChange}
                                    placeholder="Type book title or author..."
                                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-xs"
                                />
                                <button
                                    type="submit"
                                    disabled={searching}
                                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                                >
                                    <BsSearch className="w-3 h-3" />
                                    {searching ? 'Searching...' : 'Search'}
                                </button>
                            </div>

                            {searching && (
                                <div className="mt-2 p-2.5 text-xs text-secondary dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-lg flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary dark:border-gray-600 dark:border-t-gray-200 rounded-full animate-spin" />
                                    Searching books...
                                </div>
                            )}

                            {!searching && searchResults.length > 0 && (
                                <div className="mt-2 max-h-48 overflow-y-auto border border-border dark:border-gray-800 rounded-lg p-1 space-y-1 bg-white dark:bg-gray-900 shadow-inner">
                                    {searchResults.map((r, i) => (
                                        <div
                                            key={r.olKey || i}
                                            onClick={() => selectOLBook(r)}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-2.5 text-xs transition-colors"
                                        >
                                            {r.cover ? (
                                                <img
                                                    src={r.cover}
                                                    alt=""
                                                    className="w-7 h-10 rounded object-cover flex-shrink-0 bg-gray-200 dark:bg-gray-700"
                                                />
                                            ) : (
                                                <div className="w-7 h-10 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                                                    <BsBook className="w-3.5 h-3.5 text-secondary" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-primary dark:text-gray-100 truncate">
                                                    {r.title}
                                                </p>
                                                <p className="text-[10px] text-secondary dark:text-gray-400 truncate">
                                                    {[
                                                        r.author,
                                                        r.pages ? `${r.pages} pages` : null,
                                                        r.genres?.slice(0, 2).join(', '),
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!searching && hasSearched && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                                <p className="mt-2 text-xs text-secondary dark:text-gray-400 italic px-1">
                                    No matches found for &ldquo;{searchQuery.trim()}&rdquo; &mdash; you can still enter details manually below.
                                </p>
                            )}
                        </form>

                        <form id="book-editor-form" onSubmit={handleSave} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Book Title *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Author(s)
                                </label>
                                <input
                                    type="text"
                                    value={author}
                                    onChange={(e) => setAuthor(e.target.value)}
                                    placeholder="Author name"
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                        Shelf Status
                                    </label>
                                    <DiarySelect label="Shelf status" value={status} onChange={setStatus} options={[{ value: 'reading', label: 'Reading' },{ value: 'completed', label: 'Completed' },{ value: 'want-to-read', label: 'Want to Read' },{ value: 'dropped', label: 'Dropped' }]} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                        Rating (1 - 5)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="5"
                                        step="0.5"
                                        value={rating}
                                        onChange={(e) => setRating(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                        Current Page
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={currentPage}
                                        onChange={(e) => setCurrentPage(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                        Total Pages
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={pages}
                                        onChange={(e) => setPages(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Cover Image URL
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="url"
                                        value={cover}
                                        onChange={(e) => setCover(e.target.value)}
                                        placeholder="https://..."
                                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                    />
                                    {cover && (
                                        <img
                                            src={cover}
                                            alt="Book cover preview"
                                            className="w-9 h-12 rounded-lg object-cover border border-border dark:border-gray-700 flex-shrink-0 bg-gray-100 dark:bg-gray-800"
                                        />
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Genres (comma separated)
                                </label>
                                <input
                                    type="text"
                                    value={genres}
                                    onChange={(e) => setGenres(e.target.value)}
                                    placeholder="Fantasy, Romance, Sci-Fi"
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    id="book-fav"
                                    type="checkbox"
                                    checked={favorite}
                                    onChange={(e) => setFavorite(e.target.checked)}
                                    className="w-4 h-4 rounded text-pink-500 focus:ring-pink-500 cursor-pointer"
                                />
                                <label htmlFor="book-fav" className="text-xs font-medium text-primary dark:text-gray-200 cursor-pointer">
                                    Mark as Favorite Book
                                </label>
                            </div>

                            <div className="pt-2 border-t border-border dark:border-gray-800">
                                <label className="block text-xs font-semibold text-secondary dark:text-gray-400 mb-1">
                                    Private Reading Notes (Hidden from Public Website)
                                </label>
                                <textarea
                                    rows="3"
                                    value={privateNotes}
                                    onChange={(e) => setPrivateNotes(e.target.value)}
                                    placeholder="Thoughts, quotes, or notes stored in your private subcollection..."
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-xs resize-none"
                                />
                            </div>
                        </form>
                </DiaryEditorModal>
            )}
            {draftGuard.confirmDiscard && <ConfirmDiscardDialog onStay={draftGuard.keepEditing} onDiscard={draftGuard.discard}/>}

            {importPreview && <BookmoryImportPreview preview={importPreview} busy={executingImport} onClose={() => setImportPreview(null)} onConfirm={handleConfirmImport} />}

        </BottomTabs>
    );
};

BooksPage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};

export default BooksPage;
