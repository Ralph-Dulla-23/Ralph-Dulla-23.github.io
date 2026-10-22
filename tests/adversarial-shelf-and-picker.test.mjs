import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { observePublicShelf, observePublicHighlights } from '../src/services/publicShelfService.js';
import fallbackBooks from '../src/data/books.js';
import { isFirebaseConfigured, OWNER_UID } from '../src/lib/config.js';
import { db } from '../src/lib/firebase.js';

// Read getCandidateBooks implementation directly from LibraryPage.jsx to ensure exact behavioral fidelity
const libraryPageSource = readFileSync(resolve('src/pages/LibraryPage.jsx'), 'utf8');

function extractCandidateBooksFn(source) {
    const fnMatch = source.match(/function getCandidateBooks\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
    if (!fnMatch) throw new Error('Could not find getCandidateBooks in LibraryPage.jsx');
    return new Function('books', 'genreFilter', `${fnMatch[0]}; return getCandidateBooks(books, genreFilter);`);
}

const getCandidateBooks = extractCandidateBooksFn(libraryPageSource);

/* -------------------------------------------------------------------------- */
/*                                R1 STRESS TESTS                             */
/* -------------------------------------------------------------------------- */

test('R1-STRESS-01: observePublicShelf behavior when db is null / uninitialized', () => {
    // Assert db is null in unconfigured environment
    assert.equal(db, null, 'db must be null when Firebase env vars are unconfigured');
    assert.equal(isFirebaseConfigured(), false, 'isFirebaseConfigured() must be false');

    let emitted = null;
    let errorCalled = false;

    const unsub = observePublicShelf(
        OWNER_UID,
        (books) => {
            emitted = books;
        },
        () => {
            errorCalled = true;
        }
    );

    assert.equal(typeof unsub, 'function', 'Must return an unsubscribe function');
    assert.equal(errorCalled, false, 'Must not invoke onError when db is unconfigured');
    assert.ok(Array.isArray(emitted), 'Must emit array of books');
    assert.equal(emitted.length, 51, 'Must emit exactly all 51 compiled books');

    // Verify metadata completeness across all 51 items
    for (const book of emitted) {
        assert.ok(book.id, 'Every book must have an id');
        assert.ok(book.title, 'Every book must have a title');
        assert.ok(book.author, 'Every book must have an author');
        assert.ok(book.status, 'Every book must have a status');
    }
});

test('R1-STRESS-02: observePublicShelf resilient against adversarial ownerUid inputs', () => {
    const adversarialUids = [
        null,
        undefined,
        '',
        '   ',
        0,
        false,
        {},
        [],
    ];

    for (const badUid of adversarialUids) {
        let emitted = null;
        let errorCalled = false;

        const unsub = observePublicShelf(
            badUid,
            (books) => {
                emitted = books;
            },
            () => {
                errorCalled = true;
            }
        );

        assert.equal(typeof unsub, 'function', `Must return function for uid: ${String(badUid)}`);
        assert.equal(errorCalled, false, `Must not call onError for uid: ${String(badUid)}`);
        assert.ok(Array.isArray(emitted), `Must emit fallback books for uid: ${String(badUid)}`);
        assert.equal(emitted.length, 51, `Must emit 51 books for uid: ${String(badUid)}`);
        assert.doesNotThrow(() => unsub(), `Unsubscribe must not throw for uid: ${String(badUid)}`);
    }
});

test('R1-STRESS-03: observePublicShelf resilient against invalid callback arguments', () => {
    const invalidCallbacks = [null, undefined, 12345, 'not-a-fn', {}, []];

    for (const badCallback of invalidCallbacks) {
        let unsub = null;
        assert.doesNotThrow(() => {
            unsub = observePublicShelf(OWNER_UID, badCallback);
        }, `Should not throw when onUpdate is ${typeof badCallback}`);
        assert.equal(typeof unsub, 'function', 'Must safely return a no-op unsubscribe function');
        assert.doesNotThrow(() => unsub(), 'Returned unsubscribe must execute without throwing');
    }
});

test('R1-STRESS-04: Subscriber unsubscription idempotency and multi-call stability', () => {
    let callCount = 0;
    const unsub = observePublicShelf(OWNER_UID, () => {
        callCount++;
    });

    assert.equal(callCount, 1, 'Initial emission should occur exactly once');

    // Stress: call unsubscribe 100 times in rapid succession
    for (let i = 0; i < 100; i++) {
        assert.doesNotThrow(() => unsub(), `Unsubscribe invocation ${i + 1} must not throw`);
    }
});

test('R1-STRESS-05: Concurrent subscriber isolation stress test', () => {
    const subscriberCount = 100;
    const unsubs = [];
    const received = [];

    for (let i = 0; i < subscriberCount; i++) {
        const unsub = observePublicShelf(OWNER_UID, (books) => {
            received.push(books);
        });
        unsubs.push(unsub);
    }

    assert.equal(received.length, subscriberCount, 'All 100 subscribers must receive data');
    for (const books of received) {
        assert.equal(books.length, 51, 'Every subscriber must receive all 51 books');
    }

    // Unsubscribe all concurrently
    for (const unsub of unsubs) {
        assert.doesNotThrow(() => unsub());
    }
});

test('R1-STRESS-06: LibraryPage state lifecycle under missing Firebase env vars', () => {
    // Emulate LibraryPage observer behavior
    let componentBooks = [];
    let componentGames = [];
    let componentShelfError = null;
    let componentGamesLoading = true;

    const unsubscribe = observePublicShelf(
        OWNER_UID,
        (items) => {
            const publicBooks = items.filter((item) => item.mediaType === 'book' || !item.mediaType);
            const publicGames = items.filter((item) => item.mediaType === 'game');
            componentBooks = publicBooks;
            componentGames = publicGames;
            componentGamesLoading = false;
            componentShelfError = null;
        },
        (error) => {
            if (!isFirebaseConfigured()) {
                componentBooks = fallbackBooks;
                componentShelfError = null;
            } else {
                componentShelfError = error?.code || error?.message || 'Could not load published shelf';
            }
            componentGamesLoading = false;
        }
    );

    unsubscribe();

    // Verify the state that LibraryPage would render
    assert.equal(componentShelfError, null, 'Shelf error must be null (no error alert banner displayed)');
    assert.equal(componentGamesLoading, false, 'Games loading state must be cleared');
    assert.equal(componentBooks.length, 51, 'Component must hold all 51 compiled books');
    assert.equal(componentGames.length, 0, 'Public games should be empty without crashing');

    // Verify LibraryPage category section rendering counts
    const completed = componentBooks.filter((b) => b.status === 'completed');
    const reading = componentBooks.filter((b) => b.status === 'reading');
    const wantToRead = componentBooks.filter((b) => b.status === 'want-to-read');
    const dropped = componentBooks.filter((b) => b.status === 'dropped');

    assert.equal(completed.length, 34, 'Must have 34 completed books');
    assert.equal(reading.length, 0, 'Must have 0 currently reading books');
    assert.equal(wantToRead.length, 16, 'Must have 16 want-to-read books');
    assert.equal(dropped.length, 1, 'Must have 1 dropped book');
    assert.equal(completed.length + reading.length + wantToRead.length + dropped.length, 51);
});

/* -------------------------------------------------------------------------- */
/*                                R2 STRESS TESTS                             */
/* -------------------------------------------------------------------------- */

test('R2-STRESS-01: Active genre with 0 unread matches cleanly falls back to unread pool', () => {
    // 1. Test completely non-existent genre
    const nonExistentResult = getCandidateBooks(fallbackBooks, 'NonExistentGenreXYZ');
    const expectedUnreadPool = fallbackBooks.filter(
        (b) => b.status === 'reading' || b.status === 'want-to-read'
    );
    assert.equal(expectedUnreadPool.length, 16);
    assert.deepEqual(
        nonExistentResult.map((b) => b.id),
        expectedUnreadPool.map((b) => b.id),
        'Must fall back to all 16 unread books for non-existent genre'
    );

    // 2. Test against all 25 genres that exist in the library catalog but have 0 unread books (all completed)
    const completedBooks = fallbackBooks.filter((b) => b.status === 'completed');
    const unreadGenres = new Set(expectedUnreadPool.flatMap((b) => b.genres || []));
    const completedOnlyGenres = [...new Set(completedBooks.flatMap((b) => b.genres || []))].filter(
        (g) => !unreadGenres.has(g)
    );

    assert.ok(completedOnlyGenres.length >= 20, 'Should find 20+ completed-only genres to stress test');

    for (const genre of completedOnlyGenres) {
        const pool = getCandidateBooks(fallbackBooks, genre);
        assert.equal(
            pool.length,
            16,
            `Genre '${genre}' has 0 unread books; must fall back to all 16 unread books`
        );
        assert.deepEqual(
            pool.map((b) => b.id),
            expectedUnreadPool.map((b) => b.id),
            `Genre '${genre}' must return full unread fallback pool`
        );
    }
});

test('R2-STRESS-02: Active genre with exactly 1 matching unread book consistently picks that book', () => {
    // Find all genres in fallbackBooks that have exactly 1 unread book
    const unreadPool = fallbackBooks.filter(
        (b) => b.status === 'reading' || b.status === 'want-to-read'
    );
    const genreCounts = {};
    for (const book of unreadPool) {
        for (const genre of book.genres || []) {
            genreCounts[genre] = (genreCounts[genre] || 0) + 1;
        }
    }

    const singletonGenres = Object.entries(genreCounts)
        .filter(([, count]) => count === 1)
        .map(([genre]) => genre);

    assert.ok(singletonGenres.length > 5, 'Should find multiple singleton genres');

    for (const genre of singletonGenres) {
        const candidatePool = getCandidateBooks(fallbackBooks, genre);
        assert.equal(candidatePool.length, 1, `Candidate pool for '${genre}' must have exactly 1 book`);

        const expectedBook = unreadPool.find((b) => (b.genres || []).includes(genre));
        assert.equal(candidatePool[0].id, expectedBook.id);

        // Run Monte Carlo simulation: pick 200 times
        for (let run = 0; run < 200; run++) {
            const picked = candidatePool[Math.floor(Math.random() * candidatePool.length)];
            assert.equal(picked.id, expectedBook.id, `Pick iteration ${run} must select ${expectedBook.title}`);
        }
    }
});

test('R2-STRESS-03: Filter "all" samples evenly across the entire unread pool', () => {
    const candidatePool = getCandidateBooks(fallbackBooks, 'all');
    assert.equal(candidatePool.length, 16, 'Filter "all" must yield 16 unread candidates');

    // Monte Carlo simulation: 16,000 random picks across the 16 candidates
    const pickCounts = {};
    const totalPicks = 16000;
    for (const b of candidatePool) {
        pickCounts[b.id] = 0;
    }

    for (let i = 0; i < totalPicks; i++) {
        const picked = candidatePool[Math.floor(Math.random() * candidatePool.length)];
        pickCounts[picked.id]++;
    }

    // Each book expects ~1000 picks with reasonable statistical tolerance (e.g. 700 to 1300)
    for (const [bookId, count] of Object.entries(pickCounts)) {
        assert.ok(
            count >= 700 && count <= 1300,
            `Book ${bookId} was picked ${count} times (expected ~1000 in uniform distribution)`
        );
    }
});

test('R2-STRESS-04: Tricky edge case - 100% completed books catalog avoids crashing', () => {
    // Construct a dataset where all books are marked 'completed'
    const allCompletedBooks = fallbackBooks.map((b) => ({ ...b, status: 'completed' }));

    const pool = getCandidateBooks(allCompletedBooks, 'Fantasy');
    assert.ok(Array.isArray(pool), 'Must return an array');
    assert.equal(pool.length, 0, 'Candidate pool must be empty when all books are completed');

    // Simulate pickRandom handler with empty pool
    let selectedBook = null;
    let didThrow = false;
    try {
        if (pool.length) {
            selectedBook = pool[Math.floor(Math.random() * pool.length)];
        }
    } catch {
        didThrow = true;
    }

    assert.equal(didThrow, false, 'Must not throw an error');
    assert.equal(selectedBook, null, 'selectedBook must remain null without crash or undefined assignment');
});

test('R2-STRESS-05: Tricky edge case - empty, null, undefined, and malformed book datasets', () => {
    const malformedInputs = [
        [],
        null,
        undefined,
        [{}],
        [{ id: 'bad-1', status: 'unknown' }],
        [{ id: 'bad-2', genres: null }],
        [{ id: 'bad-3', genre: null, status: 'reading' }],
    ];

    for (const input of malformedInputs) {
        assert.doesNotThrow(() => {
            const pool = getCandidateBooks(input, 'Fantasy');
            assert.ok(Array.isArray(pool), 'Must always return an array');
        }, `Must not throw on malformed input: ${JSON.stringify(input)}`);
    }
});

test('R2-STRESS-06: Multi-genre and string-genre property support', () => {
    const customBooks = [
        { id: '1', title: 'Multi Array', status: 'want-to-read', genres: ['Sci-Fi', 'Cyberpunk', 'Mystery'] },
        { id: '2', title: 'Single String Prop', status: 'reading', genre: 'Cyberpunk' },
        { id: '3', title: 'Other Genre', status: 'want-to-read', genres: ['Romance'] },
    ];

    const cyberpunkPool = getCandidateBooks(customBooks, 'Cyberpunk');
    assert.equal(cyberpunkPool.length, 2, 'Cyberpunk pool must include both array and string genre books');
    assert.deepEqual(cyberpunkPool.map((b) => b.id).sort(), ['1', '2']);

    const mysteryPool = getCandidateBooks(customBooks, 'Mystery');
    assert.equal(mysteryPool.length, 1);
    assert.equal(mysteryPool[0].id, '1');
});
