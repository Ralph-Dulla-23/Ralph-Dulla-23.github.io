import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('TC-01: App.jsx defines routes for BookDetailPage (/app/books/:id) and GameDetailPage (/app/games/:id)', () => {
    const appPath = path.join(ROOT_DIR, 'src', 'App.jsx');
    const content = fs.readFileSync(appPath, 'utf8');

    assert.ok(
        content.includes('/app/books/:id'),
        'App.jsx must declare route for /app/books/:id'
    );
    assert.ok(
        content.includes('/app/games/:id'),
        'App.jsx must declare route for /app/games/:id'
    );
    assert.ok(
        content.includes('BookDetailPage'),
        'App.jsx must import and render BookDetailPage'
    );
    assert.ok(
        content.includes('GameDetailPage'),
        'App.jsx must import and render GameDetailPage'
    );
});

test('TC-02: LibrarySegmentedSwitch component exists and provides Books and Games links', () => {
    const switchPath = path.join(ROOT_DIR, 'src', 'components', 'library', 'LibrarySegmentedSwitch.jsx');
    assert.ok(fs.existsSync(switchPath), 'LibrarySegmentedSwitch.jsx must exist');

    const content = fs.readFileSync(switchPath, 'utf8');
    assert.ok(content.includes('/app/library/books'), 'Switch must link to /app/library/books');
    assert.ok(content.includes('/app/library/games'), 'Switch must link to /app/library/games');
    assert.ok(content.includes('Books'), 'Switch must contain Books label');
    assert.ok(content.includes('Games'), 'Switch must contain Games label');
});

test('TC-03: BooksPage and GamesPage integrate LibrarySegmentedSwitch', () => {
    const booksPagePath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'BooksPage.jsx');
    const gamesPagePath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'GamesPage.jsx');

    const booksContent = fs.readFileSync(booksPagePath, 'utf8');
    const gamesContent = fs.readFileSync(gamesPagePath, 'utf8');

    assert.ok(
        booksContent.includes('LibrarySegmentedSwitch'),
        'BooksPage must render LibrarySegmentedSwitch'
    );
    assert.ok(
        gamesContent.includes('LibrarySegmentedSwitch'),
        'GamesPage must render LibrarySegmentedSwitch'
    );
});

test('TC-04: BooksPage status tabs support full canonical status taxonomy', () => {
    const booksPagePath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'BooksPage.jsx');
    const content = fs.readFileSync(booksPagePath, 'utf8');

    assert.ok(content.includes("'paused'") || content.includes('"paused"'), 'BooksPage must support paused status');
    assert.ok(content.includes("'dropped'") || content.includes('"dropped"'), 'BooksPage must support dropped status');
    assert.ok(content.includes("'rereading'") || content.includes('"rereading"'), 'BooksPage must support rereading status');
});

test('TC-05: BooksPage and GamesPage cards link to their respective detail pages', () => {
    const booksPagePath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'BooksPage.jsx');
    const gamesPagePath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'GamesPage.jsx');

    const booksContent = fs.readFileSync(booksPagePath, 'utf8');
    const gamesContent = fs.readFileSync(gamesPagePath, 'utf8');

    assert.ok(
        booksContent.includes('/app/books/') || booksContent.includes('`/app/books/${'),
        'Book cards must link or navigate to /app/books/:id'
    );
    assert.ok(
        gamesContent.includes('/app/games/') || gamesContent.includes('`/app/games/${'),
        'Game cards must link or navigate to /app/games/:id'
    );
});

test('TC-06: BookDetailPage component exists with progress, timer, notes, and attempts', () => {
    const detailPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'BookDetailPage.jsx');
    assert.ok(fs.existsSync(detailPath), 'BookDetailPage.jsx must exist');

    const content = fs.readFileSync(detailPath, 'utf8');
    assert.ok(content.includes('DiaryShell'), 'BookDetailPage must be wrapped in DiaryShell');
    assert.ok(content.includes('useParams'), 'BookDetailPage must read book id from router params');
    assert.ok(content.includes('ReadingTimerModal'), 'BookDetailPage must support launching ReadingTimerModal');
    assert.ok(content.includes('getBookPrivateNotes'), 'BookDetailPage must fetch private notes asynchronously');
    assert.ok(content.includes('getReadingSessions'), 'BookDetailPage must fetch reading sessions');
});

test('TC-07: GameDetailPage component exists with playtime card, playthroughs, and notes', () => {
    const detailPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'GameDetailPage.jsx');
    assert.ok(fs.existsSync(detailPath), 'GameDetailPage.jsx must exist');

    const content = fs.readFileSync(detailPath, 'utf8');
    assert.ok(content.includes('DiaryShell'), 'GameDetailPage must be wrapped in DiaryShell');
    assert.ok(content.includes('useParams'), 'GameDetailPage must read game id from router params');
    assert.ok(content.includes('getGamePrivateNotes') || content.includes('getBookPrivateNotes') || content.includes('watchPublicGames'), 'GameDetailPage must load game data');
});
