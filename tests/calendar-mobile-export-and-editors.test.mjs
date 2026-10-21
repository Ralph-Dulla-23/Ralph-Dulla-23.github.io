import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src = file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
test('calendar exports PNG through native Capacitor cache+share on phones', () => {
  const file = src('services/calendarDownload.js');
  assert.match(file, /Capacitor\.isNativePlatform\(\)/);
  assert.match(file, /@capacitor\/filesystem/);
  assert.match(file, /@capacitor\/share/);
  assert.match(file, /files:\s*\[uri\]/);
  assert.match(file, /Directory\.Documents/);
});
test('calendar image generation is deduplicated and async per cover instead of per day', () => {
  const file = src('domain/calendarExport.js');
  assert.match(file, /const urls = \[\.\.\.uniqueUrls\]/);
  assert.match(file, /await Promise\.all\(Array\.from/);
  assert.match(file, /saveCalendarPng/);
  assert.doesNotMatch(file, /link\.click\(\)/);
});
test('calendar has feedback and designed export dropdowns', () => {
  const file = src('pages/app/CalendarPage.jsx');
  assert.match(file, /Download PNG/);
  assert.match(file, /setExportError/);
  assert.match(file, /setExportNotice/);
  assert.match(file, /<DiarySelect label="Calendar image size"/);
  assert.match(file, /<DiarySelect label="Calendar theme"/);
});
test('book and game editors use portal with separately scrolling content and persistent save footer', () => {
  const component = src('components/ui/DiaryEditorModal.jsx');
  assert.match(component, /createPortal\(/);
  assert.match(component, /diary-editor-scroll/);
  assert.match(component, /diary-editor-footer/);
  for (const [name, id] of [['BooksPage', 'book'], ['GamesPage','game']]) {
    const f=src(`pages/app/${name}.jsx`);
    assert.match(f, /<DiaryEditorModal/);
    assert.ok(f.includes(`form="${id}-editor-form"`));
    assert.ok(f.includes(`id="${id}-editor-form"`));
    assert.doesNotMatch(f, /className="sticky bottom-0 z-10 -mx-5 mt-5/);
  }
});
test('all source JSX dropdowns use reusable designed selects', () => {
  const files=['pages/app/BooksPage.jsx','pages/app/GamesPage.jsx','pages/app/BookDetailPage.jsx','pages/app/GameDetailPage.jsx','pages/app/JournalPage.jsx','pages/app/CalendarPage.jsx','components/diary/AdvancedInsights.jsx'];
  for(const f of files) {
    assert.match(src(f), /<DiarySelect/);
    assert.doesNotMatch(src(f), /<select\b/);
  }
  assert.match(src('components/ui/DiarySelect.jsx'), /aria-haspopup="listbox"/);
  assert.match(src('components/ui/DiarySelect.jsx'), /createPortal\(/);
});
