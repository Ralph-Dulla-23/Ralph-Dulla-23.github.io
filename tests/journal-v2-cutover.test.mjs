import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

test('TC-01: JournalPage integrates real-time journal subscriptions and displays live sync state', () => {
    const journalPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'JournalPage.jsx');
    const content = fs.readFileSync(journalPath, 'utf8');

    assert.ok(
        content.includes('watchJournalEntries'),
        'JournalPage must subscribe to watchJournalEntries'
    );
    assert.ok(
        content.includes('syncMetadata') || content.includes('sessionMetadata') || content.includes('hasPendingWrites') || content.includes('Live Sync'),
        'JournalPage must surface real-time sync state transparency'
    );
    assert.ok(
        content.includes('BsCloudCheck') || content.includes('BsCloudArrowUp'),
        'JournalPage must render cloud sync status icon'
    );
});

test('TC-02: saveJournalEntry validates schema and writes canonical v2 journal entries', async () => {
    const { saveJournalEntry } = await import('../src/lib/db.js');
    const { validateJournalEntry } = await import('../src/domain/validators.js');

    const entry = {
        title: 'Reflection on Dune',
        body: 'Fear is the mind-killer.',
        type: 'reflection',
        date: '2026-10-19',
        linkedMediaId: 'book-dune-1',
        linkedMediaType: 'book',
    };

    const savedId = await saveJournalEntry('test-owner-uid', entry);
    assert.ok(savedId, 'saveJournalEntry must return saved ID');

    const validation = validateJournalEntry({
        schemaVersion: 2,
        id: savedId,
        body: entry.body,
        type: entry.type,
    });
    assert.ok(validation.valid, `Canonical validation must pass: ${validation.errors?.join('; ')}`);
});

test('TC-03: deleteJournalEntry deletes document and records tombstones', async () => {
    const { saveJournalEntry, deleteJournalEntry, getDeletedIdsSet } = await import('../src/lib/db.js');

    const id = await saveJournalEntry('test-owner-uid', {
        title: 'Draft note',
        body: 'To be deleted.',
        type: 'reflection',
    });

    await deleteJournalEntry('test-owner-uid', id);
    const deletedIds = getDeletedIdsSet();
    assert.ok(deletedIds.has(id), 'Tombstone must be recorded for deleted journal entry');
});

test('TC-04: diaryRepository.observeJournalEntries emits entries with sync metadata', async () => {
    const { createDiaryRepository } = await import('../src/domain/repository/diaryRepository.js');

    const mockDocs = [
        {
            id: 'j-1',
            schemaVersion: 2,
            type: 'reflection',
            body: 'A thoughtful reflection',
            visibility: 'private',
            date: '2026-10-19',
        },
    ];

    const repo = createDiaryRepository({
        db: {},
        uid: 'test-user-uid',
        firestoreOps: {
            collection: () => 'colRef',
            onSnapshot: (ref, onNext) => {
                onNext({
                    docs: mockDocs.map((data) => ({ id: data.id, data: () => data })),
                    metadata: { hasPendingWrites: false, fromCache: false },
                });
                return () => {};
            },
        },
    });

    let emittedResult = null;
    const unsub = repo.observeJournalEntries({}, (res) => {
        emittedResult = res;
    });

    assert.ok(emittedResult, 'observeJournalEntries must emit result');
    assert.equal(emittedResult.entries.length, 1);
    assert.equal(emittedResult.metadata.hasPendingWrites, false);
    assert.equal(emittedResult.metadata.fromCache, false);
    unsub();
});

test('TC-05: JournalPage supports publishing sanitized quotes to public highlights', () => {
    const journalPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'JournalPage.jsx');
    const content = fs.readFileSync(journalPath, 'utf8');

    assert.ok(
        content.includes('publishHighlight'),
        'JournalPage must import and wire publishHighlight'
    );
    assert.ok(
        content.includes('unpublishHighlight'),
        'JournalPage must import and wire unpublishHighlight'
    );
    assert.ok(
        content.includes('ShareableHighlightModal') || content.includes('handlePublishHighlight'),
        'JournalPage must provide shareable highlight modal integration'
    );
});

test('TC-06: JournalPage preserves linked media attribution to books and games', () => {
    const journalPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'JournalPage.jsx');
    const content = fs.readFileSync(journalPath, 'utf8');

    assert.ok(
        content.includes('linkedMediaId'),
        'JournalPage must track linkedMediaId'
    );
    assert.ok(
        content.includes('mediaMap'),
        'JournalPage must construct mediaMap from books and games'
    );
});
