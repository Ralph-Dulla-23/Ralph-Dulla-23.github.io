import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import BottomTabs from '../../components/navigation/BottomTabs';
import { useAuth } from '../../context/AuthContext';
import {
    saveBook,
    deleteBook,
    watchPublicBooks,
    seedExistingBooks,
    getBookPrivateNotes,
} from '../../lib/db';
import { searchBooks } from '../../lib/openlibrary';
import ReadingTimerModal from '../../components/books/ReadingTimerModal';
import {
    BsPlusLg,
    BsStarFill,
    BsBook,
    BsClock,
    BsTrash3,
    BsPencilSquare,
    BsSearch,
    BsHeartFill,
    BsCloudArrowUp,
    BsCheck2Circle,
} from 'react-icons/bs';

const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'reading', label: 'Reading' },
    { key: 'completed', label: 'Completed' },
    { key: 'want-to-read', label: 'To Read' },
];

const BooksPage = ({ darkMode, setDarkMode }) => {
    const { user } = useAuth();
    const [books, setBooks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    // Add / Edit Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBook, setEditingBook] = useState(null);
    const [timerBook, setTimerBook] = useState(null);
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

    // Open Library Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Seeding state
    const [seeding, setSeeding] = useState(false);
    const [seedSuccess, setSeedSuccess] = useState(false);

    useEffect(() => {
        if (!user) return;
        const unsubscribe = watchPublicBooks(user.uid, (data) => {
            setBooks(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

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
        setIsModalOpen(true);
    };

    const openEditModal = async (book) => {
        setEditingBook(book);
        setTitle(book.title || '');
        setAuthor(book.author || '');
        setPages(String(book.pages || ''));
        setCurrentPage(String(book.currentPage || '0'));
        setStatus(book.status || 'reading');
        setRating(String(book.rating || '5'));
        setCover(book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg` : ''));
        setFavorite(Boolean(book.favorite));
        setGenres(Array.isArray(book.genres) ? book.genres.join(', ') : '');
        setCurrentOlKey(book.olKey || '');
        setCurrentCoverId(book.coverId || null);
        setSearchQuery('');
        setSearchResults([]);
        setIsModalOpen(true);

        // Fetch existing private notes asynchronously and populate state (do not clear to empty string)
        if (user && book.id) {
            try {
                const notes = await getBookPrivateNotes(user.uid, book.id);
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
            const results = await searchBooks(searchQuery);
            setSearchResults(results);
        } catch (err) {
            console.error('Open Library search failed:', err);
        } finally {
            setSearching(false);
        }
    };

    const selectOLBook = (book) => {
        setTitle(book.title);
        setAuthor(book.author);
        if (book.cover) setCover(book.cover);
        if (book.pages) setPages(String(book.pages));
        if (book.genres?.length) setGenres(book.genres.join(', '));
        if (book.olKey) setCurrentOlKey(book.olKey);
        if (book.coverId) setCurrentCoverId(book.coverId);
        setSearchResults([]);
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
            await deleteBook(user.uid, bookId);
        } catch (err) {
            alert('Failed to delete book: ' + err.message);
        }
    };

    const handleSeed = async () => {
        if (!window.confirm('Seed your 29 existing books from books.js into Firestore?')) return;
        setSeeding(true);
        try {
            await seedExistingBooks(user.uid);
            setSeedSuccess(true);
            setTimeout(() => setSeedSuccess(false), 5000);
        } catch (err) {
            alert('Failed to seed books: ' + err.message);
        } finally {
            setSeeding(false);
        }
    };

    const filtered = books.filter(b => {
        if (filter === 'all') return true;
        return b.status === filter;
    });

    const readingCount = books.filter(b => b.status === 'reading').length;
    const completedCount = books.filter(b => b.status === 'completed').length;

    return (
        <BottomTabs title="Books Diary" darkMode={darkMode} setDarkMode={setDarkMode}>
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

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSeed}
                        disabled={seeding}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-secondary dark:text-gray-300 hover:text-primary dark:hover:text-gray-100 transition-colors cursor-pointer"
                        title="Import the 29 hardcoded books from books.js into Firestore"
                    >
                        <BsCloudArrowUp className="w-4 h-4" />
                        {seeding ? 'Seeding...' : 'Seed Existing (29)'}
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

            {seedSuccess && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 rounded-xl text-green-700 dark:text-green-300 text-xs flex items-center gap-2">
                    <BsCheck2Circle className="w-4 h-4" />
                    Successfully seeded 29 books into your live Firestore!
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

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {statusTabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all cursor-pointer whitespace-nowrap ${
                            filter === tab.key
                                ? 'bg-primary text-white dark:bg-gray-100 dark:text-gray-900'
                                : 'bg-white dark:bg-gray-900 text-secondary dark:text-gray-400 border border-border dark:border-gray-800 hover:border-gray-400'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
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
                        No books in this shelf
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filtered.map((book) => {
                        const coverSrc = book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg` : '');
                        return (
                            <div
                                key={book.id || book.title}
                                className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="relative aspect-[2/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                        {coverSrc ? (
                                            <img
                                                src={coverSrc}
                                                alt={book.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
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
                                        <h3 className="font-semibold text-xs text-primary dark:text-gray-100 truncate">
                                            {book.title}
                                        </h3>
                                        <p className="text-[11px] text-secondary dark:text-gray-400 truncate mt-0.5">
                                            {book.author}
                                        </p>

                                        {/* Progress bar */}
                                        <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${
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
                                            {book.status === 'completed' ? 'Completed' : `${book.progress || 0}%`}
                                        </p>
                                    </div>
                                </div>

                                <div className="px-3 pb-2 pt-1 border-t border-border/40 dark:border-gray-800/40 flex items-center justify-end gap-1">
                                    <button
                                        onClick={() => setTimerBook(book)}
                                        className="p-1.5 text-secondary dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 cursor-pointer"
                                        title="Reading Timer"
                                    >
                                        <BsClock className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => openEditModal(book)}
                                        className="p-1.5 text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 cursor-pointer"
                                        title="Edit Book"
                                    >
                                        <BsPencilSquare className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(book.id)}
                                        className="p-1.5 text-secondary dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                        title="Delete Book"
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
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl my-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-display font-bold text-primary dark:text-gray-100 mb-4">
                            {editingBook ? 'Edit Book' : 'Add Book to Shelf'}
                        </h2>

                        {/* Open Library Search */}
                        <form onSubmit={handleSearchOL} className="mb-4">
                            <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                Search Open Library (Free book metadata &amp; covers)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search title, author..."
                                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-xs"
                                />
                                <button
                                    type="submit"
                                    disabled={searching}
                                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                                >
                                    <BsSearch className="w-3 h-3" />
                                    {searching ? '...' : 'Search'}
                                </button>
                            </div>

                            {searchResults.length > 0 && (
                                <div className="mt-2 max-h-40 overflow-y-auto border border-border dark:border-gray-800 rounded-lg p-1 space-y-1">
                                    {searchResults.map((r, i) => (
                                        <div
                                            key={r.olKey || i}
                                            onClick={() => selectOLBook(r)}
                                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer flex items-center gap-2 text-xs"
                                        >
                                            {r.cover && <img src={r.cover} alt="" className="w-6 h-8 rounded object-cover" />}
                                            <div className="truncate">
                                                <p className="font-semibold truncate">{r.title}</p>
                                                <p className="text-[10px] text-secondary truncate">{r.author}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </form>

                        <form onSubmit={handleSave} className="space-y-3">
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
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                    >
                                        <option value="reading">Reading</option>
                                        <option value="completed">Completed</option>
                                        <option value="want-to-read">Want to Read</option>
                                        <option value="dropped">Dropped</option>
                                    </select>
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
                                <input
                                    type="url"
                                    value={cover}
                                    onChange={(e) => setCover(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                />
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

                            <div className="flex gap-2 justify-end pt-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-primary dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold cursor-pointer disabled:opacity-60"
                                >
                                    {saving ? 'Saving...' : 'Save Book'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reading Timer Modal */}
            <ReadingTimerModal
                book={timerBook}
                isOpen={Boolean(timerBook)}
                onClose={() => setTimerBook(null)}
                onSessionSaved={() => {}}
            />
        </BottomTabs>
    );
};

BooksPage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};

export default BooksPage;
