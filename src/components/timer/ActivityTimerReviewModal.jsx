import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useTimer } from '../../context/TimerContext';
import { getCurrentLocalDateKey } from '../../domain/dates';
import { formatClock } from '../../hooks/useElapsedDisplay';
import {
    BsBook, BsController, BsCheck2, BsArrowLeft, BsTrash3,
    BsArrowCounterclockwise, BsExclamationTriangle, BsKeyboard, BsPlus, BsDash,
} from 'react-icons/bs';

function getStoredDraft(timer) {
    try {
        const stored = JSON.parse(sessionStorage.getItem(`diary-session-draft-${timer.sessionId}`) || 'null');
        return stored && stored.timerId === timer.timerId ? stored : null;
    } catch { return null; }
}

function ReviewForm({ activeTimer, cancelReview, saveSession, discardTimer }) {
    const isBook = activeTimer.mediaType === 'book';
    const isSaving = activeTimer.state === 'saving';
    const duration = Math.max(0, Math.floor((Number(activeTimer.accumulatedActiveMs) || 0) / 1000));
    const originalPage = Math.max(0, Number(activeTimer.fromPage) || 0);
    const totalPages = Number(activeTimer.totalPages) > 0 ? Number(activeTimer.totalPages) : null;
    const draft = getStoredDraft(activeTimer);
    const [startPage, setStartPage] = useState(draft?.startPage ?? originalPage);
    const [endPage, setEndPage] = useState(draft?.endPage ?? originalPage);
    const [notes, setNotes] = useState(draft?.notes ?? '');
    const [keyboardMode, setKeyboardMode] = useState(false);
    const [errorMsg, setErrorMsg] = useState(activeTimer.saveError || '');
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const start = Number(startPage);
    const end = Number(endPage);
    const validRange = Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end >= start && (totalPages === null || end <= totalPages);
    const pagesRead = validRange ? end - start : 0;

    const persistDraft = (next) => {
        try {
            sessionStorage.setItem(`diary-session-draft-${activeTimer.sessionId}`, JSON.stringify({
                timerId: activeTimer.timerId,
                startPage: next.startPage ?? startPage,
                endPage: next.endPage ?? endPage,
                notes: next.notes ?? notes,
            }));
        } catch { /* WebView private mode may block session storage. */ }
    };
    const changeStart = (value) => { setStartPage(value); persistDraft({ startPage: value }); };
    const changeEnd = (value) => { setEndPage(value); persistDraft({ endPage: value }); };
    const changeNotes = (value) => { setNotes(value); persistDraft({ notes: value }); };
    const adjustEnd = (step) => changeEnd(Math.max(start, Math.min(totalPages ?? Number.MAX_SAFE_INTEGER, (Number(endPage) || 0) + step)));

    const handleSave = async (event) => {
        event.preventDefault();
        if (isSaving) return;
        if (isBook && !validRange) {
            setErrorMsg(totalPages === null ? 'Enter a valid page range.' : `Pages must be between ${start} and ${totalPages}.`);
            return;
        }
        setErrorMsg('');
        try {
            const result = await saveSession({
                startPage: start,
                endPage: end,
                notes,
                date: getCurrentLocalDateKey(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila',
            });
            if (result?.success) sessionStorage.removeItem(`diary-session-draft-${activeTimer.sessionId}`);
        } catch (err) {
            setErrorMsg(err?.message || 'Session could not be saved. Your draft is still here.');
        }
    };

    return (
        <section role="dialog" aria-modal="true" aria-labelledby="session-review-title"
            className="diary-review-entrance fixed inset-0 z-[70] bg-[#f8f0e5] dark:bg-[#111827] text-[#433d36] dark:text-gray-100 overflow-y-auto"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="min-h-full max-w-xl mx-auto flex flex-col px-5 pt-5 pb-5">
                <div className="flex items-center justify-between gap-3">
                    <button type="button" disabled={isSaving} onClick={cancelReview} aria-label="Back to timer" className="min-w-11 min-h-11 rounded-xl flex items-center gap-2 text-sm font-semibold disabled:opacity-50"><BsArrowLeft /> Back</button>
                    <button form="diary-save-session-form" type="submit" disabled={isSaving || (isBook && !validRange)} className="min-h-11 rounded-full bg-white/80 dark:bg-slate-800 px-4 text-sm font-bold flex items-center gap-2 disabled:opacity-50"><BsCheck2 /> Save</button>
                </div>
                <h1 id="session-review-title" className="font-display text-2xl sm:text-3xl font-bold mt-9">Save {isBook ? 'reading' : 'gaming'} session</h1>
                <p className="text-sm text-[#82796f] dark:text-slate-400 mt-2">Check your activity before adding it to your diary.</p>
                <p className="text-xs mt-5 text-[#82796f] dark:text-slate-400">{getCurrentLocalDateKey()}</p>
                <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-2xl p-4 bg-white/80 dark:bg-slate-800"><p className="text-xs opacity-70">Active time</p><p className="text-xl font-bold text-[#407da5] dark:text-sky-300 tabular-nums mt-2">{formatClock(duration)}</p></div>
                    <div className="rounded-2xl p-4 bg-white/80 dark:bg-slate-800"><p className="text-xs opacity-70">{isBook ? 'Pages read' : 'Activity'}</p><p className="text-xl font-bold text-[#407da5] dark:text-sky-300 mt-2">{isBook ? pagesRead : 'Gaming'}</p></div>
                </div>
                <form id="diary-save-session-form" onSubmit={handleSave} className="flex-1 flex flex-col">
                    {isBook && (
                        <div className="mt-8 rounded-3xl bg-white/80 dark:bg-slate-800 p-5">
                            <h2 className="text-lg font-bold">How much did you read?</h2>
                            <p className="text-xs opacity-70 mt-1">Choose your last page to save your progress.</p>
                            <div className="flex justify-between items-center mt-4">
                                <span className="text-xs">Started at page {startPage}</span>
                                <button type="button" onClick={() => setKeyboardMode((v) => !v)} className="text-xs underline underline-offset-4 inline-flex items-center gap-1 min-h-10"><BsKeyboard /> {keyboardMode ? 'Use stepper' : 'Use keyboard'}</button>
                            </div>
                            {keyboardMode ? (
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <label className="text-xs">Start page<input aria-label="Start page" type="number" inputMode="numeric" min="0" max={totalPages ?? undefined} value={startPage} onChange={(e) => changeStart(e.target.value)} className="block w-full mt-2 py-3 px-3 text-base bg-[#f8f0e5] dark:bg-gray-900 rounded-xl" /></label>
                                    <label className="text-xs">End page<input aria-label="End page" type="number" inputMode="numeric" min={startPage} max={totalPages ?? undefined} value={endPage} onChange={(e) => changeEnd(e.target.value)} className="block w-full mt-2 py-3 px-3 text-base bg-[#f8f0e5] dark:bg-gray-900 rounded-xl" /></label>
                                </div>
                            ) : (
                                <div className="diary-page-selector mt-4 flex items-center gap-3 justify-center">
                                    <button type="button" onClick={() => adjustEnd(-1)} aria-label="One page less" className="min-w-12 min-h-12 rounded-full bg-[#e8e0d5] dark:bg-slate-700 flex items-center justify-center"><BsDash /></button>
                                    <div className="flex-1 text-center py-3 bg-[#f8f0e5] dark:bg-gray-900 rounded-2xl"><p className="text-xs opacity-60">End page</p><p className="font-display text-3xl font-bold tabular-nums">{endPage}</p>{totalPages && <p className="text-xs opacity-60">of {totalPages}</p>}</div>
                                    <button type="button" onClick={() => adjustEnd(1)} aria-label="One page more" className="min-w-12 min-h-12 rounded-full bg-[#407da5] text-white flex items-center justify-center"><BsPlus /></button>
                                </div>
                            )}
                            <div className="flex items-center justify-center gap-3 mt-4">
                                <button type="button" onClick={() => adjustEnd(-10)} className="rounded-full px-4 min-h-10 bg-[#f1e9df] dark:bg-gray-700 text-xs">−10 pages</button>
                                <button type="button" onClick={() => adjustEnd(10)} className="rounded-full px-4 min-h-10 bg-[#f1e9df] dark:bg-gray-700 text-xs">+10 pages</button>
                            </div>
                        </div>
                    )}
                    <div className="mt-5">
                        <label htmlFor="session-reflection" className="block text-xs font-semibold mb-2">{isBook ? 'Reading notes (private, optional)' : 'Gaming notes (private, optional)'}</label>
                        <textarea id="session-reflection" value={notes} onChange={(e) => changeNotes(e.target.value)} rows="3" placeholder="A thought worth remembering…" className="w-full resize-y rounded-2xl p-4 text-sm bg-white dark:bg-slate-800 border border-[#e5dacf] dark:border-gray-700" />
                    </div>
                    {errorMsg && <p className="mt-4 p-3 rounded-xl bg-red-100 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300" role="alert">{errorMsg}</p>}
                    <div className="mt-auto pt-6 space-y-3">
                        <button type="submit" disabled={isSaving || (isBook && !validRange)} className="w-full min-h-14 bg-[#407da5] hover:bg-[#346c92] text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"><BsCheck2 className="text-lg" /> {isSaving ? 'Saving session…' : 'Save session'}</button>
                        <div className="grid grid-cols-2 gap-3">
                            <button type="button" disabled={isSaving} onClick={cancelReview} className="rounded-xl min-h-11 text-sm font-semibold flex justify-center gap-2 items-center bg-white/80 dark:bg-gray-800"><BsArrowCounterclockwise /> Resume timer</button>
                            {confirmDiscard ? <button type="button" disabled={isSaving} onClick={() => { sessionStorage.removeItem(`diary-session-draft-${activeTimer.sessionId}`); discardTimer(); }} className="rounded-xl min-h-11 text-sm font-semibold bg-red-600 text-white">Confirm discard</button>
                                : <button type="button" disabled={isSaving} onClick={() => setConfirmDiscard(true)} className="rounded-xl min-h-11 text-sm font-semibold flex justify-center gap-2 items-center text-red-700 dark:text-red-300"><BsTrash3 /> Discard</button>}
                        </div>
                    </div>
                </form>
            </div>
        </section>
    );
}

ReviewForm.propTypes = {
    activeTimer: PropTypes.object.isRequired,
    cancelReview: PropTypes.func.isRequired,
    saveSession: PropTypes.func.isRequired,
    discardTimer: PropTypes.func.isRequired,
};

export default function ActivityTimerReviewModal() {
    const { activeTimer, isModalOpen, timerConflict, resolveConflict, cancelReview, saveSession, discardTimer } = useTimer();
    if (timerConflict) {
        return (
            <section role="dialog" aria-modal="true" aria-label="Active timer conflict" className="fixed inset-0 z-[90] bg-black/60 flex justify-center items-center p-4">
                <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-gray-900 shadow-2xl p-6 text-center">
                    <BsExclamationTriangle className="text-amber-500 text-3xl mx-auto mb-3" />
                    <h2 className="font-bold text-lg mb-3">A timer is already active</h2>
                    <p className="text-sm mb-6 text-gray-600 dark:text-gray-300">You have an active session for <strong>{timerConflict.current?.itemTitle}</strong>. Replacing it will discard unsaved time.</p>
                    <button type="button" onClick={() => resolveConflict('keep')} className="w-full min-h-11 rounded-xl bg-gray-100 dark:bg-gray-800 mb-3">Keep existing session</button>
                    <button type="button" onClick={() => resolveConflict('replace')} className="w-full min-h-11 rounded-xl bg-red-600 text-white">Discard it and start another</button>
                </div>
            </section>
        );
    }
    if (!activeTimer || !['review', 'saving'].includes(activeTimer.state) || !isModalOpen) return null;
    return <ReviewForm key={activeTimer.sessionId || activeTimer.timerId} activeTimer={activeTimer} cancelReview={cancelReview} saveSession={saveSession} discardTimer={discardTimer} />;
}
