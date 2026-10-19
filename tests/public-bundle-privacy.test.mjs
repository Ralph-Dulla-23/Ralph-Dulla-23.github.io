import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('TC-01: src/data/books.js must not contain private notes or reading logs in client assets', async () => {
    const booksModulePath = path.join(rootDir, 'src', 'data', 'books.js');
    const { default: books } = await import(pathToFileURL(booksModulePath).href);

    assert.ok(Array.isArray(books), 'books export should be an array');
    assert.equal(books.length, 51, 'books array should retain 51 public books');

    const leakedNotes = books.filter(b => b.privateNotes && b.privateNotes.trim().length > 0);
    assert.equal(
        leakedNotes.length,
        0,
        `Found ${leakedNotes.length} books with privateNotes in src/data/books.js; all private notes must be purged from client assets`
    );

    const leakedLogs = books.filter(b => Array.isArray(b.logs) && b.logs.length > 0);
    assert.equal(
        leakedLogs.length,
        0,
        `Found ${leakedLogs.length} books with logs in src/data/books.js; all reading logs must be purged from client assets`
    );
});

test('TC-02: scripts/legacy-books-archive.json must preserve complete historical notes and logs', () => {
    const archivePath = path.join(rootDir, 'scripts', 'legacy-books-archive.json');
    assert.ok(fs.existsSync(archivePath), 'scripts/legacy-books-archive.json must exist to prevent historical data loss');

    const content = fs.readFileSync(archivePath, 'utf8');
    const archive = JSON.parse(content);

    assert.ok(Array.isArray(archive), 'archive must be an array of books');
    assert.equal(archive.length, 51, 'archive must contain all 51 historical books');

    const booksWithHistory = archive.filter(b => (b.privateNotes && b.privateNotes.trim().length > 0) || (Array.isArray(b.logs) && b.logs.length > 0));
    assert.equal(booksWithHistory.length, 35, 'archive must preserve all 35 books with private notes or logs');
});

test('TC-03: src/lib/db.js buildMergedBooks must omit privateNotes and logs from public projection', () => {
    const dbPath = path.join(rootDir, 'src', 'lib', 'db.js');
    const content = fs.readFileSync(dbPath, 'utf8');

    // Asserts buildMergedBooks explicitly excludes privateNotes and logs
    assert.match(
        content,
        /privateNotes:\s*_pn,\s*logs:\s*_logs/,
        'buildMergedBooks must destructure and strip privateNotes and logs'
    );
});

test('TC-04: production client bundle dist/ must not contain leaked private note contents', () => {
    const distAssetsDir = path.join(rootDir, 'dist', 'assets');
    assert.ok(fs.existsSync(distAssetsDir), 'dist/assets directory must exist after build');

    const jsFiles = fs.readdirSync(distAssetsDir).filter(f => f.endsWith('.js'));
    assert.ok(jsFiles.length > 0, 'dist/assets must contain compiled JS files');

    for (const file of jsFiles) {
        const fileContent = fs.readFileSync(path.join(distAssetsDir, file), 'utf8');
        assert.equal(
            fileContent.includes('Top 1 no doubt'),
            false,
            `Found private note string in production bundle: ${file}`
        );
    }
});

test('TC-05: firestore.rules must enforce isOwner for private subcollections and journal entries', () => {
    const rulesPath = path.join(rootDir, 'firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    // Must protect private book notes
    assert.match(rulesContent, /match\s+\/private\/\{doc\}\s*\{\s*allow read, write:\s*if isOwner\(uid\);/);

    // Must protect journal entries
    assert.match(rulesContent, /match\s+\/journal\/\{entryId\}\s*\{\s*allow read, write:\s*if isOwner\(uid\);/);
});
