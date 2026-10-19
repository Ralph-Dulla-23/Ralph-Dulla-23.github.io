import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { generateId } from '../domain/id';
import { useAuth } from './AuthContext';
import { getDiaryRepository } from '../lib/db';

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
                return JSON.parse(saved);
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

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [timerConflict, setTimerConflict] = useState(null);
    const [, setTick] = useState(0);

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

    // Interval ticker for live UI updates while running
    useEffect(() => {
        if (!activeTimer || activeTimer.state !== 'running') return;
        const interval = setInterval(() => {
            setTick((t) => t + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [activeTimer]);

    const getElapsedSeconds = useCallback(() => {
        if (!activeTimer) return 0;
        const baseSeconds = Math.floor((activeTimer.accumulatedActiveMs || 0) / 1000);
        if (activeTimer.state === 'running' && activeTimer.runningSinceEpochMs) {
            const currentDiff = Math.max(0, Math.floor((Date.now() - activeTimer.runningSinceEpochMs) / 1000));
            return baseSeconds + currentDiff;
        }
        return baseSeconds;
    }, [activeTimer]);

    const startTimer = useCallback(({ mediaType = 'book', itemId, itemTitle = 'Activity', itemCover = '', fromPage = 0, fromHours = 0, force = false }) => {
        // TIMER-02: Conflict Guard
        // If an active timer is running/paused for a different item, guard against silent overwriting
        if (activeTimer && (activeTimer.state === 'running' || activeTimer.state === 'paused') && activeTimer.itemId !== String(itemId) && !force) {
            setTimerConflict({
                incoming: { mediaType, itemId, itemTitle, itemCover, fromPage, fromHours },
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
            fromHours: Number(fromHours) || 0,
            updatedAtISO: new Date(now).toISOString(),
        };

        setActiveTimer(newTimer);
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
    }, []);

    const saveSession = useCallback(async (reviewPayload = {}) => {
        if (!activeTimer) return;
        const currentTimer = activeTimer;

        // Transition to saving state
        setActiveTimer((curr) => ({
            ...curr,
            state: 'saving',
            updatedAtISO: new Date().toISOString(),
        }));

        try {
            const activeSeconds = Math.max(0, Number(reviewPayload.activeSeconds) || Math.floor((currentTimer.accumulatedActiveMs || 0) / 1000));
            const sessionId = currentTimer.sessionId || generateId('sess');
            const uid = user?.uid || 'anonymous-owner';

            const sessionData = {
                schemaVersion: 2,
                id: sessionId,
                libraryItemId: currentTimer.itemId,
                mediaType: currentTimer.mediaType,
                source: 'timer',
                startedAt: currentTimer.startedAtISO || new Date().toISOString(),
                date: reviewPayload.date || new Date().toISOString().slice(0, 10),
                activeSeconds,
                startPage: reviewPayload.startPage !== undefined ? Number(reviewPayload.startPage) : currentTimer.fromPage,
                endPage: reviewPayload.endPage !== undefined ? Number(reviewPayload.endPage) : undefined,
                pagesRead: reviewPayload.pagesRead !== undefined ? Number(reviewPayload.pagesRead) : Math.max(0, (reviewPayload.endPage || 0) - (reviewPayload.startPage || 0)),
                notes: reviewPayload.notes || reviewPayload.note || null,
                timezone: reviewPayload.timezone || 'Asia/Manila',
                createdAt: new Date().toISOString(),
            };

            const repository = getDiaryRepository(uid);
            await repository.createSession(sessionData);

            // Successfully saved: clear active timer and close modal
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
        }
    }, [activeTimer, user]);

    const discardTimer = useCallback(() => {
        setActiveTimer(null);
        setIsModalOpen(false);
        setTimerConflict(null);
    }, []);

    const value = useMemo(() => ({
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
