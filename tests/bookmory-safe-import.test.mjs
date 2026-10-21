import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parserUrl = pathToFileURL(path.resolve(__dirname, '../src/domain/bookmoryParser.js')).href;
const migrationUrl = pathToFileURL(path.resolve(__dirname, '../src/domain/migrationEngine.js')).href;
const booksPagePath = path.resolve(__dirname, '../src/pages/app/BooksPage.jsx');

function readFixture(name) {
    return fs.readFileSync(path.resolve(__dirname, 'fixtures/bookmory', name), 'utf8');
}

test('TC-01: BooksPage provides import trigger wired to dry-run preview flow without immediate writes', async () => {
    const content = fs.readFileSync(booksPagePath, 'utf8');

    // Must have preview modal / preview state
    assert.ok(
        content.includes('importPreview') || content.includes('previewBatch') || content.includes('migrationPreview'),
        'BooksPage must maintain dry-run import preview state'
    );
    assert.ok(
        content.includes('previewMigrationBatch'),
        'BooksPage must import and call previewMigrationBatch for dry-run calculations'
    );
    // Must contain interactive preview confirmation dialog
    assert.ok(
        content.includes('Confirm Import') || content.includes('Execute Import') || content.includes('Start Import') || (content.includes('BookmoryImportPreview') && content.includes('onConfirm={handleConfirmImport}')),
        'BooksPage must provide explicit user confirmation before executing import'
    );
});

test('TC-02: executeMigrationBatch writes staged entities and returns migration summary', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { previewMigrationBatch, executeMigrationBatch } = await import(migrationUrl);

    assert.equal(
        typeof executeMigrationBatch,
        'function',
        'migrationEngine must export executeMigrationBatch function'
    );

    const standard = parseBookmoryMarkdownPure(readFixture('standard-book.md'));
    const preview = previewMigrationBatch([standard], { items: [], historicalAggregates: [], sessions: [] });

    const writes = {
        items: [],
        attempts: [],
        historicalAggregates: [],
        journalEntries: [],
    };

    const mockRepo = {
        saveLibraryItem: async (item) => writes.items.push(item),
        createAttempt: async (attempt) => writes.attempts.push(attempt),
        createHistoricalAggregate: async (agg) => writes.historicalAggregates.push(agg),
        createJournalEntry: async (entry) => writes.journalEntries.push(entry),
    };

    const result = await executeMigrationBatch({
        uid: 'test-user-1',
        previewReport: preview,
        repository: mockRepo,
    });

    assert.equal(result.success, true);
    assert.equal(result.importedCount, 1);
    assert.equal(writes.items.length, 1);
    assert.equal(writes.items[0].title, 'A Curse for True Love');
    assert.equal(writes.historicalAggregates.length, 1);
    assert.equal(writes.historicalAggregates[0].isDailySession, false);
    assert.equal(writes.journalEntries.length, 1);
    assert.equal(writes.journalEntries[0].visibility, 'private');
    assert.ok(result.rollbackManifest, 'executeMigrationBatch must produce a rollback manifest');
});

test('TC-03: Re-importing identical candidates results in 0 staged entities and zero writes (Idempotency)', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { previewMigrationBatch, executeMigrationBatch } = await import(migrationUrl);

    const standard = parseBookmoryMarkdownPure(readFixture('standard-book.md'));

    // Simulate state after first import
    const existingState = {
        items: [standard.item],
        attempts: standard.attempts,
        historicalAggregates: standard.historicalAggregates,
        journalEntries: standard.journalEntries,
        sessions: [],
    };

    const secondPreview = previewMigrationBatch([standard], existingState);
    assert.equal(secondPreview.summary.totalCandidates, 1);
    assert.equal(secondPreview.summary.duplicates, 1);
    assert.equal(secondPreview.summary.additions, 0);
    assert.equal(secondPreview.summary.updates, 0);
    assert.equal(secondPreview.stagedEntities.items.length, 0);
    assert.equal(secondPreview.stagedEntities.historicalAggregates.length, 0);

    const writes = { items: [], historicalAggregates: [] };
    const mockRepo = {
        saveLibraryItem: async (item) => writes.items.push(item),
        createHistoricalAggregate: async (agg) => writes.historicalAggregates.push(agg),
    };

    const secondResult = await executeMigrationBatch({
        uid: 'test-user-1',
        previewReport: secondPreview,
        repository: mockRepo,
    });

    assert.equal(secondResult.success, true);
    assert.equal(secondResult.importedCount, 0);
    assert.equal(writes.items.length, 0, 'Zero writes must occur on duplicate re-import');
    assert.equal(writes.historicalAggregates.length, 0, 'Zero aggregates must be written on duplicate re-import');
});

test('TC-04: Missing total page count preserved as null through preview and execution (DATA-03)', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { previewMigrationBatch, executeMigrationBatch } = await import(migrationUrl);

    const missingPages = parseBookmoryMarkdownPure(readFixture('missing-pages.md'));
    const preview = previewMigrationBatch([missingPages], { items: [], historicalAggregates: [] });

    assert.equal(preview.stagedEntities.items[0].progress.total, null, 'Must preserve null total pages');

    const writtenItems = [];
    const mockRepo = {
        saveLibraryItem: async (item) => writtenItems.push(item),
        createAttempt: async () => {},
        createHistoricalAggregate: async () => {},
        createJournalEntry: async () => {},
    };

    await executeMigrationBatch({
        uid: 'test-user-1',
        previewReport: preview,
        repository: mockRepo,
    });

    assert.equal(writtenItems[0].progress.total, null, 'Saved item must retain null pages');
});

test('TC-05: Multi-day aggregates marked isDailySession: false to preserve calendar integrity (DATA-05)', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { previewMigrationBatch, executeMigrationBatch } = await import(migrationUrl);

    const rangeLog = parseBookmoryMarkdownPure(readFixture('range-log.md'));
    const preview = previewMigrationBatch([rangeLog], { items: [], historicalAggregates: [] });

    const writtenAggs = [];
    const mockRepo = {
        saveLibraryItem: async () => {},
        createAttempt: async () => {},
        createHistoricalAggregate: async (agg) => writtenAggs.push(agg),
        createJournalEntry: async () => {},
    };

    await executeMigrationBatch({
        uid: 'test-user-1',
        previewReport: preview,
        repository: mockRepo,
    });

    assert.equal(writtenAggs.length, 1);
    assert.equal(writtenAggs[0].isDailySession, false, 'Historical aggregate must not be daily session');
    assert.equal(writtenAggs[0].dateRange.start, '2025-11-19');
    assert.equal(writtenAggs[0].dateRange.end, '2025-12-02');
});

test('TC-06: Reading reviews preserved as private JournalEntry records (SEC-01)', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { previewMigrationBatch, executeMigrationBatch } = await import(migrationUrl);

    const standard = parseBookmoryMarkdownPure(readFixture('standard-book.md'));
    const preview = previewMigrationBatch([standard], { items: [], historicalAggregates: [] });

    const writtenJournal = [];
    const mockRepo = {
        saveLibraryItem: async () => {},
        createAttempt: async () => {},
        createHistoricalAggregate: async () => {},
        createJournalEntry: async (j) => writtenJournal.push(j),
    };

    await executeMigrationBatch({
        uid: 'test-user-1',
        previewReport: preview,
        repository: mockRepo,
    });

    assert.equal(writtenJournal.length, 1);
    assert.equal(writtenJournal[0].visibility, 'private');
    assert.equal(writtenJournal[0].body, 'Magical ending to the trilogy!');
    assert.equal(writtenJournal[0].linkedMediaId, standard.item.id);
});
