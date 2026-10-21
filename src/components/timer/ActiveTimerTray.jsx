import React from 'react';
import { useElapsedDisplay } from '../../hooks/useElapsedDisplay';
import { useTimer } from '../../context/TimerContext';
import {
    BsPlayFill,
    BsPauseFill,
    BsCheck2Circle,
    BsBook,
    BsController,
} from 'react-icons/bs';

function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;

    const pad = (n) => String(n).padStart(2, '0');
    if (hours > 0) {
        return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
}

export default function ActiveTimerTray() {
    const { activeTimer, pauseTimer, resumeTimer, openReview, focusVisible, showFocus } = useTimer();
    const elapsed = useElapsedDisplay(activeTimer, !focusVisible);

    if (!activeTimer || (activeTimer.state !== 'running' && activeTimer.state !== 'paused')) {
        return null;
    }

    const isRunning = activeTimer.state === 'running';
    const isBook = activeTimer.mediaType === 'book';

    return (
        <aside
            data-active-timer-tray
            inert={focusVisible}
            aria-hidden={focusVisible}
            role="region"
            aria-label="Active activity timer mini tray"
            className={`fixed bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-40 bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-3 shadow-xl flex items-center justify-between gap-3 diary-mini-timer ${focusVisible ? 'pointer-events-none' : ''}`}
        >
            <span className="sr-only" aria-live="polite">
                {isRunning ? 'Timer running' : 'Timer paused'}
            </span>
            {/* Left: Thumbnail & Item Info */}
            <button type="button" className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl diary-press"
                aria-label={`Expand ${isBook ? 'reading' : 'gaming'} timer for ${activeTimer.itemTitle}`}
                onClick={(event) => {
                    const bounds = event.currentTarget.closest('[data-active-timer-tray]')?.getBoundingClientRect();
                    showFocus(bounds ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 } : null);
                }}>
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 border border-border/40 dark:border-gray-800 flex items-center justify-center">
                    {activeTimer.itemCover ? (
                        <img
                            src={activeTimer.itemCover}
                            alt={activeTimer.itemTitle}
                            loading="lazy" decoding="async" width="40" height="40"
                            className="w-full h-full object-cover"
                        />
                    ) : isBook ? (
                        <BsBook className="w-5 h-5 text-secondary dark:text-gray-500" />
                    ) : (
                        <BsController className="w-5 h-5 text-secondary dark:text-gray-500" />
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-primary dark:text-gray-100 truncate">
                        {activeTimer.itemTitle}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${isRunning ? 'bg-green-500' : 'bg-amber-400'}`} />
                        <span className="text-xs font-mono font-semibold text-secondary dark:text-gray-300">
                            {formatDuration(elapsed)}
                        </span>
                    </div>
                </div>
            </button>

            {/* Right: Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
                <button
                    onClick={isRunning ? pauseTimer : resumeTimer}
                    className={`diary-press w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                        isRunning
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 hover:bg-amber-100'
                            : 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 hover:bg-green-100'
                    }`}
                    title={isRunning ? 'Pause timer' : 'Resume timer'}
                    aria-label={isRunning ? 'Pause timer' : 'Resume timer'}
                >
                    {isRunning ? <BsPauseFill className="w-5 h-5" /> : <BsPlayFill className="w-5 h-5 ml-0.5" />}
                </button>

                <button
                    onClick={openReview}
                    className="diary-press h-10 px-3 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                    title="Review and save session"
                    aria-label="Review and save session"
                >
                    <BsCheck2Circle className="w-4 h-4" />
                    <span>Finish</span>
                </button>
            </div>
        </aside>
    );
}
