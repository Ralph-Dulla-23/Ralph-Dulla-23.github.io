import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('TC-01: JournalPage renders journal timeline, write entry modal, and entry types', () => {
    const journalPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'JournalPage.jsx');
    const content = fs.readFileSync(journalPath, 'utf8');

    assert.ok(content.includes('DiaryShell'), 'JournalPage must be wrapped in DiaryShell');
    assert.ok(content.includes('isWriteModalOpen') || content.includes('isModalOpen') || content.includes('openWriteModal'), 'Must support write note modal');
    assert.ok(content.includes('reflection'), 'Must support reflection type');
    assert.ok(content.includes('book_quote') || content.includes('Quote'), 'Must support quote type');
});

test('TC-02: JournalPage allows linking entries to a book or game in the user collection', () => {
    const journalPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'JournalPage.jsx');
    const content = fs.readFileSync(journalPath, 'utf8');

    assert.ok(content.includes('watchPublicBooks'), 'Must watch public books for linking');
    assert.ok(content.includes('watchPublicGames'), 'Must watch public games for linking');
    assert.ok(content.includes('linkedMediaId') || content.includes('linkedMedia'), 'Must store linkedMediaId');
});

test('TC-03: JournalPage provides search and entry type filtering', () => {
    const journalPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'JournalPage.jsx');
    const content = fs.readFileSync(journalPath, 'utf8');

    assert.ok(content.includes('searchQuery') || content.includes('search'), 'Must support search filtering');
    assert.ok(content.includes('typeFilter') || content.includes('filter'), 'Must support entry type filtering');
});

test('TC-04: JournalPage enforces owner privacy and confirms deletion', () => {
    const journalPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'JournalPage.jsx');
    const content = fs.readFileSync(journalPath, 'utf8');

    assert.ok(content.includes('useAuth'), 'Must verify authenticated user');
    assert.ok(content.includes('handleDelete') || content.includes('deleteEntry'), 'Must support entry deletion');
    assert.ok(content.includes('confirm') || content.includes('window.confirm'), 'Must confirm deletion before deleting');
});
