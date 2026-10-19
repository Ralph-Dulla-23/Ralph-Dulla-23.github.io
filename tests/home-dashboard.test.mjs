import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

test('TC-01: HomePage component displays Currently Active section for reading and playing items', () => {
    const homePath = path.join(ROOT_DIR, 'src', 'pages', 'app', 'HomePage.jsx');
    const content = fs.readFileSync(homePath, 'utf8');

    assert.ok(
        content.includes('watchPublicBooks'),
        'HomePage must subscribe to public books'
    );
    assert.ok(
        content.includes('watchPublicGames'),
        'HomePage must subscribe to public games'
    );
    assert.ok(
        content.includes('Currently Active') || content.includes('Continue Reading') || content.includes('Currently Reading'),
        'HomePage must render active items section'
    );
    assert.ok(
        content.includes('Continue'),
        'HomePage must provide Continue action button on active media'
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
