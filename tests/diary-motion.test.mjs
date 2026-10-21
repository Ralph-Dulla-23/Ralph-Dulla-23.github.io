import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getCircularRevealGeometry } from '../src/components/motion/revealGeometry.js';

function get(path) { return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'); }

test('circular reveal covers all viewport corners from a bottom timer trigger', () => {
  const w = 390; const h = 844;
  const { x, y, radius, closed, open } = getCircularRevealGeometry({ x: 195, y: 750 }, w, h);
  assert.equal(x, 195);
  assert.equal(y, 750);
  assert.match(closed, /^circle\(0px at/);
  assert.match(open, /^circle\(\d+px at/);
  for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
    assert.ok(radius >= Math.hypot(cx - x, cy - y), `corner ${cx},${cy} uncovered`);
  }
});

test('circular reveal clamps invalid/outside origins and has safe fallback for card entry', () => {
  const outside = getCircularRevealGeometry({ x: -400, y: 9999 }, 390, 844);
  assert.equal(outside.x, 0);
  assert.equal(outside.y, 844);
  const fallback = getCircularRevealGeometry(null, 390, 844);
  assert.equal(fallback.x, 195);
  assert.ok(fallback.y > 600, 'new timer entry should originate near bottom');
});

test('mini timer is a keyboard-accessible trigger and stays behind closing reveal', () => {
  const tray = get('src/components/timer/ActiveTimerTray.jsx');
  assert.match(tray, /data-active-timer-tray/);
  assert.match(tray, /<button type="button" className="flex items-center/);
  assert.match(tray, /getBoundingClientRect\(\)/);
  assert.match(tray, /inert=\{focusVisible\}/);
  assert.doesNotMatch(tray, /\|\| focusVisible \|\|/);
});

test('focus timer does circular open/close without changing elapsed time state', () => {
  const hook = get('src/components/motion/useCircularReveal.js');
  const screen = get('src/components/reading/ImmersiveReadingTimer.jsx');
  assert.match(hook, /transform:.*scale\(/);
  assert.match(hook, /circle\.animate/);
  assert.doesNotMatch(hook, /clipPath:/, 'Avoid full-screen clip-path repaint during circular reveal');
  assert.match(hook, /prefers-reduced-motion/);
  assert.match(screen, /closeWithReveal/);
  assert.match(screen, /focusOrigin/);
  assert.match(screen, /mediaType === 'book'/);
});

test('motion styles use reduced-motion fallbacks and finite animations', () => {
  const css = get('src/index.css');
  for (const name of ['diary-focus-appear', 'diary-mini-arrive', 'diary-result-enter', 'diary-month-backward-frames', 'diary-month-forward-frames']) {
    assert.ok(css.includes(name));
  }
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(css.slice(css.indexOf('2026 DIARY MOTION')), /animation:\s*[^;]+infinite/);
});
