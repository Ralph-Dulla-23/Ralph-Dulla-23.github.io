import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import of target domain modules
const parserUrl = pathToFileURL(path.resolve(__dirname, '../src/domain/bookmoryParser.js')).href;
const migrationUrl = pathToFileURL(path.resolve(__dirname, '../src/domain/migrationEngine.js')).href;
const validatorsUrl = pathToFileURL(path.resolve(__dirname, '../src/domain/validators.js')).href;

function readFixture(name) {
    return fs.readFileSync(path.resolve(__dirname, 'fixtures/bookmory', name), 'utf8');
}

test('TC-01: Pure parser parses standard Bookmory Markdown into canonical v2 entities', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { validateLibraryItem, validateAttempt, validateHistoricalAggregate } = await import(validatorsUrl);

    const md = readFixture('standard-book.md');
    const result = parseBookmoryMarkdownPure(md);

    assert.ok(result, 'Parser should return a result object');
    assert.equal(result.item.title, 'A Curse for True Love');
    assert.deepEqual(result.item.creators, ['Stephanie Garber']);
    assert.equal(result.item.mediaType, 'book');
    assert.equal(result.item.status, 'completed');
    assert.equal(result.item.progress.total, 400);
    assert.equal(result.item.progress.current, 400);
    assert.equal(result.item.rating, 5);
    assert.equal(result.item.favorite, true);

    // Validate using canonical v2 validators
    const itemValidation = validateLibraryItem(result.item);
    assert.equal(itemValidation.valid, true, `Item validation failed: ${itemValidation.errors?.join(', ')}`);

    assert.equal(result.attempts.length, 1);
    assert.equal(result.attempts[0].status, 'completed');
    assert.equal(result.attempts[0].completedOn, '2026-01-18');
    const attemptValidation = validateAttempt(result.attempts[0]);
    assert.equal(attemptValidation.valid, true, `Attempt validation failed: ${attemptValidation.errors?.join(', ')}`);

    assert.equal(result.historicalAggregates.length, 1);
    assert.equal(result.historicalAggregates[0].isDailySession, false);
    assert.equal(result.historicalAggregates[0].totalMinutes, 74);
    assert.equal(result.historicalAggregates[0].dateRange.start, '2026-01-18');
    assert.equal(result.historicalAggregates[0].dateRange.end, '2026-01-18');
    const aggValidation = validateHistoricalAggregate(result.historicalAggregates[0]);
    assert.equal(aggValidation.valid, true, `Aggregate validation failed: ${aggValidation.errors?.join(', ')}`);
});

test('TC-02: Unknown / missing total pages in Bookmory markdown resolve to null (DATA-03)', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { validateLibraryItem } = await import(validatorsUrl);

    const md = readFixture('missing-pages.md');
    const result = parseBookmoryMarkdownPure(md);

    assert.equal(result.item.progress.total, null, 'Missing page count MUST be null, never 350');
    assert.equal(result.item.progress.current, 0);
    const validation = validateLibraryItem(result.item);
    assert.equal(validation.valid, true, `Validation failed: ${validation.errors?.join(', ')}`);
});

test('TC-03: Multi-day reading periods convert to HistoricalAggregate with isDailySession: false (DATA-05, DATA-06)', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { validateHistoricalAggregate } = await import(validatorsUrl);

    const md = readFixture('range-log.md');
    const result = parseBookmoryMarkdownPure(md);

    assert.equal(result.historicalAggregates.length, 1);
    const agg = result.historicalAggregates[0];
    assert.equal(agg.isDailySession, false);
    assert.equal(agg.totalMinutes, 1636); // 27h 16m = 27*60 + 16 = 1636
    assert.equal(agg.dateRange.start, '2025-11-19');
    assert.equal(agg.dateRange.end, '2025-12-02');
    assert.equal(agg.provenance.source, 'bookmory');
    const validation = validateHistoricalAggregate(agg);
    assert.equal(validation.valid, true, `Validation failed: ${validation.errors?.join(', ')}`);
});

test('TC-04: Reading log comments and reviews are preserved privately as JournalEntry (SEC-01)', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { validateJournalEntry } = await import(validatorsUrl);

    const md = readFixture('standard-book.md');
    const result = parseBookmoryMarkdownPure(md);

    assert.equal(result.journalEntries.length, 1);
    const entry = result.journalEntries[0];
    assert.equal(entry.visibility, 'private');
    assert.equal(entry.body, 'Magical ending to the trilogy!');
    assert.equal(entry.linkedMediaId, result.item.id);
    assert.equal(entry.provenance.source, 'bookmory');
    const validation = validateJournalEntry(entry);
    assert.equal(validation.valid, true, `Validation failed: ${validation.errors?.join(', ')}`);
});

test('TC-05: Normalized statuses correctly map all Bookmory states (DATA-08)', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);

    const droppedMd = readFixture('dropped-book.md');
    const droppedResult = parseBookmoryMarkdownPure(droppedMd);
    assert.equal(droppedResult.item.status, 'dropped');
    assert.equal(droppedResult.attempts[0].status, 'abandoned');

    const readingMd = readFixture('missing-pages.md');
    const readingResult = parseBookmoryMarkdownPure(readingMd);
    assert.equal(readingResult.item.status, 'reading');
    assert.equal(readingResult.attempts[0].status, 'in_progress');

    const multiLogMd = readFixture('multi-log-reread.md');
    const multiResult = parseBookmoryMarkdownPure(multiLogMd);
    assert.equal(multiResult.item.status, 'completed');
    assert.equal(multiResult.attempts.length, 2, 'Two reading logs should generate 2 attempts');
    assert.equal(multiResult.historicalAggregates.length, 1, 'Only logs with minutes > 0 generate historical aggregates');
    assert.equal(multiResult.historicalAggregates[0].totalMinutes, 274); // 4h 34m = 274 min
});

test('TC-06: Dry-run preview engine previewMigrationBatch produces structured report with zero mutations', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { previewMigrationBatch } = await import(migrationUrl);

    const candidates = [
        parseBookmoryMarkdownPure(readFixture('standard-book.md')),
        parseBookmoryMarkdownPure(readFixture('missing-pages.md')),
        parseBookmoryMarkdownPure(readFixture('range-log.md')),
    ];

    const existingState = { items: [], attempts: [], historicalAggregates: [], journalEntries: [] };
    const report = previewMigrationBatch(candidates, existingState);

    assert.equal(report.summary.totalCandidates, 3);
    assert.equal(report.summary.additions, 3);
    assert.equal(report.summary.duplicates, 0);
    assert.equal(report.summary.updates, 0);
    assert.equal(report.stagedEntities.items.length, 3);
    assert.equal(report.stagedEntities.historicalAggregates.length, 3); // standard (1) + missing-pages (1) + range-log (1)
    assert.equal(report.stagedEntities.journalEntries.length, 3);
    assert.ok(report.warnings.some(w => w.code === 'UNKNOWN_TOTAL_PAGES'));
    assert.equal(existingState.items.length, 0, 'Existing state must NOT be mutated in dry-run');
});

test('TC-07: Duplicate detection flags matching items and avoids creating extra records (DATA-01)', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { previewMigrationBatch } = await import(migrationUrl);

    const standard = parseBookmoryMarkdownPure(readFixture('standard-book.md'));

    // Existing state already has this item
    const existingState = {
        items: [standard.item],
        attempts: standard.attempts,
        historicalAggregates: standard.historicalAggregates,
        journalEntries: standard.journalEntries,
    };

    const report = previewMigrationBatch([standard], existingState);
    assert.equal(report.summary.totalCandidates, 1);
    assert.equal(report.summary.duplicates, 1);
    assert.equal(report.summary.additions, 0);
    assert.equal(report.stagedEntities.items.length, 0, 'No duplicate item should be staged');
    assert.equal(report.stagedEntities.historicalAggregates.length, 0, 'No duplicate aggregate should be staged');
});

test('TC-08: Collision detection identifies metadata discrepancies', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { detectCollisions } = await import(migrationUrl);

    const candidate = parseBookmoryMarkdownPure(readFixture('standard-book.md'));
    const conflictingItem = {
        ...candidate.item,
        status: 'reading',
        isbn: '9789999999999', // Different ISBN for same title
    };

    const collisions = detectCollisions(candidate, conflictingItem);
    assert.ok(collisions.length > 0, 'Should detect collisions for conflicting status and ISBN');
    assert.ok(collisions.some(c => c.field === 'isbn'));
    assert.ok(collisions.some(c => c.field === 'status'));
});

test('TC-09: Identifies legacy synthetic sessions and prevents double counting', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { previewMigrationBatch } = await import(migrationUrl);

    const standard = parseBookmoryMarkdownPure(readFixture('standard-book.md'));
    const existingState = {
        items: [{ ...standard.item }],
        attempts: [],
        historicalAggregates: [],
        sessions: [
            {
                id: `bookmory_${standard.item.id}_1`,
                startedAt: '2026-01-18T12:00:00.000Z',
                minutes: 74,
            }
        ],
        journalEntries: [],
    };

    const report = previewMigrationBatch([standard], existingState);
    assert.ok(report.legacySessionsSuperseded > 0, 'Should record superseded legacy sessions');
});

test('TC-10: Rollback manifest generates deterministic pre-migration snapshot metadata', async () => {
    const { parseBookmoryMarkdownPure } = await import(parserUrl);
    const { previewMigrationBatch, generateRollbackManifest } = await import(migrationUrl);

    const candidates = [parseBookmoryMarkdownPure(readFixture('standard-book.md'))];
    const existingState = { items: [], attempts: [], historicalAggregates: [], journalEntries: [] };
    const report = previewMigrationBatch(candidates, existingState);

    const manifest = generateRollbackManifest(report, existingState);
    assert.ok(manifest.timestamp, 'Manifest should have a timestamp');
    assert.equal(manifest.schemaVersion, 2);
    assert.deepEqual(manifest.affectedEntityIds.items, [candidates[0].item.id]);
    assert.equal(manifest.rollbackActions.length, 1);
    assert.equal(manifest.rollbackActions[0].action, 'delete');
});
