import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiaryRestorePlan } from '../src/services/diaryRestore.js';
import { previewLegacySessionMigration } from '../src/domain/legacySessionMigration.js';
import { previewMigrationBatch } from '../src/domain/migrationEngine.js';
import { filterSessionsByTimeRange } from '../src/domain/selectors/insightsSelectors.js';
import { calculatePremiumBookInsights } from '../src/domain/selectors/premiumInsights.js';
import { buildRewindSvg } from '../src/domain/rewindCard.js';
import { reconcileBookmoryHistoricalTime } from '../src/domain/selectors/reconcileHistoricalTime.js';

const uid = 'owner_test_uid';
function backup(overrides = {}) {
  return {version:'2.0',uid,isCloudComplete:true,books:[{id:'b1',title:'Book',privateNotes:'private',sessions:[{id:'s1',startedAt:'2026-10-20T01:00:00Z'}]}],games:[{id:'g1',title:'Game',privateReview:'secret'}],canonicalData:{goals:[{id:'main',yearlyBooks:20}],journal:[{id:'j1',body:'legacy note'}],sessions:[{id:'s2',libraryItemId:'b1'}]},nestedData:{books:{b1:{private:[{id:'notes',notes:'cloud note'}],sessions:[{id:'s1',startedAt:'2026-10-20T01:00:00Z'}]}}},publicData:{shelf:[{id:'b1',title:'Book'}]},...overrides};
}
test('P0 backup restore includes goals and legacy journal but not public shelf by default', () => {
  const plan = buildDiaryRestorePlan(backup(),uid);
  assert.ok(plan.documents.some(d=>d.path===`users/${uid}/goals/main`));
  assert.ok(plan.documents.some(d=>d.path===`users/${uid}/journal/j1`));
  assert.ok(plan.documents.some(d=>d.path===`users/${uid}/books/b1/private/notes`));
  assert.equal(plan.documents.filter(d=>d.path.endsWith('/sessions/s1')).length,1);
  assert.equal(plan.documents.some(d=>d.path.includes('publicProfiles')),false);
  assert.equal(plan.documents.find(d=>d.path.endsWith('/private/notes')).data.notes,'cloud note');
});
test('P0 backup restore rejects owner mismatch, partial backup and forged path',()=>{
  assert.throws(()=>buildDiaryRestorePlan(backup(),'someone_else'),/owner UID/);
  assert.throws(()=>buildDiaryRestorePlan(backup({isCloudComplete:false}),uid),/partial/);
  assert.throws(()=>buildDiaryRestorePlan(backup({books:[{id:'../../root'}]}),uid),/Invalid/);
});
test('P0 restoring published shelves requires separate opt-in',()=>{
  const plan = buildDiaryRestorePlan(backup(),uid,{includePublic:true});
  assert.ok(plan.documents.some(d=>d.path===`publicProfiles/${uid}/shelf/b1`));
});
test('P1 legacy migrator excludes undated aggregates and already canonical sessions',()=>{
  const rows=[
    {id:'legacy1',mediaId:'book1',startedAt:'2026-10-20T01:00:00Z',minutes:23,fromPage:2,toPage:19},
    {id:'bookmory_book1_1',mediaId:'book1',startedAt:'2026-10-20T01:00:00Z',minutes:200},
    {id:'existing',mediaId:'book1',startedAt:'2026-10-20T01:00:00Z',minutes:10},
    {id:'undated',mediaId:'book1',minutes:99},
  ];
  const preview=previewLegacySessionMigration(rows,[{id:'existing'}]);
  assert.deepEqual(preview.eligible.map(s=>s.id),['legacy1']);
  assert.equal(preview.eligible[0].activeSeconds,1380);
  assert.equal(preview.eligible[0].pagesRead,17);
});
test('P1 native timed reading candidates are staged once and retain their source ID',()=>{
  const candidate={ item:{schemaVersion:2,id:'native_book',mediaType:'book',title:'A Book',creators:['Writer'],status:'reading',progress:{unit:'page',current:0,total:300},provenance:{sourceKey:'native:1'}}, attempts:[],historicalAggregates:[],journalEntries:[],sessions:[{schemaVersion:2,id:'native_book_timer_1',libraryItemId:'native_book',mediaType:'book',source:'timer',startedAt:'2026-10-20T01:00:00Z',activeSeconds:600}] };
  const one=previewMigrationBatch([candidate],{items:[],attempts:[],sessions:[],historicalAggregates:[],journalEntries:[]});
  assert.equal(one.stagedEntities.sessions.length,1);
  assert.equal(one.summary.sessionsCount,1);
  const again=previewMigrationBatch([candidate],{items:[candidate.item],attempts:[],sessions:one.stagedEntities.sessions,historicalAggregates:[],journalEntries:[]});
  assert.equal(again.stagedEntities.sessions.length,0);
});
test('P2 custom range applies to Premium and classic session metrics',()=>{
  const sessions=[{id:'s1',libraryItemId:'b1',mediaType:'book',source:'timer',startedAt:'2026-10-10T00:00:00Z',activeSeconds:600}, {id:'s2',libraryItemId:'b1',mediaType:'book',source:'timer',startedAt:'2026-09-01T00:00:00Z',activeSeconds:300}];
  const custom={from:'2026-10-01',to:'2026-10-31'};
  assert.equal(filterSessionsByTimeRange(sessions,'custom','Asia/Manila',custom).length,1);
  const insights=calculatePremiumBookInsights([{id:'b1',title:'Book',status:'reading'}],sessions,[],'custom','2026-10-20',custom);
  assert.equal(insights.trackedMinutes,10);
  assert.equal(calculatePremiumBookInsights([{id:'b1'}],sessions,[],'custom','2026-10-20',{from:'',to:''}).trackedMinutes,0);
});
test('P2 exported rewind SVG escapes content and never exposes diary notes',()=>{
  const svg=buildRewindSvg({year:2026,booksCompleted:34,gamesCompleted:3,bookMinutes:1440,gameMinutes:600,pages:250});
  assert.match(svg,/2026/);
  assert.match(svg,/BOOKS COMPLETED/);
  assert.match(svg,/34/);
  assert.equal(svg.includes('private note'),false);
  assert.throws(()=>buildRewindSvg({year:'<script>'}),/Invalid rewind year/);
});

test('P1 Bookmory native timers reconcile historical range totals rather than double counting',()=>{
  const records=[{id:'agg',mediaId:'b1',mediaType:'book',isDailySession:false,totalMinutes:80},{id:'agg2',mediaId:'b2',mediaType:'book',isDailySession:false,totalMinutes:60}];
  const sessions=[{libraryItemId:'b1',activeSeconds:4800,provenance:{source:'bookmory_native_timer'}}];
  const result=reconcileBookmoryHistoricalTime(records,sessions);
  assert.equal(result.undatedMinutes,60);
  assert.equal(result.reconciledMinutes,80);
});
