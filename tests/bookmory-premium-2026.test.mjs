import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBookmoryMarkdownPure } from '../src/domain/bookmoryParser.js';
import { previewMigrationBatch } from '../src/domain/migrationEngine.js';
import { calculatePremiumBookInsights, calculatePremiumGameInsights } from '../src/domain/selectors/premiumInsights.js';
import { calculateDailyReadingTimeline } from '../src/domain/selectors/dailyReadingTimeline.js';

const example = `***
### Book information
- Title: Example Story
- Authors: Taylor Example
- Publisher: Example House
- Publication date: 2023/12/26
- ISBN: 9781111111111
- Book type: Paperback
- Total pages: p. 420
- Tags in use: #Fantasy #YoungAdult #Fiction
- Collections: Favorite
- Wishlist: No
- Status: I've read it all!
***
### Reading log 1
- Read period: 4/23/2026 ~ 5/13/2026
- Star ratings: 5.0
- Comment: Loved the ending!
- Total read time:
***
### Reading log 2
- Read period: 9/15/2026 ~ 9/24/2026
- Star ratings: 5.0
- Comment:
- Total read time: 4h 34m
***
### Purchase logs #1
- Purchased day: ?
- Purchased from: Local shop
- Price: ₱888.88
- Memo:
`;

test('Bookmory purchase, publisher, reread and source dates are preserved', () => {
  const data = parseBookmoryMarkdownPure(example);
  assert.equal(data.item.publisher, 'Example House');
  assert.equal(data.item.purchases[0].amount, 888.88);
  assert.equal(data.item.purchases[0].date, null);
  assert.equal(data.item.purchases[0].currency, 'PHP');
  assert.equal(data.attempts.length, 2);
  assert.equal(data.item.bookmoryLogCount, 2);
  assert.equal(data.historicalAggregates.length, 1);
  assert.equal(data.historicalAggregates[0].totalMinutes, 274);
  assert.equal(data.historicalAggregates[0].isDailySession, false);
  assert.equal(data.journalEntries[0].visibility, 'private');
  assert.equal(parseBookmoryMarkdownPure(example).item.id, data.item.id);
});

test('Bookmory update matches legacy book and preserves current owner page and cover', () => {
  const source = parseBookmoryMarkdownPure(example);
  const existing = [{id:'legacy_123',title:'Example Story',isbn:source.item.isbn,author:'Taylor Example', status:'reading',pages:420,currentPage:32,cover:'cover.png',favorite:false}];
  const first = previewMigrationBatch([source], { items: existing, attempts:[], historicalAggregates:[] });
  assert.equal(first.summary.updates, 1);
  assert.equal(first.stagedEntities.items[0].id, 'legacy_123');
  assert.equal(first.stagedEntities.items[0].cover, 'cover.png');
  assert.equal(first.stagedEntities.historicalAggregates[0].mediaId, 'legacy_123');
  assert.equal(first.stagedEntities.attempts[0].libraryItemId, 'legacy_123');
  const second = previewMigrationBatch([source], { items:first.stagedEntities.items, attempts:first.stagedEntities.attempts,
    historicalAggregates:first.stagedEntities.historicalAggregates, journalEntries:first.stagedEntities.journalEntries });
  assert.equal(second.summary.duplicates, 1);
  assert.equal(second.stagedEntities.historicalAggregates.length, 0);
});

test('Imported time does not become a fake calendar day or counted timed reading', () => {
  const source = parseBookmoryMarkdownPure(example);
  const legacy = { id: 'bookmory_fake', bookId: source.item.id, startedAt:'2026-09-15T12:00:00Z', minutes:274, fromPage:0, toPage:420 };
  const b = {id:source.item.id, title:source.item.title, status:'completed', finishedOn:'2026-09-24', pages:420,
    bookmoryLogCount:2, genres:source.item.genres, purchases:source.item.purchases, publisher:source.item.publisher};
  const value = calculatePremiumBookInsights([b], [legacy], source.historicalAggregates, 'all', '2026-10-20');
  assert.equal(value.historicalMinutes, 274);
  assert.equal(value.trackedMinutes, 0);
  assert.equal(value.trackedPages, 0);
  assert.equal(value.rereads, 1);
  assert.equal(value.phpPurchaseAmount, 888.88);
  assert.equal(value.completedInPeriod, 1);
  const timeline = calculateDailyReadingTimeline([b], [legacy], 14, 'Asia/Manila', '2026-09-20');
  assert.equal(timeline.totalMinutes, 0);
});

test('Game premium insights keep manually recorded baseline separate from sessions', () => {
  const games=[{id:'game_1',title:'Example Game',status:'finished',platform:'PC',genres:['Action'],hoursPlayed:6,rating:9}];
  const sessions=[{id:'valid_1',mediaType:'game',libraryItemId:'game_1',startedAt:'2026-10-19T15:00:00+08:00', activeSeconds:3600}];
  const result=calculatePremiumGameInsights(games,sessions,'all','2026-10-20');
  assert.equal(result.baselineHours,6);
  assert.equal(result.verifiedMinutes,60);
  assert.equal(result.totalAllTimeHours,7);
  assert.equal(result.completedCount,1);
});

test('Thousands-formatted page counts are not truncated', () => {
  const text = example.replace('p. 420', 'p. 1,030');
  assert.equal(parseBookmoryMarkdownPure(text).item.progress.total, 1030);
});
