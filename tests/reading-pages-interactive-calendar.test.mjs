import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { recordedPages } from '../src/domain/selectors/readingPages.js';
import { buildAdvancedInsights } from '../src/domain/selectors/advancedInsights.js';

test('canonical startPage/endPage contributes verified page count', () => {
 assert.equal(recordedPages({ startPage:26,endPage:43 }),17);
 assert.equal(recordedPages({ fromPage:26,toPage:43 }),17);
 assert.equal(recordedPages({ pagesRead:17,startPage:26,endPage:43 }),17);
 assert.equal(recordedPages({ startPage:43,endPage:26 }),0);
 assert.equal(recordedPages({startPage:0,endPage:43}),43);
 assert.equal(recordedPages({startPage:26,endPage:43,pagesRead:0}),0);
});
test('Insights counts page-only manual sessions without inventing duration', () => {
 const report=buildAdvancedInsights({books:[{id:'b1',title:'Book',status:'reading'}],sessions:[{id:'s1',mediaType:'book',bookId:'b1',startedAt:'2026-10-20T09:00:00+08:00',startPage:26,endPage:43,activeSeconds:0}],today:'2026-10-20'});
 assert.equal(report.activity.days[0]?.pages,17);
 assert.equal(report.activity.days[0]?.readingMinutes,0);
});
test('calendar PNG export is independent of app chrome and notes',()=>{
 const code=fs.readFileSync(new URL('../src/domain/calendarExport.js',import.meta.url),'utf8');
 assert.match(code,/canvas\.toBlob/);
 assert.doesNotMatch(code,/html2canvas|privateNotes|journalEntries/);
});
