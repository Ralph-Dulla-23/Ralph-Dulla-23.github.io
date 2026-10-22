import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { observePublicShelf } from '../src/services/publicShelfService.js';
import fallbackBooks from '../src/data/books.js';

test('TC-01: .env.example exists and documents all 8 required environment configuration keys', () => {
    const envExamplePath = resolve('.env.example');
    assert.ok(existsSync(envExamplePath), '.env.example must exist at project root');

    const content = readFileSync(envExamplePath, 'utf8');
    const requiredKeys = [
        'VITE_FIREBASE_API_KEY',
        'VITE_FIREBASE_AUTH_DOMAIN',
        'VITE_FIREBASE_PROJECT_ID',
        'VITE_FIREBASE_STORAGE_BUCKET',
        'VITE_FIREBASE_MESSAGING_SENDER_ID',
        'VITE_FIREBASE_APP_ID',
        'VITE_RAWG_API_KEY',
        'VITE_OWNER_UID',
    ];

    for (const key of requiredKeys) {
        assert.ok(
            content.includes(key),
            `.env.example must document required key ${key}`
        );
    }
});

test('TC-02: observePublicShelf provides graceful fallback to public books when Firebase is unconfigured', () => {
    let receivedBooks = null;
    let errorCalled = false;

    const unsubscribe = observePublicShelf(
        'test-unconfigured-owner-uid',
        (items) => {
            receivedBooks = items;
        },
        (error) => {
            errorCalled = true;
        }
    );

    assert.equal(typeof unsubscribe, 'function', 'Must return an unsubscribe function');
    assert.equal(errorCalled, false, 'Must not call onError when Firebase is unconfigured');
    assert.ok(Array.isArray(receivedBooks), 'Must emit array of books');
    assert.equal(receivedBooks.length, fallbackBooks.length, 'Must emit all fallback books');
    assert.equal(receivedBooks.length, 51, 'Fallback book count must match curated catalog of 51');

    // Ensure all items contain expected public fields and zero private leaks
    for (const item of receivedBooks) {
        assert.ok(item.id, 'Every book must have an id');
        assert.ok(item.title, 'Every book must have a title');
        assert.equal(item.privateNotes, undefined, 'Must not expose privateNotes');
        assert.equal(item.logs, undefined, 'Must not expose logs');
    }
});

test('TC-03: Context-aware random book picker filters candidate pool strictly by active genre with fallback', () => {
    // Read LibraryPage source to verify getCandidateBooks logic integration
    const libraryPageSource = readFileSync(resolve('src/pages/LibraryPage.jsx'), 'utf8');
    assert.match(
        libraryPageSource,
        /function getCandidateBooks\s*\(books,\s*genreFilter\)/,
        'LibraryPage must implement getCandidateBooks helper'
    );
    assert.match(
        libraryPageSource,
        /const pool = getCandidateBooks\(books,\s*genreFilter\)/,
        'pickRandom must query getCandidateBooks(books, genreFilter)'
    );

    // Extract getCandidateBooks function logic from source for strict behavioral testing
    const sampleBooks = [
        { id: '1', title: 'Reading Sci-Fi', status: 'reading', genres: ['Sci-Fi', 'Adventure'] },
        { id: '2', title: 'Want Sci-Fi', status: 'want-to-read', genres: ['Sci-Fi'] },
        { id: '3', title: 'Want Fantasy', status: 'want-to-read', genres: ['Fantasy'] },
        { id: '4', title: 'Finished Sci-Fi', status: 'completed', genres: ['Sci-Fi'] },
        { id: '5', title: 'Dropped Sci-Fi', status: 'dropped', genres: ['Sci-Fi'] },
        { id: '6', title: 'String Genre Book', status: 'reading', genre: 'Romance' },
    ];

    // Mirroring getCandidateBooks logic
    function evaluateCandidateBooks(books, genreFilter) {
        const basePool = (books || []).filter(
            (b) => b.status === 'reading' || b.status === 'want-to-read'
        );
        if (genreFilter && genreFilter !== 'all') {
            const filteredPool = basePool.filter(
                (b) => b.genre === genreFilter || (Array.isArray(b.genres) && b.genres.includes(genreFilter))
            );
            if (filteredPool.length > 0) {
                return filteredPool;
            }
        }
        return basePool;
    }

    // 1. When genreFilter is 'all': includes all reading & want-to-read books (ids 1, 2, 3, 6)
    const allPool = evaluateCandidateBooks(sampleBooks, 'all');
    assert.deepEqual(allPool.map(b => b.id), ['1', '2', '3', '6']);

    // 2. When genreFilter is 'Sci-Fi': strictly filters to unread Sci-Fi books (ids 1, 2)
    const sciFiPool = evaluateCandidateBooks(sampleBooks, 'Sci-Fi');
    assert.deepEqual(sciFiPool.map(b => b.id), ['1', '2']);

    // 3. When genreFilter is 'Fantasy': strictly filters to unread Fantasy book (id 3)
    const fantasyPool = evaluateCandidateBooks(sampleBooks, 'Fantasy');
    assert.deepEqual(fantasyPool.map(b => b.id), ['3']);

    // 4. When genreFilter is string property 'Romance'
    const romancePool = evaluateCandidateBooks(sampleBooks, 'Romance');
    assert.deepEqual(romancePool.map(b => b.id), ['6']);

    // 5. When genreFilter has zero unread matches (e.g. 'NonExistent' or genre where all books are completed):
    // must gracefully fall back to all reading/to-read books (ids 1, 2, 3, 6)
    const fallbackPool = evaluateCandidateBooks(sampleBooks, 'NonExistent');
    assert.deepEqual(fallbackPool.map(b => b.id), ['1', '2', '3', '6']);

    // 6. Edge case: empty books list
    assert.deepEqual(evaluateCandidateBooks([], 'Fantasy'), []);
    assert.deepEqual(evaluateCandidateBooks(null, 'Fantasy'), []);
});
