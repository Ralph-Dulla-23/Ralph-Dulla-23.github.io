import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('TC-01: db.js exports publishHighlight, unpublishHighlight, and watchPublicHighlights', () => {
    const dbPath = path.join(ROOT_DIR, 'src', 'lib', 'db.js');
    const content = fs.readFileSync(dbPath, 'utf8');

    assert.ok(content.includes('publishHighlight'), 'db.js must export publishHighlight');
    assert.ok(content.includes('unpublishHighlight'), 'db.js must export unpublishHighlight');
    assert.ok(content.includes('watchPublicHighlights'), 'db.js must export watchPublicHighlights');
});

test('TC-02: JournalPage allows sharing/publishing quotes and moments as public highlights', () => {
    const journalPath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'JournalPage.jsx');
    const content = fs.readFileSync(journalPath, 'utf8');

    assert.ok(
        content.includes('publishHighlight') || content.includes('handlePublishHighlight') || content.includes('shareHighlight') || content.includes('isPublic'),
        'JournalPage must allow publishing quotes/moments to public highlights'
    );
});

test('TC-03: HighlightsModal / HighlightCard renders formatted excerpt and item attribution', () => {
    const highlightPath = path.join(ROOT_DIR, 'src', 'components', 'highlights', 'ShareableHighlightModal.jsx');
    assert.ok(fs.existsSync(highlightPath), 'ShareableHighlightModal component must exist');

    const content = fs.readFileSync(highlightPath, 'utf8');
    assert.ok(content.includes('quote') || content.includes('excerpt') || content.includes('body'), 'Must render highlight body');
    assert.ok(content.includes('itemTitle') || content.includes('mediaTitle') || content.includes('title'), 'Must render item title');
});
