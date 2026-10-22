import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (name) => readFileSync(resolve(`src/${name}`), 'utf8');

test('TC-01: Library.jsx uses declarative image fallback without imperative DOM manipulation', () => {
    const library = source('components/Library.jsx');

    // SEC / CODE HYGIENE: Ensure imperative DOM operations are completely removed
    assert.doesNotMatch(
        library,
        /appendChild/,
        'Library.jsx must not call appendChild'
    );
    assert.doesNotMatch(
        library,
        /parentElement/,
        'Library.jsx must not access parentElement'
    );
    assert.doesNotMatch(
        library,
        /document\.createElement/,
        'Library.jsx must not call document.createElement'
    );
    assert.doesNotMatch(
        library,
        /style\.display/,
        'Library.jsx must not directly manipulate element style.display'
    );

    // Declarative React state assertion
    assert.match(
        library,
        /const\s*\[imageError,\s*setImageError\]\s*=\s*useState\(false\)/,
        'Library.jsx subcomponent must maintain declarative imageError state'
    );
    assert.match(
        library,
        /onError=\{.*setImageError\(true\).*\}/,
        'Library.jsx must set imageError state via declarative onError handler'
    );
    assert.match(
        library,
        /text-xs text-secondary dark:text-gray-500 text-center px-2 font-medium/,
        'Library.jsx must render consistent fallback title badge styling'
    );
});

test('TC-02: BookCard.jsx implements declarative onError fallback state and prop synchronization', () => {
    const bookCard = source('components/library/BookCard.jsx');

    assert.match(
        bookCard,
        /import React,\s*\{[^}]*useState[^}]*\}\s*from\s*['"]react['"]/,
        'BookCard.jsx must import useState from React'
    );
    assert.match(
        bookCard,
        /const\s*\[imageError,\s*setImageError\]\s*=\s*useState\(false\)/,
        'BookCard.jsx must track image load failure in state'
    );
    assert.match(
        bookCard,
        /onError=\{.*setImageError\(true\).*\}/,
        'BookCard.jsx img tag must contain declarative onError callback'
    );
    assert.match(
        bookCard,
        /text-sm text-secondary dark:text-gray-500 text-center font-medium/,
        'BookCard.jsx must render book title badge when image fails or is unavailable'
    );
    assert.match(
        bookCard,
        /setImageError\(false\)/,
        'BookCard.jsx must reset imageError state when coverSrc prop changes'
    );
});
