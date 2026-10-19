import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('TC-01: BooksPage must not contain automatic seedExistingBooks mount effect or imports', () => {
    const booksPagePath = path.join(rootDir, 'src', 'pages', 'app', 'BooksPage.jsx');
    const content = fs.readFileSync(booksPagePath, 'utf8');

    // 1. Must not import seedExistingBooks
    const importsSeedExistingBooks = /import\s*\{[^}]*seedExistingBooks[^}]*\}\s*from/.test(content);
    assert.equal(
        importsSeedExistingBooks,
        false,
        'BooksPage.jsx should not import seedExistingBooks from db.js'
    );

    // 2. Must not invoke seedExistingBooks
    const callsSeedExistingBooks = /\bseedExistingBooks\s*\(/.test(content);
    assert.equal(
        callsSeedExistingBooks,
        false,
        'BooksPage.jsx should not invoke seedExistingBooks'
    );

    // 3. Must not check diary_auto_synced_51_books_v2 in an auto-sync effect
    const hasAutoSyncKey = /diary_auto_synced_51_books_v2/.test(content);
    assert.equal(
        hasAutoSyncKey,
        false,
        'BooksPage.jsx should not use diary_auto_synced_51_books_v2 to trigger auto-seeding on mount'
    );
});

test('TC-03 & TC-04: db.js preserves exportUserData and downloadJsonBackup for safe backup', async () => {
    const dbPath = path.join(rootDir, 'src', 'lib', 'db.js');
    const content = fs.readFileSync(dbPath, 'utf8');

    // Must export exportUserData
    assert.match(
        content,
        /export\s+(async\s+)?function\s+exportUserData\b/,
        'db.js must export exportUserData function'
    );

    // Must export downloadJsonBackup
    assert.match(
        content,
        /export\s+(async\s+)?function\s+downloadJsonBackup\b/,
        'db.js must export downloadJsonBackup function'
    );
});
