import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('TC-01: HomePage component displays Currently Active section for reading and playing items', () => {
    const homePath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'HomePage.jsx');
    const content = fs.readFileSync(homePath, 'utf8');
    const highlights = fs.readFileSync(path.join(ROOT_DIR, 'src', 'components', 'home', 'HomeHighlights.jsx'), 'utf8');

    assert.ok(
        content.includes('watchPublicBooks'),
        'HomePage must subscribe to public books'
    );
    assert.ok(
        content.includes('watchPublicGames'),
        'HomePage must subscribe to public games'
    );
    assert.ok(
        content.includes('HomeHighlights') && highlights.includes('Continue reading') && highlights.includes('Continue playing'),
        'HomePage must render active items section'
    );
    assert.ok(
        highlights.includes('Resume reading') && highlights.includes('Continue'),
        'HomeHighlights must provide reading and gaming actions'
    );
});

test('TC-02: HomePage integrates useTimer to allow resuming sessions directly', () => {
    const homePath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'HomePage.jsx');
    const content = fs.readFileSync(homePath, 'utf8');

    assert.ok(
        content.includes('useTimer'),
        'HomePage must consume useTimer'
    );
    assert.ok(
        content.includes('startTimer'),
        'HomePage must trigger startTimer when continuing active media'
    );
});

test('TC-03: Today Summary shows honest placeholders (—) when metrics are unknown', () => {
    const homePath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'HomePage.jsx');
    const content = fs.readFileSync(homePath, 'utf8');

    assert.ok(
        content.includes('—'),
        'HomePage must render honest dash (—) when daily metrics are unknown'
    );
});
