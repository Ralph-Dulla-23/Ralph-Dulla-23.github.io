import {
    MEDIA_TYPES,
    BOOK_STATUSES,
    GAME_STATUSES,
    ATTEMPT_STATUSES,
    SESSION_SOURCES,
    JOURNAL_TYPES,
    VISIBILITY_LEVELS,
    DEFAULT_TIMEZONE,
} from './constants.js';
import { isValidId } from './id.js';
export { toPublicShelfItem, toPublicHighlight } from './publicProjection.js';

/**
 * Validates a canonical v2 LibraryItem (Book or Game).
 */
export function validateLibraryItem(item) {
    const errors = [];
    if (!item || typeof item !== 'object') {
        return { valid: false, errors: ['Item must be a valid object.'] };
    }

    if (item.schemaVersion !== 2) {
        errors.push('schemaVersion must be 2.');
    }

    if (!isValidId(item.id)) {
        errors.push('id must be a non-empty stable identifier string.');
    }

    if (!MEDIA_TYPES.includes(item.mediaType)) {
        errors.push(`mediaType must be one of: ${MEDIA_TYPES.join(', ')}.`);
    }

    if (typeof item.title !== 'string' || !item.title.trim()) {
        errors.push('title is required and must be a non-empty string.');
    }

    if (item.creators !== undefined && !Array.isArray(item.creators)) {
        errors.push('creators must be an array of strings.');
    }

    if (item.mediaType === 'book') {
        if (item.status && !BOOK_STATUSES.includes(item.status)) {
            errors.push(`Book status must be one of: ${BOOK_STATUSES.join(', ')}.`);
        }
        if (item.rating !== null && item.rating !== undefined) {
            if (typeof item.rating !== 'number' || item.rating < 0 || item.rating > 5) {
                errors.push('Book rating must be null or a number between 0 and 5.');
            }
        }
    } else if (item.mediaType === 'game') {
        if (item.status && !GAME_STATUSES.includes(item.status)) {
            errors.push(`Game status must be one of: ${GAME_STATUSES.join(', ')}.`);
        }
        if (item.rating !== null && item.rating !== undefined) {
            if (typeof item.rating !== 'number' || item.rating < 0 || item.rating > 10) {
                errors.push('Game rating must be null or a number between 0 and 10.');
            }
        }
    }

    // Progress validation
    if (item.progress) {
        const { current, total, unit } = item.progress;
        if (unit && !['page', 'percent', 'hours', 'chapter'].includes(unit)) {
            errors.push('progress.unit must be one of: page, percent, hours, chapter.');
        }
        if (typeof current === 'number' && current < 0) {
            errors.push('progress.current cannot be negative.');
        }
        if (total !== null && total !== undefined) {
            if (typeof total !== 'number' || total <= 0) {
                errors.push('progress.total must be null or a positive number.');
            } else if (typeof current === 'number' && current > total) {
                errors.push(`progress.current (${current}) cannot exceed total (${total}).`);
            }
        }
    }

    if (item.visibility && !VISIBILITY_LEVELS.includes(item.visibility)) {
        errors.push(`visibility must be one of: ${VISIBILITY_LEVELS.join(', ')}.`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validates a canonical v2 Attempt (reading attempt or game playthrough).
 */
export function validateAttempt(attempt) {
    const errors = [];
    if (!attempt || typeof attempt !== 'object') {
        return { valid: false, errors: ['Attempt must be a valid object.'] };
    }

    if (attempt.schemaVersion !== 2) {
        errors.push('schemaVersion must be 2.');
    }

    if (!isValidId(attempt.id)) {
        errors.push('id must be a non-empty identifier string.');
    }

    if (!isValidId(attempt.libraryItemId)) {
        errors.push('libraryItemId must be a non-empty identifier string.');
    }

    if (typeof attempt.ordinal !== 'number' || !Number.isInteger(attempt.ordinal) || attempt.ordinal < 1) {
        errors.push('ordinal must be an integer >= 1.');
    }

    if (!ATTEMPT_STATUSES.includes(attempt.status)) {
        errors.push(`status must be one of: ${ATTEMPT_STATUSES.join(', ')}.`);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validates a canonical v2 Session (timed or manual reading/gaming block).
 */
export function validateSession(session) {
    const errors = [];
    if (!session || typeof session !== 'object') {
        return { valid: false, errors: ['Session must be a valid object.'] };
    }

    if (session.schemaVersion !== 2) {
        errors.push('schemaVersion must be 2.');
    }

    if (!isValidId(session.id)) {
        errors.push('id must be a non-empty identifier string.');
    }

    if (!isValidId(session.libraryItemId)) {
        errors.push('libraryItemId must be a non-empty identifier string.');
    }

    if (session.source && !SESSION_SOURCES.includes(session.source)) {
        errors.push(`source must be one of: ${SESSION_SOURCES.join(', ')}.`);
    }

    if (typeof session.activeSeconds !== 'number' || !Number.isInteger(session.activeSeconds) || session.activeSeconds < 0) {
        errors.push('activeSeconds must be an integer >= 0.');
    }

    if (session.startedAt && isNaN(Date.parse(session.startedAt))) {
        errors.push('startedAt must be a valid ISO date string.');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validates a historical imported aggregate (e.g. from Bookmory summary logs).
 */
export function validateHistoricalAggregate(aggregate) {
    const errors = [];
    if (!aggregate || typeof aggregate !== 'object') {
        return { valid: false, errors: ['HistoricalAggregate must be a valid object.'] };
    }

    if (aggregate.schemaVersion !== 2) {
        errors.push('schemaVersion must be 2.');
    }

    if (!isValidId(aggregate.id)) {
        errors.push('id must be a non-empty identifier string.');
    }

    if (aggregate.isDailySession !== false) {
        errors.push('isDailySession must be strictly false on HistoricalAggregate records.');
    }

    if (typeof aggregate.totalMinutes !== 'number' || aggregate.totalMinutes < 0) {
        errors.push('totalMinutes must be a number >= 0.');
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validates a canonical v2 JournalEntry.
 */
export function validateJournalEntry(entry) {
    const errors = [];
    if (!entry || typeof entry !== 'object') {
        return { valid: false, errors: ['JournalEntry must be a valid object.'] };
    }

    if (entry.schemaVersion !== 2) {
        errors.push('schemaVersion must be 2.');
    }

    if (!isValidId(entry.id)) {
        errors.push('id must be a non-empty identifier string.');
    }

    if (!JOURNAL_TYPES.includes(entry.type)) {
        errors.push(`type must be one of: ${JOURNAL_TYPES.join(', ')}.`);
    }

    if (typeof entry.body !== 'string') {
        errors.push('body must be a string.');
    }

    return { valid: errors.length === 0, errors };
}
