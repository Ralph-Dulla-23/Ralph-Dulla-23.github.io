import test from 'node:test';
import assert from 'node:assert/strict';
import {
    validateLibraryItem,
    validateAttempt,
    validateSession,
    validateHistoricalAggregate,
    validateJournalEntry,
} from '../src/domain/validators.js';
import {
    canTransitionBookStatus,
    canTransitionGameStatus,
    transitionBookStatus,
    transitionGameStatus,
} from '../src/domain/status.js';
import { toPublicShelfItem } from '../src/domain/publicProjection.js';
import { DEFAULT_TIMEZONE } from '../src/domain/constants.js';

test('TC-01: validateLibraryItem validates canonical v2 book and game records', () => {
    // Valid book
    const validBook = {
        schemaVersion: 2,
        id: '123e4567-e89b-12d3-a456-426614174000',
        mediaType: 'book',
        title: 'Project Hail Mary',
        creators: ['Andy Weir'],
        status: 'reading',
        rating: 4.5,
        ratingScale: 5,
        progress: { unit: 'page', current: 150, total: 496 },
        visibility: 'private',
    };
    const bookRes = validateLibraryItem(validBook);
    assert.equal(bookRes.valid, true, `Book validation failed: ${bookRes.errors?.join(', ')}`);

    // Valid game
    const validGame = {
        schemaVersion: 2,
        id: '123e4567-e89b-12d3-a456-426614174001',
        mediaType: 'game',
        title: 'Elden Ring',
        creators: ['FromSoftware'],
        status: 'playing',
        rating: 9.5,
        ratingScale: 10,
        progress: { unit: 'percent', current: 65, total: 100 },
        visibility: 'public_shelf',
        playedPlatform: 'PC',
    };
    const gameRes = validateLibraryItem(validGame);
    assert.equal(gameRes.valid, true, `Game validation failed: ${gameRes.errors?.join(', ')}`);

    // Invalid mediaType
    const invalidType = { ...validBook, mediaType: 'movie' };
    const invalidTypeRes = validateLibraryItem(invalidType);
    assert.equal(invalidTypeRes.valid, false);
    assert.ok(invalidTypeRes.errors.some(e => e.includes('mediaType')));

    // Invalid rating for book (> 5)
    const invalidRating = { ...validBook, rating: 8 };
    const invalidRatingRes = validateLibraryItem(invalidRating);
    assert.equal(invalidRatingRes.valid, false);
    assert.ok(invalidRatingRes.errors.some(e => e.includes('rating')));
});

test('TC-02: validateLibraryItem enforces null total pages and progress boundaries', () => {
    // Unknown pages resolves to total: null (no fictional 350 pages fallback)
    const unknownPagesBook = {
        schemaVersion: 2,
        id: '123e4567-e89b-12d3-a456-426614174002',
        mediaType: 'book',
        title: 'Unknown Length Book',
        creators: ['Anonymous'],
        status: 'want-to-read',
        progress: { unit: 'page', current: 0, total: null },
    };
    const resUnknown = validateLibraryItem(unknownPagesBook);
    assert.equal(resUnknown.valid, true);

    // Current page exceeds known total -> invalid
    const overflowBook = {
        ...unknownPagesBook,
        progress: { unit: 'page', current: 450, total: 400 },
    };
    const resOverflow = validateLibraryItem(overflowBook);
    assert.equal(resOverflow.valid, false);
    assert.ok(resOverflow.errors.some(e => e.includes('exceed')));
});

test('TC-03: validateAttempt validates multi-attempt models and preserving history', () => {
    // Attempt 1: Completed
    const attempt1 = {
        schemaVersion: 2,
        id: 'attempt-uuid-1',
        libraryItemId: 'book-uuid-1',
        mediaType: 'book',
        ordinal: 1,
        status: 'completed',
        startedOn: '2024-01-01',
        completedOn: '2024-01-15',
        progress: { unit: 'page', current: 300, total: 300 },
    };
    assert.equal(validateAttempt(attempt1).valid, true);

    // Attempt 2: Reread in-progress
    const attempt2 = {
        schemaVersion: 2,
        id: 'attempt-uuid-2',
        libraryItemId: 'book-uuid-1',
        mediaType: 'book',
        ordinal: 2,
        status: 'in_progress',
        startedOn: '2026-03-01',
        completedOn: null,
        progress: { unit: 'page', current: 50, total: 300 },
    };
    assert.equal(validateAttempt(attempt2).valid, true);

    // Invalid attempt without ordinal
    const invalidAttempt = { ...attempt1, ordinal: -1 };
    assert.equal(validateAttempt(invalidAttempt).valid, false);
});

test('TC-04: validateSession enforces integer activeSeconds and default timezone', () => {
    const validSession = {
        schemaVersion: 2,
        id: 'session-uuid-1',
        libraryItemId: 'book-uuid-1',
        attemptId: 'attempt-uuid-1',
        mediaType: 'book',
        source: 'timer',
        startedAt: '2026-10-19T10:00:00.000Z',
        endedAt: '2026-10-19T10:25:30.000Z',
        timezone: DEFAULT_TIMEZONE,
        activeSeconds: 1530,
        progressBefore: 50,
        progressAfter: 75,
        progressUnit: 'page',
    };
    assert.equal(validateSession(validSession).valid, true);

    // Negative activeSeconds -> invalid
    const negativeDuration = { ...validSession, activeSeconds: -10 };
    assert.equal(validateSession(negativeDuration).valid, false);

    // Non-integer activeSeconds -> invalid
    const floatDuration = { ...validSession, activeSeconds: 1530.75 };
    assert.equal(validateSession(floatDuration).valid, false);
});

test('TC-05: validateHistoricalAggregate enforces non-daily aggregate provenance', () => {
    const aggregate = {
        schemaVersion: 2,
        id: 'agg-uuid-1',
        mediaType: 'book',
        libraryItemId: 'book-uuid-1',
        source: 'bookmory_markdown',
        periodStartDate: '2025-11-01',
        periodEndDate: '2025-11-15',
        totalMinutes: 450,
        pagesRead: 120,
        isDailySession: false,
    };
    assert.equal(validateHistoricalAggregate(aggregate).valid, true);

    // Disallows isDailySession: true on historical multi-day aggregate
    const invalidAggregate = { ...aggregate, isDailySession: true };
    assert.equal(validateHistoricalAggregate(invalidAggregate).valid, false);
});

test('TC-06: Status state machines govern book and game status transitions reversibly', () => {
    // Book transitions
    assert.equal(canTransitionBookStatus('want-to-read', 'reading'), true);
    assert.equal(canTransitionBookStatus('reading', 'completed'), true);
    assert.equal(canTransitionBookStatus('completed', 'reading'), true); // un-completing is allowed
    assert.equal(canTransitionBookStatus('completed', 'want-to-read'), true);

    // Game transitions
    assert.equal(canTransitionGameStatus('backlog', 'playing'), true);
    assert.equal(canTransitionGameStatus('playing', 'completed'), true);
    assert.equal(canTransitionGameStatus('completed', 'playing'), true); // un-completing is allowed
    assert.equal(canTransitionGameStatus('completed', 'replay'), true);

    // Attempt completion updates
    const activeAttempt = {
        id: 'att-1',
        status: 'in_progress',
        startedOn: '2026-01-01',
        completedOn: null,
    };

    // Transition to completed
    const completedAttempt = transitionBookStatus(activeAttempt, 'completed', '2026-01-15');
    assert.equal(completedAttempt.status, 'completed');
    assert.equal(completedAttempt.completedOn, '2026-01-15');

    // Un-complete back to reading clears completedOn on active attempt
    const reopenedAttempt = transitionBookStatus(completedAttempt, 'reading');
    assert.equal(reopenedAttempt.status, 'in_progress');
    assert.equal(reopenedAttempt.completedOn, null);
});

test('TC-07: toPublicShelfItem emits only allowlisted fields, stripping private data', () => {
    const privateBook = {
        id: 'book-1',
        mediaType: 'book',
        title: 'Private Diary Book',
        creators: ['Author Name'],
        coverUrl: 'https://example.com/cover.jpg',
        status: 'reading',
        rating: 5,
        ratingScale: 5,
        tags: ['Sci-Fi'],
        privateNotes: 'My super secret thoughts that must never be public!',
        logs: [{ minutes: 45 }],
        activeAttemptId: 'attempt-123',
        createdAt: '2026-01-01',
    };

    const publicItem = toPublicShelfItem(privateBook, {
        showRating: true,
        showStatus: true,
        showTags: true,
    });

    assert.equal(publicItem.schemaVersion, 2);
    assert.equal(publicItem.title, 'Private Diary Book');
    assert.deepEqual(publicItem.creators, ['Author Name']);
    assert.equal(publicItem.rating, 5);
    assert.equal(publicItem.status, 'reading');
    assert.deepEqual(publicItem.tags, ['Sci-Fi']);

    // Strictly verifies NO private fields exist
    assert.equal(publicItem.privateNotes, undefined);
    assert.equal(publicItem.logs, undefined);
    assert.equal(publicItem.activeAttemptId, undefined);
});
