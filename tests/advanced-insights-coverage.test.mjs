import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAdvancedInsights,resolveInsightsWindow} from '../src/domain/selectors/advancedInsights.js';

const today='2026-10-20';
const books=[
  {id:'b1',title:'In Your Dreams',status:'reading',pages:368,startedOn:'2026-10-19',bookmoryLogCount:1},
  {id:'b2',title:'Finished One',status:'completed',startedOn:'2026-10-01',finishedOn:'2026-10-15',pages:300,rating:5,tags:['Fantasy'],bookmoryLogCount:2,
    purchases:[{date:'2026-10-14',amount:250.75,currency:'PHP'}]},
  {id:'b3',title:'Undated Finish',status:'completed',pages:350},
];
const games=[{id:'g1',title:'Example Game',status:'finished',startedOn:'2026-10-10',finishedOn:'2026-10-19',platform:'PC'}];
const sessions=[
  {id:'s1',mediaType:'book',bookId:'b1',date:'2026-10-20',activeSeconds:1800,pagesRead:15,startedAt:'2026-10-20T05:00:00+08:00'},
  {id:'s2',mediaType:'game',gameId:'g1',date:'2026-10-20',activeSeconds:3600},
  {id:'bookmory_fake',mediaType:'book',bookId:'b2',date:'2026-10-20',activeSeconds:54000,pagesRead:400},
  {id:'legacy_fake',mediaType:'book',isDailySession:false,bookId:'b2',date:'2026-10-20',minutes:1000},
];
const aggregates=[{id:'h1',mediaType:'book',isDailySession:false,totalMinutes:540}];
const journal=[{id:'j1',type:'book_quote',date:'2026-10-20',linkedMediaId:'b1'}];
const report=(args={})=>buildAdvancedInsights({books,games,sessions,aggregates,journal,today,...args});

test('15 detailed insights exclude historical range logs from daily activity',()=>{
 const a=report();
 assert.equal(a.sourceCoverage.historicalMinutes,540);
 assert.equal(a.activity.readingSessions,1);
 assert.equal(a.activity.gamingSessions,1);
 assert.equal(a.activity.days[0].pages,15);
 assert.equal(a.activity.days[0].readingMinutes,30);
 assert.equal(a.activity.days[0].gamingMinutes,60);
 assert.equal(a.reading.averageSpeed,30);
 assert.equal(a.reading.completedInRange,1); // excludes undated completions
 assert.equal(a.reading.additionalReads,1);
 assert.equal(a.collection.notes,1);
 assert.equal(a.collection.quotes,1);
 assert.equal(a.collection.knownSpendPHP,250.75);
 assert.equal(a.gaming.averageSessionMinutes,60);
 assert.equal(a.rewind.booksCompleted,1);
 assert.equal(a.rewind.gamesCompleted,1);
 assert.equal(a.rewind.pages,15);
 assert.equal(a.rewind.bookMinutes,30);
 assert.equal(a.rewind.gameMinutes,60);
});

test('date filters and sparse input do not fabricate days, purchases or goals',()=>{
 const filtered=report({timeRange:'custom',custom:{from:'2026-10-19',to:'2026-10-19'}});
 assert.equal(filtered.activity.days.length,0);
 assert.equal(filtered.collection.knownSpendPHP,0);
 assert.equal(filtered.collection.notes,0);
 assert.equal(filtered.reading.averageSpeed,null);
 assert.equal(filtered.gaming.playedMinutes,0);
 assert.equal(resolveInsightsWindow('custom',today,{from:'2026-10-21',to:'2026-10-20'}).valid,false);
 assert.equal(report({books:[],games:[],sessions:[],aggregates:[],journal:[]}).activity.days.length,0);
});

test('weekly current streak is based only on recorded reading days, without fabricated history',()=>{
 const a=report();
 assert.equal(a.activity.currentStreak,1);
 assert.equal(a.activity.longestStreak,1);
 assert.equal(a.activity.heatmap.find(r=>r.date==='2026-10-20')?.readingMinutes,30);
 assert.ok(a.activity.heatmap.length >= 365);
});
