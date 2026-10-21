import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');

test('calendar social renderer generates all sizes using actual dates and does not include diary chrome', async () => {
  const textCalls = [], sizes = [];
  const ctx = new Proxy({
    createLinearGradient: () => ({addColorStop(){}}),
    fillText: (str) => textCalls.push(String(str)),
  }, { get(o,k) { return k in o ? o[k] : (() => {}); }, set(o,k,v) { o[k]=v; return true; } });
  const source = read('domain/calendarExport.js')
    .replace(/^import .*;\s*$/gm, '')
    .replace(/export async function/g, 'async function');
  const context = { Blob, Date, Map, String, Number, Math, Promise, Set, console,
    setTimeout, registerPlugin:()=>({}), Capacitor:{isNativePlatform:()=>false},
    document:{createElement:()=>({getContext:()=>ctx, toBlob:cb=>cb(new Blob(['fake-png'])), set width(w){sizes.push(w);}, set height(h){sizes.push(h);} })}
  };
  vm.runInNewContext(`${source}\nthis.renderCalendarPng = renderCalendarPng;`,context);
  const day = [{itemId:'a',itemTitle:'Book',pagesRead:17,mediaType:'book'}];
  const activities = new Map([['2026-10-20',day]]);
  for(const ratio of ['1:1','4:5','9:16']) {
    const result = await context.renderCalendarPng({year:2026,month:9,sessionsByDate:activities,ratio,background:'sunset'});
    assert.ok(result.size>0);
  }
  assert.deepEqual(sizes,[1080,1080,1080,1350,1080,1920]);
  assert.ok(textCalls.includes('October 2026'));
  assert.ok(textCalls.includes('01'));
  assert.ok(textCalls.some(x=>x.includes('THE MONTH IN STORIES')));
  assert.ok(!textCalls.some(x=>x.includes('Private notes') || x.includes('Sign out')));
});

test('Book and Game editors provide discard guard and import preview uses same portal', () => {
  for(const name of ['BooksPage','GamesPage']) {
    const src=read(`pages/app/${name}.jsx`);
    assert.match(src,/useEditorDraftGuard/);
    assert.match(src,/ConfirmDiscardDialog/);
    assert.match(src,/draftGuard\.requestClose/);
  }
  assert.match(read('pages/app/BooksPage.jsx'),/BookmoryImportPreview/);
  assert.match(read('components/diary/BookmoryImportPreview.jsx'),/DiaryEditorModal/);
});

test('Android save + private cache enforce MediaStore and source restrictions',()=>{
  const service = read('services/calendarDownload.js');
  const domain = read('domain/calendarExport.js');
  assert.match(service,/DiaryMediaStore\.savePng/);
  assert.match(domain,/PrivateCoverCache\.getCover/);
  const native = fs.readFileSync(new URL('../android/app/src/main/java/com/ralph/diary/DiaryMediaStorePlugin.java',import.meta.url),'utf8');
  assert.match(native,/MediaStore\.Downloads/);
  assert.match(native,/MediaStore\.Images/);
  assert.match(native,/getCacheDir\(\)/);
  assert.match(native,/"https"\.equalsIgnoreCase/);
});

test('Firestore diagnostics and pull safety preserve pending edits',()=>{
  const db = read('lib/db.js');
  assert.match(db,/if \(localBooks\[id\]\?\._syncPending\)/);
  assert.match(db,/if \(localGames\[id\]\?\._syncPending\)/);
  const rule = fs.readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');
  assert.match(rule,/match \/goals\/\{goalId\}/);
  assert.match(read('lib/firebaseAccessCheck.js'),/getDocsFromServer/);
});
