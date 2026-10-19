import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('Phase 4 Exit Gate - P4-01: Approved public shelves projection is verified', () => {
    const rulesPath = path.join(ROOT_DIR, 'firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf8');
    assert.ok(rules.includes('publicProfiles'), 'Firestore rules must define publicProfiles path');

    const dbPath = path.join(ROOT_DIR, 'src', 'lib', 'db.js');
    const dbContent = fs.readFileSync(dbPath, 'utf8');
    assert.ok(dbContent.includes('publishLibraryItem'), 'db.js must support publishLibraryItem');
    assert.ok(dbContent.includes('unpublishLibraryItem'), 'db.js must support unpublishLibraryItem');
});

test('Phase 4 Exit Gate - P4-02: Shareable highlights and excerpts supported', () => {
    const dbPath = path.join(ROOT_DIR, 'src', 'lib', 'db.js');
    const dbContent = fs.readFileSync(dbPath, 'utf8');
    assert.ok(dbContent.includes('publishHighlight'), 'db.js must support publishHighlight');
    assert.ok(dbContent.includes('watchPublicHighlights'), 'db.js must support watchPublicHighlights');
});

test('Phase 4 Exit Gate - Public Shelf & Portfolio Invariant', () => {
    const libraryPath = path.join(ROOT_DIR, 'src', 'components', 'Library.jsx');
    const content = fs.readFileSync(libraryPath, 'utf8');
    assert.ok(!content.includes('privateNotes'), 'Public library component must never render privateNotes');
});
