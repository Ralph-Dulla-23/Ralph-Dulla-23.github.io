import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTimer } from '../../context/TimerContext';
import {
    BsClock,
    BsBook,
    BsController,
    BsCheck2Circle,
    BsX,
    BsTrash3,
    BsArrowCounterclockwise,
    BsExclamationTriangle,
} from 'react-icons/bs';

function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (hours > 0) {
        return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
    }
    return `${pad(minutes)}m ${pad(seconds)}s`;
}

function ReviewForm({ activeTimer, cancelReview, saveSession, discardTimer }) {
    const isBook = activeTimer.mediaType === 'book';
    const isSaving = activeTimer.state === 'saving';
    const totalActiveSeconds = Math.max(0, Math.floor((activeTimer.accumulatedActiveMs || 0) / 1000));

    const initialPage = Number(activeTimer.fromPage) || 0;
    const [startPage, setStartPage] = useState(initialPage);
    const [endPage, setEndPage] = useState(initialPage);
    const [notes, setNotes] = useState('');
    const [errorMsg, setErrorMsg] = useState(activeTimer.saveError || '');
    const [confirmDiscard, setConfirmDiscard] = useState(false);

    const pagesRead = Math.max(0, Number(endPage || 0) - Number(startPage || 0));

    const handleSave = async (e) => {
        e.preventDefault();
        setErrorMsg('');

        if (isBook && Number(endPage) < Number(startPage)) {
            setErrorMsg('Ending page cannot be less than starting page.');
            return;
        }

        try {
            await saveSession({
                activeSeconds: totalActiveSeconds,
                startPage: Number(startPage),
                endPage: Number(endPage),
                pagesRead,
                notes,
                date: new Date().toISOString().slice(0, 10),
                timezone: 'Asia/Manila',
            });
        } catch (err) {
            setErrorMsg(err.message || 'Failed to save session. Your review draft is preserved.');
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Activity Session Review"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        >
            <div
                className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-border/50 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-primary/10 dark:bg-emerald-950/50 text-primary dark:text-emerald-400">
                            {isBook ? <BsBook className="w-4 h-4" /> : <BsController className="w-4 h-4" />}
                        </span>
                        <div>
                            <h2 className="text-sm font-bold text-primary dark:text-gray-100">
                                Review {isBook ? 'Reading' : 'Gaming'} Session
                            </h2>
                            <p className="text-[11px] text-secondary dark:text-gray-400">
                                Monotonically tracked duration (pauses excluded)
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={cancelReview}
                        disabled={isSaving}
                        className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-secondary dark:text-gray-400 cursor-pointer transition-colors"
                        aria-label="Close and resume later"
                        title="Resume / Keep timer"
                    >
                        <BsX className="w-5 h-5" />
                    </button>
                </div>

                {/* Item Thumbnail & Measured Duration */}
                <div className="mt-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-border/40 dark:border-gray-800 flex items-center gap-3">
                    <div className="w-12 h-16 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden shrink-0 flex items-center justify-center">
                        {activeTimer.itemCover ? (
                            <img src={activeTimer.itemCover} alt={activeTimer.itemTitle} className="w-full h-full object-cover" />
                        ) : (
                            <BsClock className="w-5 h-5 text-gray-400" />
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-primary dark:text-gray-100 truncate">
                            {activeTimer.itemTitle}
                        </p>
                        <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-lg font-mono font-extrabold text-primary dark:text-emerald-400">
                                {formatDuration(totalActiveSeconds)}
                            </span>
                            <span className="text-[10px] uppercase font-semibold text-secondary dark:text-gray-400">
                                Active Time
                            </span>
                        </div>
                    </div>
                </div>

                {/* Form Inputs */}
                <form onSubmit={handleSave} className="mt-4 flex flex-col gap-4">
                    {isBook && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-300 mb-1">
                                    Start Page
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={startPage}
                                    onChange={(e) => setStartPage(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-300 mb-1">
                                    End Page
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    value={endPage}
                                    onChange={(e) => setEndPage(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div className="col-span-2 text-right">
                                <span className="text-xs font-semibold text-secondary dark:text-gray-400">
                                    Pages Read: <strong className="text-primary dark:text-emerald-400">{pagesRead}</strong>
                                </span>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-medium text-secondary dark:text-gray-300 mb-1">
                            {isBook ? 'Reflection / Reading Notes (Private)' : 'Session Notes / Milestone (Private)'}
                        </label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder={isBook ? 'Thoughts, favorite lines, key takeaways...' : 'Boss defeated, chapter completed, reflections...'}
                            className="w-full px-3 py-2 rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-primary dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                    </div>

                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-600 dark:text-red-400">
                            {errorMsg}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="mt-2 flex flex-col gap-2">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full py-3 rounded-xl bg-primary dark:bg-emerald-500 text-white dark:text-gray-950 text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                        >
                            <BsCheck2Circle className="w-4 h-4" />
                            <span>{isSaving ? 'Saving Session...' : 'Save Session to Diary'}</span>
                        </button>

                        <div className="flex items-center justify-between gap-2 pt-2">
                            <button
                                type="button"
                                onClick={cancelReview}
                                disabled={isSaving}
                                className="flex-1 py-2 rounded-xl border border-border dark:border-gray-700 text-secondary dark:text-gray-300 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <BsArrowCounterclockwise className="w-3.5 h-3.5" />
                                <span>Resume Timer</span>
                            </button>

                            {confirmDiscard ? (
                                <button
                                    type="button"
                                    onClick={discardTimer}
                                    disabled={isSaving}
                                    className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <span>Confirm Discard</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setConfirmDiscard(true)}
                                    disabled={isSaving}
                                    className="flex-1 py-2 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <BsTrash3 className="w-3.5 h-3.5" />
                                    <span>Discard</span>
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}

ReviewForm.propTypes = {
    activeTimer: PropTypes.shape({
        timerId: PropTypes.string,
        sessionId: PropTypes.string,
        mediaType: PropTypes.string,
        state: PropTypes.string,
        accumulatedActiveMs: PropTypes.number,
        fromPage: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
        itemCover: PropTypes.string,
        itemTitle: PropTypes.string,
        saveError: PropTypes.string,
    }).isRequired,
    cancelReview: PropTypes.func.isRequired,
    saveSession: PropTypes.func.isRequired,
    discardTimer: PropTypes.func.isRequired,
};

export default function ActivityTimerReviewModal() {
    const {
        activeTimer,
        isModalOpen,
        timerConflict,
        resolveConflict,
        cancelReview,
        saveSession,
        discardTimer,
    } = useTimer();

    // Handle conflict dialog if another timer is triggered while one is active
    if (timerConflict) {
        return (
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Timer Conflict Warning"
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            >
                <div className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl p-6 border border-amber-300 dark:border-amber-700/50 shadow-2xl animate-scale-up text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                        <BsExclamationTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold text-primary dark:text-gray-100">
                        Timer Already Active
                    </h3>
                    <p className="text-xs text-secondary dark:text-gray-300 mt-2">
                        A timer is already active for <strong className="text-primary dark:text-gray-100">{timerConflict.current?.itemTitle}</strong>.
                        Would you like to keep the active timer or replace it?
                    </p>
                    <div className="mt-6 flex flex-col gap-2">
                        <button
                            onClick={() => resolveConflict('keep')}
                            className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-primary dark:text-gray-200 text-xs font-semibold hover:bg-gray-200 cursor-pointer"
                        >
                            Keep Active Timer
                        </button>
                        <button
                            onClick={() => resolveConflict('replace')}
                            className="w-full py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                        >
                            Replace and Start New Timer
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!activeTimer || (activeTimer.state !== 'review' && activeTimer.state !== 'saving') || !isModalOpen) {
        return null;
    }

    return (
        <ReviewForm
            key={activeTimer.timerId || activeTimer.sessionId || 'review-form'}
            activeTimer={activeTimer}
            cancelReview={cancelReview}
            saveSession={saveSession}
            discardTimer={discardTimer}
        />
    );
}
