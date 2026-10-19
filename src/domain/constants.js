/**
 * Canonical domain constants for Books & Games Diary.
 * Grounded in BOOKS_GAMES_DIARY_IMPLEMENTATION.md (Sections 5 & 14).
 */

export const DEFAULT_TIMEZONE = 'Asia/Manila';

export const MEDIA_TYPES = Object.freeze(['book', 'game']);

export const BOOK_STATUSES = Object.freeze([
    'want-to-read',
    'reading',
    'completed',
    'dropped',
    'paused',
]);

export const GAME_STATUSES = Object.freeze([
    'backlog',
    'playing',
    'completed',
    'dropped',
    'paused',
    'replay',
]);

export const ATTEMPT_STATUSES = Object.freeze([
    'in_progress',
    'completed',
    'abandoned',
]);

export const SESSION_SOURCES = Object.freeze([
    'timer',
    'manual',
    'import_aggregate',
]);

export const JOURNAL_TYPES = Object.freeze([
    'reflection',
    'book_quote',
    'game_moment',
    'session_note',
    'review',
    'milestone',
    'general_note',
]);

export const VISIBILITY_LEVELS = Object.freeze([
    'private',
    'public_shelf',
    'public_highlight',
]);
