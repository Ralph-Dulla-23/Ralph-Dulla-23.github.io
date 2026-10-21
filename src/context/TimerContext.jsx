import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { generateId } from '../domain/id';
import { useAuth } from './AuthContext';
import { getDiaryRepository, updateBookProgress } from '../lib/db';
import { getCurrentLocalDateKey } from '../domain/dates';

const TIMER_STORAGE_KEY = 'canonical_active_activity_timer';
const LEGACY_STORAGE_KEY = 'active_reading_timer';

const TimerContext = createContext(null);

export function ActivityTimerProvider({ children }) {
    const { user } = useAuth();

    const [activeTimer, setActiveTimer] = useState(() => {
        try {
            if (typeof window === 'undefined') return null;
            const saved = localStorage.getItem(TIMER_STORAGE_KEY);
            if (saved) {
                const previous = JSON.parse(saved);
                return previous?.state === 'saving' ? { ...previous, state: 'review' } : previous;
            }
            // Check legacy storage
            const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
            if (legacy) {
                const parsed = JSON.parse(legacy);
                const wasRunning = Boolean(parsed.isRunning && parsed.lastResumedAt);
                return {
                    timerId: `legacy-${parsed.bookId || Date.now()}`,
                    sessionId: generateId('sess'),
                    mediaType: 'book',
                    itemId: String(parsed.bookId || 'legacy-book'),
                    itemTitle: parsed.bookTitle || 'Reading Session',
                    itemCover: parsed.bookCover || '',
                    state: wasRunning ? 'running' : 'paused',
                    startedAtISO: parsed.startedAt || new Date().toISOString(),
                    accumulatedActiveMs: (Number(parsed.accumulatedSeconds) || 0) * 1000,
                    runningSinceEpochMs: wasRunning ? Number(parsed.lastResumedAt) : null,
                    fromPage: Number(parsed.fromPage) || 0,
                    updatedAtISO: new Date().toISOString(),
                };
            }
        } catch (e) {
            console.error('Error hydrating timer from storage:', e);
        }
        return null;
    });

    const [isModalOpen, setIsModalOpen] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY) || 'null');
            return saved?.state === 'review' || saved?.state === 'saving';
        } catch { return false; }
    });
    const [timerConflict, setTimerConflict] = useState(null);
    const [focusVisible, setFocusVisible] = useState(false);
    const [focusOrigin, setFocusOrigin] = useState(null);
    const [lastSessionResult, setLastSessionResult] = useState(null);
    const savingRef = useRef(false);

    // Persist timer state to localStorage whenever state transitions occur
    useEffect(() => {
        try {
            if (activeTimer) {
                localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(activeTimer));
            } else {
                localStorage.removeItem(TIMER_STORAGE_KEY);
                localStorage.removeItem(LEGACY_STORAGE_KEY);
            }
        } catch (e) {
            console.error('Error persisting timer:', e);
        }
    }, [activeTimer]);

    // Clock display components own their one-second ticks; the provider only updates on transitions.

    const getElapsedSeconds = useCallback(() => {
        if (!activeTimer) return 0;
        const baseSeconds = Math.floor((activeTimer.accumulatedActiveMs || 0) / 1000);
        if (activeTimer.state === 'running' && activeTimer.runningSinceEpochMs) {
            const currentDiff = Math.max(0, Math.floor((Date.now() - activeTimer.runningSinceEpochMs) / 1000));
            return baseSeconds + currentDiff;
        }
        return baseSeconds;
    }, [activeTimer]);

    const startTimer = useCallback(({ mediaType = 'book', itemId, itemTitle = 'Activity', itemCover = '', fromPage = 0, totalPages = null, fromHours = 0, force = false }) => {
        // Reopen the same ongoing session; never silently replace its elapsed time.
        if (activeTimer && !force) {
            const sameItem = activeTimer.itemId === String(itemId) && activeTimer.mediaType === mediaType;
            if (sameItem && ['running', 'paused'].includes(activeTimer.state)) {
                setFocusVisible(true);
                return { resumed: true, timer: activeTimer };
            }
            setTimerConflict({
                incoming: { mediaType, itemId, itemTitle, itemCover, fromPage, totalPages, fromHours },
                current: activeTimer,
            });
            return { conflict: true, current: activeTimer };
        }

        const now = Date.now();
        const newTimer = {
            timerId: `timer-${now}`,
            sessionId: generateId('sess'), // Stable session ID for idempotency (TIMER-05)
            mediaType: mediaType === 'game' ? 'game' : 'book',
            itemId: String(itemId),
            itemTitle,
            itemCover,
            state: 'running',
            startedAtISO: new Date(now).toISOString(),
            accumulatedActiveMs: 0,
            runningSinceEpochMs: now,
            fromPage: Number(fromPage) || 0,
            totalPages: Number(totalPages) > 0 ? Number(totalPages) : null,
            fromHours: Number(fromHours) || 0,
            updatedAtISO: new Date(now).toISOString(),
        };

        setActiveTimer(newTimer);
        setLastSessionResult(null);
        setFocusOrigin(null); // Starting from a detail card uses the lower-screen default origin.
        setFocusVisible(true);
        setTimerConflict(null);
        return { success: true, timer: newTimer };
    }, [activeTimer]);

    const resolveConflict = useCallback((action) => {
        if (!timerConflict) return;
        if (action === 'replace') {
            const incoming = timerConflict.incoming;
            setTimerConflict(null);
            startTimer({ ...incoming, force: true });
        } else {
            setTimerConflict(null);
        }
    }, [timerConflict, startTimer]);

    const pauseTimer = useCallback(() => {
        setActiveTimer((curr) => {
            if (!curr || curr.state !== 'running') return curr;
            const now = Date.now();
            const elapsedSinceResume = curr.runningSinceEpochMs ? Math.max(0, now - curr.runningSinceEpochMs) : 0;
            return {
                ...curr,
                state: 'paused',
                accumulatedActiveMs: (curr.accumulatedActiveMs || 0) + elapsedSinceResume,
                runningSinceEpochMs: null,
                updatedAtISO: new Date(now).toISOString(),
            };
        });
    }, []);

    const resumeTimer = useCallback(() => {
        setActiveTimer((curr) => {
            if (!curr || curr.state !== 'paused') return curr;
            const now = Date.now();
            return {
                ...curr,
                state: 'running',
                runningSinceEpochMs: now,
                updatedAtISO: new Date(now).toISOString(),
            };
        });
    }, []);

    const openReview = useCallback(() => {
        setActiveTimer((curr) => {
            if (!curr) return null;
            const now = Date.now();
            const elapsedSinceResume = curr.state === 'running' && curr.runningSinceEpochMs ? Math.max(0, now - curr.runningSinceEpochMs) : 0;
            return {
                ...curr,
                sessionId: curr.sessionId || generateId('sess'), // Preserve or assign stable session ID
                state: 'review',
                accumulatedActiveMs: (curr.accumulatedActiveMs || 0) + elapsedSinceResume,
                runningSinceEpochMs: null,
                updatedAtISO: new Date(now).toISOString(),
            };
        });
        setIsModalOpen(true);
        setFocusVisible(false);
    }, []);

    const cancelReview = useCallback(() => {
        setActiveTimer((curr) => {
            if (!curr) return null;
            return {
                ...curr,
                state: 'paused',
                updatedAtISO: new Date().toISOString(),
            };
        });
        setIsModalOpen(false);
        setFocusVisible((prev) => prev && activeTimer?.mediaType === 'book');
    }, [activeTimer?.mediaType]);

    const saveSession = useCallback(async (reviewPayload = {}) => {
        if (!activeTimer || savingRef.current) return;
        savingRef.current = true;
        const currentTimer = activeTimer;

        // Transition to saving state
        setActiveTimer((curr) => ({
            ...curr,
            state: 'saving',
            updatedAtISO: new Date().toISOString(),
        }));

        try {
            const activeSeconds = Math.max(0, Math.floor((currentTimer.accumulatedActiveMs || 0) / 1000));
            const sessionId = currentTimer.sessionId || generateId('sess');
            const uid = user?.uid;
            if (!uid) throw new Error('Please sign in as the diary owner before saving a session.');

            const sessionData = {
                schemaVersion: 2,
                id: sessionId, // Stable for retries: never create a duplicate on retry.
                libraryItemId: currentTimer.itemId,
                mediaType: currentTimer.mediaType,
                source: 'timer',
                startedAt: currentTimer.startedAtISO || new Date().toISOString(),
                date: reviewPayload.date || getCurrentLocalDateKey(),
                activeSeconds,
                notes: reviewPayload.notes || reviewPayload.note || null,
                timezone: reviewPayload.timezone || 'Asia/Manila',
                createdAt: new Date().toISOString(),
            };
            // Firestore rejects undefined values. Game sessions have no page fields.
            if (currentTimer.mediaType === 'book') {
                const startPage = Number(reviewPayload.startPage ?? currentTimer.fromPage ?? 0);
                const endPage = Number(reviewPayload.endPage ?? startPage);
                if (!Number.isFinite(startPage) || !Number.isFinite(endPage) || endPage < startPage) {
                    throw new Error('Invalid reading page range.');
                }
                sessionData.startPage = startPage;
                sessionData.endPage = endPage;
                if (currentTimer.totalPages && endPage > currentTimer.totalPages) {
                    throw new Error(`Ending page cannot exceed the book's ${currentTimer.totalPages} pages.`);
                }
                sessionData.pagesRead = Math.max(0, endPage - startPage);
            }

            const repository = getDiaryRepository(uid);
            await repository.createSession(sessionData);
            let progressWarning = null;
            // Keep the book's page progress in sync with a completed timed reading session.
            // If this secondary update fails, the session is already saved; preserve it.
            if (currentTimer.mediaType === 'book' && sessionData.endPage > sessionData.startPage) {
                try {
                    await updateBookProgress(uid, currentTimer.itemId, sessionData.endPage);
                } catch (progressError) {
                    console.warn('Session saved; book progress update needs attention:', progressError);
                    progressWarning = progressError?.message || 'Book progress could not be updated.';
                }
            }

            // The result is derived from the saved payload, never from a fabricated session.
            setLastSessionResult({
                mediaType: currentTimer.mediaType,
                itemId: currentTimer.itemId,
                itemTitle: currentTimer.itemTitle,
                itemCover: currentTimer.itemCover,
                sessionId,
                date: sessionData.date,
                activeSeconds,
                pagesRead: sessionData.pagesRead ?? null,
                endPage: sessionData.endPage ?? null,
                totalPages: currentTimer.totalPages,
                progressWarning,
            });
            setFocusVisible(false);
            setActiveTimer(null);
            setIsModalOpen(false);
            return { success: true, sessionId };
        } catch (err) {
            console.error('Failed to save session, preserving review draft:', err);
            // Revert state back to review on failure to preserve unsaved draft
            setActiveTimer((curr) => ({
                ...curr,
                state: 'review',
                saveError: err.message,
                updatedAtISO: new Date().toISOString(),
            }));
            throw err;
        } finally {
            savingRef.current = false;
        }
    }, [activeTimer, user]);

    const discardTimer = useCallback(() => {
        setActiveTimer(null);
        setIsModalOpen(false);
        setTimerConflict(null);
        setFocusVisible(false);
    }, []);

    const closeSessionResult = useCallback(() => setLastSessionResult(null), []);
    const showFocus = useCallback((origin = null) => {
        setFocusOrigin(origin && Number.isFinite(origin.x) && Number.isFinite(origin.y) ? origin : null);
        setFocusVisible(true);
    }, []);
    const minimizeFocus = useCallback(() => setFocusVisible(false), []);

    const value = useMemo(() => ({
        focusVisible, focusOrigin, showFocus, minimizeFocus, lastSessionResult, closeSessionResult,
        activeTimer,
        isModalOpen,
        setIsModalOpen,
        timerConflict,
        resolveConflict,
        startTimer,
        pauseTimer,
        resumeTimer,
        openReview,
        cancelReview,
        saveSession,
        discardTimer,
        getElapsedSeconds,
    }), [
        focusVisible, focusOrigin, showFocus, minimizeFocus, lastSessionResult, closeSessionResult,
        activeTimer,
        isModalOpen,
        timerConflict,
        resolveConflict,
        startTimer,
        pauseTimer,
        resumeTimer,
        openReview,
        cancelReview,
        saveSession,
        discardTimer,
        getElapsedSeconds,
    ]);

    return (
        <TimerContext.Provider value={value}>
            {children}
        </TimerContext.Provider>
    );
}

ActivityTimerProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

// eslint-disable-next-line react-refresh/only-export-components
export function useTimer() {
    const context = useContext(TimerContext);
    if (!context) {
        throw new Error('useTimer must be used within an ActivityTimerProvider');
    }
    return context;
}
