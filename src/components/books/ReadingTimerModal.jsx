import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../../context/AuthContext';
import { addReadingSession, getReadingSessions } from '../../lib/db';
import {
    BsPlayFill,
    BsPauseFill,
    BsStopFill,
    BsClock,
    BsX,
    BsBookmarkCheck,
} from 'react-icons/bs';

const TIMER_STORAGE_KEY = 'active_reading_timer';

const ReadingTimerContent = ({ book, onClose, onSessionSaved }) => {
    const { user } = useAuth();

    // Initialize timer state from localStorage synchronously if matching
    const [timerState] = useState(() => {
        try {
            const saved = localStorage.getItem(TIMER_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.bookId === book.id) {
                    const acc = Number(parsed.accumulatedSeconds) || 0;
                    const wasRunning = Boolean(parsed.isRunning && parsed.lastResumedAt);
                    let currentElapsed = acc;
                    let lastResumed = null;

                    if (wasRunning) {
                        const diff = Math.floor((Date.now() - parsed.lastResumedAt) / 1000);
                        currentElapsed = acc + Math.max(0, diff);
                        lastResumed = parsed.lastResumedAt;
                    } else if (!parsed.accumulatedSeconds && parsed.startedAt) {
                        // Fallback migration for legacy format
                        const diff = Math.floor((Date.now() - new Date(parsed.startedAt).getTime()) / 1000);
                        currentElapsed = Math.max(0, diff);
                        lastResumed = Date.now();
                    }

                    return {
                        startedAt: parsed.startedAt || new Date().toISOString(),
                        fromPage: parsed.fromPage ?? (book.currentPage || 0),
                        accumulatedSeconds: acc,
                        lastResumedAt: wasRunning ? lastResumed : null,
                        elapsedSeconds: Math.max(0, currentElapsed),
                        isRunning: wasRunning,
                    };
                }
            }
        } catch (e) {
            console.error('Error reading saved timer:', e);
        }
        return {
            startedAt: null,
            fromPage: book.currentPage || 0,
            accumulatedSeconds: 0,
            lastResumedAt: null,
            elapsedSeconds: 0,
            isRunning: false,
        };
    });

    const [isRunning, setIsRunning] = useState(timerState.isRunning);
    const [startedAt, setStartedAt] = useState(timerState.startedAt);
    const [accumulatedSeconds, setAccumulatedSeconds] = useState(timerState.accumulatedSeconds);
    const [lastResumedAt, setLastResumedAt] = useState(timerState.lastResumedAt);
    const [elapsedSeconds, setElapsedSeconds] = useState(timerState.elapsedSeconds);
    const [fromPage, setFromPage] = useState(timerState.fromPage);
    const [toPage, setToPage] = useState(book.currentPage || 0);
    const [customMinutes, setCustomMinutes] = useState(0);
    const [saving, setSaving] = useState(false);
    const [showFinishForm, setShowFinishForm] = useState(false);

    // Sessions history
    const [recentSessions, setRecentSessions] = useState([]);
    const [loadingSessions, setLoadingSessions] = useState(Boolean(user));

    useEffect(() => {
        if (!user) return;
        getReadingSessions(user.uid, book.id)
            .then(setRecentSessions)
            .catch(console.error)
            .finally(() => setLoadingSessions(false));
    }, [user, book.id]);

    // Interval counter avoiding drift
    useEffect(() => {
        let interval = null;
        if (isRunning && lastResumedAt) {
            interval = setInterval(() => {
                const elapsed = accumulatedSeconds + Math.floor((Date.now() - lastResumedAt) / 1000);
                setElapsedSeconds(Math.max(0, elapsed));
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRunning, lastResumedAt, accumulatedSeconds]);

    const startTimer = () => {
        const nowIso = new Date().toISOString();
        const nowMs = Date.now();
        const cur = book.currentPage || 0;
        setStartedAt(nowIso);
        setAccumulatedSeconds(0);
        setLastResumedAt(nowMs);
        setElapsedSeconds(0);
        setFromPage(cur);
        setToPage(cur);
        setIsRunning(true);
        setShowFinishForm(false);

        try {
            localStorage.setItem(
                TIMER_STORAGE_KEY,
                JSON.stringify({
                    bookId: book.id,
                    bookTitle: book.title,
                    startedAt: nowIso,
                    fromPage: cur,
                    accumulatedSeconds: 0,
                    lastResumedAt: nowMs,
                    isRunning: true,
                })
            );
        } catch (e) {
            console.error('Failed to persist timer:', e);
        }
    };

    const pauseTimer = () => {
        const diff = lastResumedAt ? Math.floor((Date.now() - lastResumedAt) / 1000) : 0;
        const newAccumulated = accumulatedSeconds + Math.max(0, diff);

        setAccumulatedSeconds(newAccumulated);
        setLastResumedAt(null);
        setIsRunning(false);
        setElapsedSeconds(newAccumulated);

        try {
            localStorage.setItem(
                TIMER_STORAGE_KEY,
                JSON.stringify({
                    bookId: book.id,
                    bookTitle: book.title,
                    startedAt,
                    fromPage,
                    accumulatedSeconds: newAccumulated,
                    lastResumedAt: null,
                    isRunning: false,
                })
            );
        } catch (e) {
            console.error('Failed to persist timer pause:', e);
        }
    };

    const resumeTimer = () => {
        const nowMs = Date.now();
        setLastResumedAt(nowMs);
        setIsRunning(true);

        try {
            localStorage.setItem(
                TIMER_STORAGE_KEY,
                JSON.stringify({
                    bookId: book.id,
                    bookTitle: book.title,
                    startedAt,
                    fromPage,
                    accumulatedSeconds,
                    lastResumedAt: nowMs,
                    isRunning: true,
                })
            );
        } catch (e) {
            console.error('Failed to persist timer resume:', e);
        }
    };

    const openFinishForm = () => {
        let finalSecs = elapsedSeconds;
        if (isRunning && lastResumedAt) {
            const diff = Math.floor((Date.now() - lastResumedAt) / 1000);
            finalSecs = accumulatedSeconds + Math.max(0, diff);
            setAccumulatedSeconds(finalSecs);
            setElapsedSeconds(finalSecs);
            setLastResumedAt(null);
            setIsRunning(false);

            try {
                localStorage.setItem(
                    TIMER_STORAGE_KEY,
                    JSON.stringify({
                        bookId: book.id,
                        bookTitle: book.title,
                        startedAt,
                        fromPage,
                        accumulatedSeconds: finalSecs,
                        lastResumedAt: null,
                        isRunning: false,
                    })
                );
            } catch (e) {
                console.error(e);
            }
        }
        const mins = Math.max(1, Math.round(finalSecs / 60));
        setCustomMinutes(mins);
        setShowFinishForm(true);
    };

    const handleSaveSession = async (e) => {
        e.preventDefault();
        if (!user) return;
        setSaving(true);

        try {
            const finalToPage = Number(toPage) || fromPage;
            const finalFromPage = Number(fromPage) || 0;
            const minutes = Number(customMinutes) || 1;
            const totalPages = book.pages || 0;
            const isFinished = totalPages > 0 && finalToPage >= totalPages;

            await addReadingSession(user.uid, book.id, {
                startedAt: startedAt || new Date().toISOString(),
                minutes,
                fromPage: finalFromPage,
                toPage: finalToPage,
                totalPages,
                status: isFinished ? 'completed' : book.status,
            });

            // Clear timer storage
            localStorage.removeItem(TIMER_STORAGE_KEY);
            setIsRunning(false);
            setStartedAt(null);
            setAccumulatedSeconds(0);
            setLastResumedAt(null);
            setElapsedSeconds(0);
            setShowFinishForm(false);

            if (onSessionSaved) {
                onSessionSaved();
            }
            onClose();
        } catch (err) {
            console.error('Failed to save reading session:', err);
            alert('Failed to save session: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const cancelSession = () => {
        if (window.confirm('Discard current reading timer session?')) {
            localStorage.removeItem(TIMER_STORAGE_KEY);
            setIsRunning(false);
            setStartedAt(null);
            setAccumulatedSeconds(0);
            setLastResumedAt(null);
            setElapsedSeconds(0);
            setShowFinishForm(false);
        }
    };

    // Format HH:MM:SS
    const formatTime = (secs) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) {
            return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        }
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const pagesRead = Math.max(0, (Number(toPage) || 0) - (Number(fromPage) || 0));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-primary/10 dark:bg-gray-800 flex items-center justify-center text-primary dark:text-gray-100">
                            <BsClock className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-display font-bold text-primary dark:text-gray-100">
                                Reading Timer
                            </h2>
                            <p className="text-xs text-secondary dark:text-gray-400 truncate max-w-[260px]">
                                {book.title}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 transition-colors"
                        aria-label="Close"
                    >
                        <BsX className="w-6 h-6" />
                    </button>
                </div>

                {/* Main Timer Display */}
                {!showFinishForm ? (
                    <div className="my-6 text-center">
                        <div className="inline-block py-6 px-10 rounded-3xl bg-gray-50 dark:bg-gray-950/60 border border-border dark:border-gray-800 mb-6 shadow-inner">
                            <div className="text-5xl font-mono font-bold tracking-tight text-primary dark:text-gray-100">
                                {formatTime(elapsedSeconds)}
                            </div>
                            <p className="text-xs text-secondary dark:text-gray-400 mt-2 font-medium">
                                {isRunning ? 'Timer running in background...' : elapsedSeconds > 0 ? 'Paused' : 'Ready to start'}
                            </p>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-center gap-3">
                            {!startedAt ? (
                                <button
                                    onClick={startTimer}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 font-semibold text-sm hover:opacity-95 shadow-md transition-all cursor-pointer"
                                >
                                    <BsPlayFill className="w-5 h-5" />
                                    Start Reading
                                </button>
                            ) : (
                                <>
                                    {isRunning ? (
                                        <button
                                            onClick={pauseTimer}
                                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-800 text-secondary dark:text-gray-200 font-medium text-xs hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                        >
                                            <BsPauseFill className="w-4 h-4" />
                                            Pause
                                        </button>
                                    ) : (
                                        <button
                                            onClick={resumeTimer}
                                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-green-600 text-white font-medium text-xs hover:bg-green-700 transition-colors cursor-pointer"
                                        >
                                            <BsPlayFill className="w-4 h-4" />
                                            Resume
                                        </button>
                                    )}

                                    <button
                                        onClick={openFinishForm}
                                        className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 font-semibold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                                    >
                                        <BsBookmarkCheck className="w-4 h-4" />
                                        Log Session
                                    </button>

                                    <button
                                        onClick={cancelSession}
                                        className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                                        title="Discard"
                                    >
                                        <BsStopFill className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Book Progress snippet */}
                        <div className="mt-6 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-border dark:border-gray-800 text-xs flex items-center justify-between text-secondary dark:text-gray-400">
                            <span>Current bookmark:</span>
                            <span className="font-semibold text-primary dark:text-gray-200">
                                Page {book.currentPage || 0} of {book.pages || '?'} ({book.progress || 0}%)
                            </span>
                        </div>
                    </div>
                ) : (
                    /* Finish Form */
                    <form onSubmit={handleSaveSession} className="space-y-4 my-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl text-blue-700 dark:text-blue-300 text-xs">
                            Session recorded! Verify pages read and confirm to update your reading progress.
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Minutes Read
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={customMinutes}
                                    onChange={(e) => setCustomMinutes(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-xl text-xs text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    From Page
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={fromPage}
                                    onChange={(e) => setFromPage(e.target.value)}
                                    required
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-xl text-xs text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400">
                                    To Page (Current: {book.currentPage || 0})
                                </label>
                                <div className="flex gap-1">
                                    {[5, 10, 20, 50].map((inc) => (
                                        <button
                                            key={inc}
                                            type="button"
                                            onClick={() => setToPage((prev) => (Number(prev) || 0) + inc)}
                                            className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-800 text-secondary dark:text-gray-300 hover:text-primary transition-colors"
                                        >
                                            +{inc}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <input
                                type="number"
                                min={fromPage}
                                max={book.pages ? book.pages : undefined}
                                value={toPage}
                                onChange={(e) => setToPage(e.target.value)}
                                required
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-xl text-xs text-primary dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>

                        <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-border dark:border-gray-800 text-xs flex items-center justify-between text-secondary dark:text-gray-400">
                            <span>Pages Read in this Session:</span>
                            <span className="font-bold text-primary dark:text-gray-100 text-sm">
                                +{pagesRead} pages
                            </span>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowFinishForm(false)}
                                className="px-4 py-2 rounded-xl text-xs text-secondary dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                Back to Timer
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 font-semibold text-xs hover:opacity-90 transition-opacity"
                            >
                                {saving ? 'Saving...' : 'Save & Update Progress'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Recent Sessions List */}
                <div className="mt-8 pt-4 border-t border-border dark:border-gray-800">
                    <h3 className="text-xs font-semibold text-secondary dark:text-gray-400 uppercase tracking-wider mb-3">
                        Recent Reading Sessions
                    </h3>

                    {loadingSessions ? (
                        <div className="text-center py-4 text-xs text-secondary dark:text-gray-500">
                            Loading sessions...
                        </div>
                    ) : recentSessions.length === 0 ? (
                        <p className="text-xs text-secondary dark:text-gray-500 italic">
                            No reading sessions logged yet for this book.
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                            {recentSessions.slice(0, 5).map((s) => (
                                <div
                                    key={s.id}
                                    className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-border/50 dark:border-gray-800 flex items-center justify-between text-xs"
                                >
                                    <div>
                                        <p className="font-medium text-primary dark:text-gray-200">
                                            {s.minutes} min &middot; {s.pagesRead} pages (p. {s.fromPage} &rarr; {s.toPage})
                                        </p>
                                        <p className="text-[10px] text-secondary dark:text-gray-500">
                                            {s.startedAt ? new Date(s.startedAt).toLocaleDateString() : 'Recent'}
                                        </p>
                                    </div>
                                    <span className="text-green-600 dark:text-green-400 text-xs font-semibold">
                                        +{s.pagesRead} p
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

ReadingTimerContent.propTypes = {
    book: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    onSessionSaved: PropTypes.func,
};

const ReadingTimerModal = ({ book, isOpen, onClose, onSessionSaved }) => {
    if (!isOpen || !book) return null;
    return (
        <ReadingTimerContent
            key={book.id}
            book={book}
            onClose={onClose}
            onSessionSaved={onSessionSaved}
        />
    );
};

ReadingTimerModal.propTypes = {
    book: PropTypes.object,
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSessionSaved: PropTypes.func,
};

export default ReadingTimerModal;
