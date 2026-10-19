import { BOOK_STATUSES, GAME_STATUSES } from './constants.js';

const BOOK_TRANSITIONS = {
    'want-to-read': ['reading', 'dropped'],
    'reading': ['completed', 'paused', 'dropped', 'want-to-read'],
    'completed': ['reading', 'want-to-read', 'paused'],
    'dropped': ['want-to-read', 'reading'],
    'paused': ['reading', 'dropped', 'want-to-read'],
};

const GAME_TRANSITIONS = {
    'backlog': ['playing', 'dropped'],
    'playing': ['completed', 'paused', 'dropped', 'backlog'],
    'completed': ['playing', 'backlog', 'replay'],
    'replay': ['completed', 'playing', 'dropped'],
    'dropped': ['backlog', 'playing'],
    'paused': ['playing', 'dropped', 'backlog'],
};

export function canTransitionBookStatus(fromStatus, toStatus) {
    if (fromStatus === toStatus) return true;
    if (!BOOK_STATUSES.includes(toStatus)) return false;
    const allowed = BOOK_TRANSITIONS[fromStatus];
    return Array.isArray(allowed) && allowed.includes(toStatus);
}

export function canTransitionGameStatus(fromStatus, toStatus) {
    if (fromStatus === toStatus) return true;
    if (!GAME_STATUSES.includes(toStatus)) return false;
    const allowed = GAME_TRANSITIONS[fromStatus];
    return Array.isArray(allowed) && allowed.includes(toStatus);
}

/**
 * Reversibly transitions an active Attempt when media status changes.
 */
export function transitionBookStatus(activeAttempt, newStatus, completedOnDate = null) {
    const today = new Date().toISOString().split('T')[0];
    const updated = { ...activeAttempt };

    if (newStatus === 'completed') {
        updated.status = 'completed';
        updated.completedOn = completedOnDate || today;
    } else if (newStatus === 'reading') {
        updated.status = 'in_progress';
        updated.completedOn = null;
        if (!updated.startedOn) {
            updated.startedOn = today;
        }
    } else if (newStatus === 'dropped') {
        updated.status = 'abandoned';
        updated.abandonedOn = today;
    }

    return updated;
}

export function transitionGameStatus(activeAttempt, newStatus, completedOnDate = null) {
    const today = new Date().toISOString().split('T')[0];
    const updated = { ...activeAttempt };

    if (newStatus === 'completed') {
        updated.status = 'completed';
        updated.completedOn = completedOnDate || today;
    } else if (newStatus === 'playing' || newStatus === 'replay') {
        updated.status = 'in_progress';
        updated.completedOn = null;
        if (!updated.startedOn) {
            updated.startedOn = today;
        }
    } else if (newStatus === 'dropped') {
        updated.status = 'abandoned';
        updated.abandonedOn = today;
    }

    return updated;
}

/**
 * Normalizes legacy and alias game statuses into canonical GAME_STATUSES.
 * Maps 'finished' -> 'completed', 'replaying' -> 'replay'.
 * 
 * @param {string} status
 * @returns {string}
 */
export function normalizeGameStatus(status) {
    if (!status) return 'backlog';
    const s = String(status).trim().toLowerCase();
    if (s === 'finished') return 'completed';
    if (s === 'replaying') return 'replay';
    if (GAME_STATUSES.includes(s)) return s;
    return 'backlog';
}

/**
 * Normalizes legacy and alias book statuses into canonical BOOK_STATUSES.
 * Maps 'want_to_read'/'to-read' -> 'want-to-read', 'finished'/'read' -> 'completed',
 * 'abandoned' -> 'dropped', 'on-hold' -> 'paused'.
 * 
 * @param {string} status
 * @returns {string}
 */
export function normalizeBookStatus(status) {
    if (!status) return 'want-to-read';
    const s = String(status).trim().toLowerCase();
    if (s === 'want_to_read' || s === 'want to read' || s === 'to-read') return 'want-to-read';
    if (s === 'finished' || s === 'read') return 'completed';
    if (s === 'abandoned') return 'dropped';
    if (s === 'on-hold' || s === 'on_hold') return 'paused';
    if (BOOK_STATUSES.includes(s)) return s;
    return 'want-to-read';
}
