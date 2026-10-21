import DiarySelect from '../../components/ui/DiarySelect';
import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DiaryShell } from '../../components/diary/DiaryShell';
import { useAuth } from '../../context/AuthContext';
import { useTimer } from '../../context/TimerContext';
import {
    watchPublicBooks,
    saveBook,
    addReadingSession,
    deleteBook,
    getBookPrivateNotes,
    getReadingSessions,
    publishLibraryItem,
    unpublishLibraryItem,
    watchPublicShelf,
} from '../../lib/db';
import { useDiarySessions } from '../../hooks/useDiarySessions';
// Retained temporarily as deprecated adapter reference for backwards compatibility (DIARY_STABILIZATION_IMPLEMENTATION.md Section 6):
// ReadingTimerModal is superseded by unified useTimer().startTimer() and ActivityTimerReviewModal.
import {
    BsArrowLeft,
    BsStarFill,
    BsHeartFill,
    BsClock,
    BsPencilSquare,
    BsTrash3,
    BsCheck2Circle,
    BsBook,
    BsJournalText,
    BsCalendar3,
    BsBookmarkCheck,
    BsInfoCircle,
    BsGlobe,
} from 'react-icons/bs';

export default function BookDetailPage({ darkMode, setDarkMode }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { startTimer, activeTimer } = useTimer();

    const [book, setBook] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'sessions' | 'notes' | 'attempts'

    // Edit modal state
    const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
    const [newCurrentPage, setNewCurrentPage] = useState('');
    const [newStatus, setNewStatus] = useState('reading');
    const [savingProgress, setSavingProgress] = useState(false);
    const [logPageActivity, setLogPageActivity] = useState(false);

    // Private notes & sessions
    const [privateNotes, setPrivateNotes] = useState('');
    const [sessions, setSessions] = useState([]);
    const [loadingNotes, setLoadingNotes] = useState(true);
    const [loadingSessions, setLoadingSessions] = useState(true);

    const { sessions: canonicalSessions, loading: loadingCanonicalSessions } = useDiarySessions({
        libraryItemId: id,
        mediaType: 'book',
    });

    // Merged display sessions (canonical priority, legacy fallback)
    const displaySessions = useMemo(() => {
        const map = new Map();
        (sessions || []).forEach((s) => {
            if (s && s.id) map.set(String(s.id), s);
        });
        (canonicalSessions || []).forEach((s) => {
            if (s && s.id) map.set(String(s.id), s);
        });
        return Array.from(map.values()).sort((a, b) =>
            String(b.startedAt || b.date || '').localeCompare(String(a.startedAt || a.date || ''))
        );
    }, [sessions, canonicalSessions]);

    // Observe books to locate item
    useEffect(() => {
        if (!user || !id) return;
        const unsubscribe = watchPublicBooks(user.uid, (data) => {
            const found = data.find((b) => {
                const safeId = String(
                    b.id || b.coverId || (b.title || 'book').replace(/\s+/g, '-').toLowerCase()
                );
                return safeId === id || String(b.id) === id;
            });
            if (found) {
                const safeId = String(
                    found.id || found.coverId || (found.title || 'book').replace(/\s+/g, '-').toLowerCase()
                );
                setBook({ ...found, id: safeId });
                setNewCurrentPage(String(found.currentPage || 0));
                setNewStatus(found.status || 'reading');
            } else {
                setBook(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, id]);

    // Load private notes and sessions asynchronously
    useEffect(() => {
        if (!user || !book?.id) return;

        let active = true;
        (async () => {
            try {
                const [notes, sess] = await Promise.all([
                    getBookPrivateNotes(user.uid, book.id),
                    getReadingSessions(user.uid, book.id),
                ]);
                if (active) {
                    setPrivateNotes(notes || '');
                    setSessions(Array.isArray(sess) ? sess : []);
                }
            } catch (err) {
                console.error('Error fetching book details async data:', err);
            } finally {
                if (active) {
                    setLoadingNotes(false);
                    setLoadingSessions(false);
                }
            }
        })();

        return () => {
            active = false;
        };
    }, [user, book?.id]);

    const [isPublished, setIsPublished] = useState(false);
    const [checkedBookId, setCheckedBookId] = useState(null);
    const publicationChecked = checkedBookId === book?.id;

    // Subscribe to public shelf updates
    useEffect(() => {
        if (!user || !book?.id) return;
        const unsub = watchPublicShelf(user.uid, (shelf) => {
            setIsPublished(shelf.some((item) => String(item.id) === String(book.id)));
            setCheckedBookId(book.id);
        });
        return () => unsub();
    }, [user, book?.id]);

    const handleTogglePublish = async () => {
        if (!user || !book) return;
        try {
            if (isPublished) {
                await unpublishLibraryItem(user.uid, book.id);
                setIsPublished(false);
            } else {
                await publishLibraryItem(user.uid, book);
                setIsPublished(true);
            }
        } catch (err) {
            alert('Failed to update publication: ' + err.message);
        }
    };

    const handleToggleFavorite = async () => {
        if (!user || !book) return;
        try {
            const updated = { ...book, favorite: !book.favorite };
            await saveBook(user.uid, updated, privateNotes);
            setBook(updated);
        } catch (err) {
            alert('Failed to update favorite: ' + err.message);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete "${book.title}"? This cannot be undone.`)) return;
        try {
            await deleteBook(user.uid, book.id);
            navigate('/app/library/books');
        } catch (err) {
            alert('Failed to delete book: ' + err.message);
        }
    };

    const handleSaveProgress = async (e) => {
        e.preventDefault();
        if (!user || !book) return;
        setSavingProgress(true);

        try {
            const pageNum = Math.max(0, parseInt(newCurrentPage, 10) || 0);
            const isCompleted = newStatus === 'completed' || (book.pages && pageNum >= book.pages);
            const statusToSet = isCompleted ? 'completed' : newStatus;

            const updated = {
                ...book,
                currentPage: pageNum,
                status: statusToSet,
                finishedOn: isCompleted ? (book.finishedOn || new Date().toISOString().split('T')[0]) : '',
            };

            // A metadata correction does not imply reading today. Opt in explicitly.
            if (logPageActivity && pageNum < (Number(book.currentPage) || 0)) {
                throw new Error('To log pages read, the ending page must exceed the previous page. Uncheck activity logging for corrections.');
            }
            await saveBook(user.uid, updated, privateNotes);
            if (logPageActivity && pageNum > (Number(book.currentPage) || 0)) {
                await addReadingSession(user.uid, book.id, {
                    id: `manual_${Date.now()}`,
                    fromPage: Number(book.currentPage) || 0,
                    toPage: pageNum,
                    totalPages: book.pages,
                    minutes: 0,
                    startedAt: new Date().toISOString(),
                    status: statusToSet,
                });
            }
            setLogPageActivity(false);
            setIsProgressModalOpen(false);
        } catch (err) {
            alert('Failed to update progress: ' + err.message);
        } finally {
            setSavingProgress(false);
        }
    };

    if (loading) {
        return (
            <DiaryShell title="Book Detail" darkMode={darkMode} setDarkMode={setDarkMode}>
                <div className="py-24 text-center">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary dark:border-gray-700 dark:border-t-gray-100 rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-secondary dark:text-gray-400 mt-3">Loading book details...</p>
                </div>
            </DiaryShell>
        );
    }

    if (!book) {
        return (
            <DiaryShell title="Book Not Found" darkMode={darkMode} setDarkMode={setDarkMode}>
                <div className="py-20 text-center max-w-md mx-auto">
                    <BsBook className="w-12 h-12 text-secondary dark:text-gray-600 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-primary dark:text-gray-100">Book Not Found</h2>
                    <p className="text-xs text-secondary dark:text-gray-400 mt-1 mb-6">
                        The requested book does not exist or has been removed.
                    </p>
                    <Link
                        to="/app/library/books"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold"
                    >
                        <BsArrowLeft className="w-3.5 h-3.5" /> Back to Books
                    </Link>
                </div>
            </DiaryShell>
        );
    }

    const coverSrc = book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg` : '');
    const hasTotalPages = Boolean(book.pages && Number(book.pages) > 0);
    const progressPercent = hasTotalPages
        ? Math.min(100, Math.round(((book.currentPage || 0) / Number(book.pages)) * 100))
        : 0;

    return (
        <DiaryShell title={book.title} darkMode={darkMode} setDarkMode={setDarkMode}>
            {/* Top Navigation */}
            <div className="mb-6 flex items-center justify-between">
                <Link
                    to="/app/library/books"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 transition-colors"
                >
                    <BsArrowLeft className="w-4 h-4" /> Back to Books
                </Link>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleTogglePublish}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isPublished
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400'
                                : 'bg-white dark:bg-gray-900 border-border dark:border-gray-800 text-secondary dark:text-gray-400 hover:text-emerald-600'
                        }`}
                        title={isPublished ? 'Published to Public Shelf (Click to unpublish)' : 'Publish to Public Shelf'}
                    >
                        <BsGlobe className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{isPublished ? 'Published' : 'Publish to Shelf'}</span>
                    </button>
                    <button
                        onClick={handleToggleFavorite}
                        className={`diary-heart diary-press p-2 rounded-xl border transition-colors cursor-pointer ${
                            book.favorite
                                ? 'bg-pink-50 dark:bg-pink-950/40 border-pink-200 dark:border-pink-900/50 text-pink-500'
                                : 'bg-white dark:bg-gray-900 border-border dark:border-gray-800 text-secondary dark:text-gray-400 hover:text-pink-500'
                        }`}
                        title={book.favorite ? 'Remove from favorites' : 'Mark as favorite'}
                    >
                        <BsHeartFill className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-2 rounded-xl bg-white dark:bg-gray-900 border border-border dark:border-gray-800 text-secondary dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete book"
                    >
                        <BsTrash3 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {publicationChecked && !isPublished && (
                <p className="-mt-2 mb-6 flex items-start gap-2 text-xs leading-5 text-secondary dark:text-gray-400">
                    <BsInfoCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>This book is private and won’t appear on your public library until you publish it. Published book details update when you save changes, subject to their visibility settings.</span>
                </p>
            )}

            {/* Book Header Card */}
            <div className="diary-feature-card rounded-3xl p-5 sm:p-8 mb-6">
                <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
                    {/* Cover Art */}
                    <div className="diary-detail-cover w-32 sm:w-44 shrink-0 mx-auto sm:mx-0 aspect-[2/3] rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-border/50 dark:border-gray-800 shadow-md">
                        {coverSrc ? (
                            <img
                                src={coverSrc}
                                alt={book.title}
                                decoding="async"
                                width="176" height="264"
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                                <BsBook className="w-8 h-8 text-secondary dark:text-gray-600 mb-2" />
                                <span className="text-[11px] font-medium text-secondary">{book.title}</span>
                            </div>
                        )}
                    </div>

                    {/* Book Metadata */}
                    <div className="flex-1 w-full text-center sm:text-left">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/50">
                                {book.status || 'reading'}
                            </span>
                            {book.rating && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
                                    <BsStarFill className="w-2.5 h-2.5" />
                                    {book.rating} / 5
                                </span>
                            )}
                        </div>

                        <h1 className="text-xl sm:text-2xl font-display font-bold text-primary dark:text-gray-100">
                            {book.title}
                        </h1>
                        <p className="text-sm font-medium text-secondary dark:text-gray-300 mt-1">
                            {book.author || 'Unknown Author'}
                        </p>

                        {/* Progress Section */}
                        <div className="mt-6 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-border/50 dark:border-gray-800">
                            <div className="flex items-center justify-between text-xs font-semibold mb-2">
                                <span className="text-primary dark:text-gray-200">Reading Progress</span>
                                <span className="text-secondary dark:text-gray-400">
                                    {hasTotalPages
                                        ? `${book.currentPage || 0} / ${book.pages} pages (${progressPercent}%)`
                                        : `${book.currentPage || 0} pages read (Unknown total)`}
                                </span>
                            </div>

                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-4">
                                <div
                                    className={`h-full rounded-full diary-progress-fill ${
                                        book.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => {
                                        startTimer({
                                            mediaType: 'book',
                                            itemId: book.id || book.coverId,
                                            itemTitle: book.title,
                                            itemCover: book.cover || '',
                                            fromPage: book.currentPage || 0,
                                            totalPages: book.pages || null,
                                        });
                                    }}
                                    className="inline-flex items-center justify-center gap-2 min-h-11 px-5 py-2.5 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                                >
                                    <BsClock className="w-3.5 h-3.5" /> {activeTimer?.mediaType === 'book' && String(activeTimer?.itemId) === String(book.id) && ['running', 'paused'].includes(activeTimer?.state) ? 'Resume Reading' : 'Start Reading'}
                                </button>
                                <button
                                    onClick={() => setIsProgressModalOpen(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-border dark:border-gray-700 text-xs font-semibold text-primary dark:text-gray-200 hover:border-primary transition-colors cursor-pointer"
                                >
                                    <BsPencilSquare className="w-3.5 h-3.5" /> Update Progress
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section Tabs */}
            <div className="flex border-b border-border dark:border-gray-800 mb-6 gap-6 text-xs font-semibold">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`pb-3 border-b-2 cursor-pointer transition-colors ${
                        activeTab === 'overview'
                            ? 'border-primary dark:border-gray-100 text-primary dark:text-gray-100'
                            : 'border-transparent text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                    }`}
                >
                    Overview
                </button>
                <button
                    onClick={() => setActiveTab('sessions')}
                    className={`pb-3 border-b-2 cursor-pointer transition-colors ${
                        activeTab === 'sessions'
                            ? 'border-primary dark:border-gray-100 text-primary dark:text-gray-100'
                            : 'border-transparent text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                    }`}
                >
                    Sessions ({displaySessions.length})
                </button>
                <button
                    onClick={() => setActiveTab('notes')}
                    className={`pb-3 border-b-2 cursor-pointer transition-colors ${
                        activeTab === 'notes'
                            ? 'border-primary dark:border-gray-100 text-primary dark:text-gray-100'
                            : 'border-transparent text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                    }`}
                >
                    Notes &amp; Quotes
                </button>
                <button
                    onClick={() => setActiveTab('attempts')}
                    className={`pb-3 border-b-2 cursor-pointer transition-colors ${
                        activeTab === 'attempts'
                            ? 'border-primary dark:border-gray-100 text-primary dark:text-gray-100'
                            : 'border-transparent text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                    }`}
                >
                    Attempts
                </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'overview' && (
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                            <p className="text-[11px] text-secondary dark:text-gray-400 uppercase tracking-wider">Started Date</p>
                            <p className="text-xs font-semibold text-primary dark:text-gray-200 mt-0.5">
                                {book.startedOn || '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] text-secondary dark:text-gray-400 uppercase tracking-wider">Finished Date</p>
                            <p className="text-xs font-semibold text-primary dark:text-gray-200 mt-0.5">
                                {book.finishedOn || '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] text-secondary dark:text-gray-400 uppercase tracking-wider">Total Pages</p>
                            <p className="text-xs font-semibold text-primary dark:text-gray-200 mt-0.5">
                                {book.pages ? `${book.pages} pages` : 'Unknown'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] text-secondary dark:text-gray-400 uppercase tracking-wider">Format / Edition</p>
                            <p className="text-xs font-semibold text-primary dark:text-gray-200 mt-0.5 truncate">
                                {book.olKey || book.isbn || 'Standard'}
                            </p>
                        </div>
                    </div>

                    {book.genres && (
                        <div className="pt-4 border-t border-border/50 dark:border-gray-800">
                            <p className="text-[11px] text-secondary dark:text-gray-400 uppercase tracking-wider mb-2">Genres &amp; Tags</p>
                            <div className="flex flex-wrap gap-1.5">
                                {(Array.isArray(book.genres) ? book.genres : [book.genres]).map((g, idx) => (
                                    <span
                                        key={idx}
                                        className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-secondary dark:text-gray-300"
                                    >
                                        {g}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'sessions' && (
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                    {loadingSessions && loadingCanonicalSessions ? (
                        <div className="py-8 text-center text-xs text-secondary">Loading sessions...</div>
                    ) : displaySessions.length === 0 ? (
                        <div className="py-12 text-center">
                            <BsClock className="w-8 h-8 text-secondary dark:text-gray-600 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-primary dark:text-gray-200">No reading sessions recorded yet</p>
                            <p className="text-[11px] text-secondary dark:text-gray-400 mt-1">
                                Use Start Reading or Update Progress to record your reading sessions.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {displaySessions.map((sess, idx) => (
                                <div
                                    key={sess.id || idx}
                                    className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-border/50 dark:border-gray-800 flex items-center justify-between text-xs"
                                >
                                    <div>
                                        <p className="font-semibold text-primary dark:text-gray-200">
                                            {sess.date || sess.startedAt?.split('T')[0] || 'Unknown Date'}
                                        </p>
                                        <p className="text-[11px] text-secondary dark:text-gray-400 mt-0.5">
                                            Pages: {sess.fromPage ?? sess.startPage ?? '—'} &rarr; {sess.toPage ?? sess.endPage ?? '—'}
                                            {sess.pagesRead ? ` (${sess.pagesRead} pages)` : ''}
                                            {sess.notes ? ` • ${sess.notes}` : ''}
                                        </p>
                                    </div>
                                    <span className="font-bold text-primary dark:text-gray-100">
                                        {Number(sess.activeSeconds) > 0 || Number(sess.minutes) > 0
                                            ? `${Math.max(1, Math.round(Number(sess.activeSeconds || 0) / 60) || Number(sess.minutes))} min`
                                            : 'Progress log'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'notes' && (
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                    {loadingNotes ? (
                        <div className="py-8 text-center text-xs text-secondary">Loading notes...</div>
                    ) : !privateNotes ? (
                        <div className="py-12 text-center">
                            <BsJournalText className="w-8 h-8 text-secondary dark:text-gray-600 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-primary dark:text-gray-200">No private notes or quotes</p>
                            <p className="text-[11px] text-secondary dark:text-gray-400 mt-1">
                                Notes written during edit or journal entries remain strictly private to your account.
                            </p>
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap text-xs text-primary dark:text-gray-200 leading-relaxed font-sans bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-border/50 dark:border-gray-800">
                            {privateNotes}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'attempts' && (
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                    <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-border/50 dark:border-gray-800 flex items-center justify-between text-xs">
                            <div>
                                <span className="font-semibold text-primary dark:text-gray-200">
                                    Attempt #1 ({book.status === 'completed' ? 'Completed' : 'Current'})
                                </span>
                                <p className="text-[11px] text-secondary dark:text-gray-400 mt-0.5">
                                    Started: {book.startedOn || 'Initial'} &bull; Completed: {book.finishedOn || 'In progress'}
                                </p>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                {book.status || 'reading'}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Update Progress Modal */}
            {isProgressModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setIsProgressModalOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-base font-bold text-primary dark:text-gray-100 mb-4">
                            Update Reading Progress
                        </h3>

                        <form onSubmit={handleSaveProgress} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Current Page {book.pages ? `(out of ${book.pages})` : ''}
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    max={book.pages || undefined}
                                    value={newCurrentPage}
                                    onChange={(e) => setNewCurrentPage(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl text-xs bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 text-primary dark:text-gray-100"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Status
                                </label>
                                <DiarySelect label="Status" value={newStatus} onChange={setNewStatus} options={[{ value: 'reading', label: 'Reading' },{ value: 'completed', label: 'Completed' },{ value: 'want-to-read', label: 'Want to Read' },{ value: 'paused', label: 'Paused' },{ value: 'dropped', label: 'Dropped' },{ value: 'rereading', label: 'Rereading' }]} />
                            </div>

                            <label className="flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-xs leading-5 text-slate-700 dark:bg-sky-900/20 dark:text-slate-200">
                                <input type="checkbox" checked={logPageActivity} onChange={e => setLogPageActivity(e.target.checked)} className="mt-1" />
                                <span><strong>Log pages as reading activity today</strong><br/>Only enable for pages genuinely read today. Leave off for corrections and imported progress. This records page activity without inventing reading minutes.</span>
                            </label>
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsProgressModalOpen(false)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-secondary hover:text-primary dark:hover:text-gray-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingProgress}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary dark:bg-gray-100 text-white dark:text-gray-900 cursor-pointer disabled:opacity-60"
                                >
                                    {savingProgress ? 'Saving...' : 'Save Progress'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DiaryShell>
    );
}

BookDetailPage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};
