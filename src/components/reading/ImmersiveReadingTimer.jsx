import React, { useEffect, useState } from 'react';
import { BsArrowLeft, BsBook, BsController, BsCheck2, BsPauseFill, BsPlayFill, BsStopwatch } from 'react-icons/bs';
import { useTimer } from '../../context/TimerContext';
import { useElapsedDisplay, formatClock } from '../../hooks/useElapsedDisplay';
import { useCircularReveal } from '../motion/useCircularReveal';

function FocusContents({ activeTimer }) {
    const { focusVisible, focusOrigin, minimizeFocus, pauseTimer, resumeTimer, openReview } = useTimer();
    const { surfaceRef, closeWithReveal } = useCircularReveal(focusOrigin, minimizeFocus);
    const isBook = activeTimer.mediaType === 'book';
    const elapsed = useElapsedDisplay(activeTimer);
    const [goalMinutes, setGoalMinutes] = useState(0);
    const [editingGoal, setEditingGoal] = useState(false);
    const isRunning = activeTimer.state === 'running';
    const goalReached = goalMinutes > 0 && elapsed >= goalMinutes * 60;
    const goalProgress = goalMinutes > 0 ? Math.min(1, elapsed / (goalMinutes * 60)) : 0;

    useEffect(() => {
        if (!focusVisible) return undefined;
        const keyHandler = (e) => {
            if (e.key === 'Escape') { e.preventDefault(); closeWithReveal(); }
        };
        window.addEventListener('keydown', keyHandler);
        return () => window.removeEventListener('keydown', keyHandler);
    }, [focusVisible, closeWithReveal]);

    if (!focusVisible) return null;
    return (
        <section ref={surfaceRef} role="dialog" aria-modal="true" aria-label={isBook ? "Focused reading timer" : "Focused gaming timer"}
            className="diary-timer-focus fixed inset-0 z-[60] flex flex-col bg-[#f8f0e5] text-[#443e38] dark:bg-[#141c2b] dark:text-slate-100"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="flex items-center justify-between px-5 pt-4 max-w-xl w-full mx-auto">
                <button type="button" onClick={closeWithReveal} className="diary-press min-w-11 min-h-11 flex items-center gap-2 text-sm font-semibold rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors" aria-label={`Minimize ${isBook ? "reading" : "gaming"} timer`}><BsArrowLeft /> Back</button>
                <button type="button" onClick={openReview} className="diary-press min-w-11 min-h-11 px-4 flex items-center gap-2 bg-white/70 dark:bg-white/10 rounded-full text-sm font-semibold hover:bg-white transition-colors"><BsCheck2 className="text-lg" /> Done</button>
            </div>
            <div className="flex-1 min-h-0 flex flex-col justify-center items-center gap-5 px-5 diary-focus-content">
                <p className="uppercase tracking-[0.24em] text-[11px] font-bold text-[#877969] dark:text-slate-400">{isBook ? 'My reading time' : 'My gaming time'}</p>
                <div className="font-display text-[clamp(3rem,14vw,5.25rem)] tracking-tight font-bold tabular-nums text-[#40769a] dark:text-sky-300" aria-label={`${elapsed} seconds of active ${isBook ? 'reading' : 'gaming'}`}>
                    {formatClock(elapsed)}
                </div>
                <p role="status" className="text-sm text-[#877969] dark:text-slate-400">{isRunning ? (isBook ? 'Reading in progress' : 'Gaming in progress') : 'Paused'}</p>
                <div className="relative w-[132px] h-[132px] flex items-center justify-center">
                    {isBook && goalMinutes > 0 && (
                        <svg aria-hidden="true" className="absolute inset-0 -rotate-90 pointer-events-none" width="132" height="132" viewBox="0 0 132 132">
                            <circle cx="66" cy="66" r="61" fill="none" stroke="currentColor" strokeOpacity="0.16" strokeWidth="4" />
                            <circle className="diary-countdown-ring" cx="66" cy="66" r="61" fill="none" stroke="#407da5" strokeWidth="4" strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 61} strokeDashoffset={(2 * Math.PI * 61) * (1 - goalProgress)} />
                        </svg>
                    )}
                    <button type="button" onClick={isRunning ? pauseTimer : resumeTimer}
                        aria-label={isRunning ? `Pause ${isBook ? 'reading' : 'gaming'} timer` : `Resume ${isBook ? 'reading' : 'gaming'} timer`}
                        className="diary-timer-control diary-press w-[104px] h-[104px] rounded-full bg-[#407da5] text-white flex items-center justify-center shadow-[0_0_0_9px_rgba(64,125,165,0.14)] active:scale-95 transition-transform focus-visible:outline-2 focus-visible:outline-offset-4">
                        {isRunning ? <BsPauseFill key="pause" className="diary-control-icon w-10 h-10" /> : <BsPlayFill key="play" className="diary-control-icon w-10 h-10 ml-1" />}
                    </button>
                </div>
                {isBook && goalReached && <p className="text-sm font-semibold text-[#40769a] dark:text-sky-300">Your reading goal is reached!</p>}
                {!isBook ? null : !editingGoal ? (
                    <button type="button" onClick={() => setEditingGoal(true)} className="text-xs rounded-full border border-[#cbbfb0] dark:border-slate-600 px-4 py-2.5 flex items-center gap-2"><BsStopwatch /> {goalMinutes ? `${goalMinutes}-minute goal` : 'Set a time goal'}</button>
                ) : (
                    <div className="flex gap-2 items-center text-xs">
                        <label htmlFor="reading-time-goal">Minutes</label>
                        <input id="reading-time-goal" type="number" min="0" max="1440" inputMode="numeric" value={goalMinutes} onChange={(e) => setGoalMinutes(Math.max(0, Math.min(1440, Number(e.target.value) || 0)))} className="w-20 rounded-xl bg-white dark:bg-slate-800 px-3 py-2 text-sm" />
                        <button type="button" onClick={() => setEditingGoal(false)} className="bg-[#407da5] text-white px-3 py-2 rounded-xl">Set</button>
                    </div>
                )}
            </div>
            <div className="max-w-xl w-full mx-auto px-5 pb-5">
                <div className="rounded-3xl border border-[#d8cdbf] dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 p-3 flex items-center gap-4">
                    <div className="w-14 h-20 shrink-0 bg-[#ebe3d9] dark:bg-slate-700 rounded-xl overflow-hidden flex items-center justify-center">
                        {activeTimer.itemCover ? <img src={activeTimer.itemCover} alt={`${isBook ? "Book" : "Game"} cover`} width="56" height="80" decoding="async" className="w-full h-full object-cover" /> : isBook ? <BsBook className="text-2xl" /> : <BsController className="text-2xl" />}
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[11px] uppercase tracking-widest text-[#82766a] dark:text-slate-400">{isBook ? "Currently reading" : "Currently playing"}</p>
                        <p className="text-sm font-bold truncate mt-1">{activeTimer.itemTitle}</p>
                        {isBook && <p className="text-xs text-[#82766a] dark:text-slate-400 mt-1">Page {activeTimer.fromPage ?? 0}{activeTimer.totalPages ? ` / ${activeTimer.totalPages}` : ''}</p>}
                    </div>
                    <button type="button" onClick={openReview} className="rounded-xl bg-[#407da5] text-white text-xs font-bold px-4 py-3">Finish</button>
                </div>
            </div>
        </section>
    );
}

export default function ImmersiveReadingTimer() {
    const { activeTimer, focusVisible } = useTimer();
    if (!focusVisible || !activeTimer || !['running', 'paused'].includes(activeTimer.state)) return null;
    return <FocusContents key={activeTimer.timerId} activeTimer={activeTimer} />;
}
