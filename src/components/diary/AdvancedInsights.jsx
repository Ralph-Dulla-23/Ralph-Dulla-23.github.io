import DiarySelect from '../ui/DiarySelect';
import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { buildAdvancedInsights } from '../../domain/selectors/advancedInsights.js';
import { formatDurationMinutes } from '../../domain/dates.js';
import { downloadRewindCard } from '../../domain/rewindCard.js';

const card = 'min-w-0 overflow-hidden rounded-2xl border border-gray-200/90 bg-white p-4 dark:border-white/10 dark:bg-[#141b2c] sm:p-5';
const pad = 'rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2.5 dark:border-white/10 dark:bg-white/[0.035]';
const sections = [
  ['activity', 'Activity'], ['reading', 'Reading'], ['collection', 'Collection'], ['gaming', 'Gaming'], ['rewind', 'Rewind'],
];
const number = (n, decimals=0) => n == null ? '—' : Number(n).toLocaleString('en-PH', {maximumFractionDigits:decimals});
const fmtTime = (n) => n == null ? '—' : formatDurationMinutes(n);
const fit = (v,max) => `${Math.max(v > 0 ? 3 : 0, Math.min(100, (100*v)/Math.max(max,1)))}%`;

function MiniStat({title,value,hint}) { return <div className={pad}><p className="text-[11px] leading-4 text-gray-500 dark:text-slate-400">{title}</p><p className="mt-1 text-lg font-bold leading-tight tabular-nums text-gray-900 dark:text-white break-words">{value}</p>{hint && <p className="mt-1 text-[11px] leading-4 text-gray-500 dark:text-slate-400">{hint}</p>}</div>; }
MiniStat.propTypes={title:PropTypes.string.isRequired,value:PropTypes.node,hint:PropTypes.string};
function Block({title,description,children}) { return <section className={card}><h4 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h4>{description && <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">{description}</p>}<div className="mt-4 min-w-0">{children}</div></section>; }
Block.propTypes={title:PropTypes.string.isRequired,description:PropTypes.string,children:PropTypes.node};
function StatGrid({children}) { return <div className="grid grid-cols-2 gap-2.5 sm:gap-3">{children}</div>; }
StatGrid.propTypes={children:PropTypes.node};
function Empty({children='No qualifying records for this period yet.'}) { return <p className="rounded-xl bg-gray-50 p-3 text-xs leading-5 text-gray-500 dark:bg-white/[0.03] dark:text-slate-400">{children}</p>; }
Empty.propTypes={children:PropTypes.node};
function formatPeriod(key) {
  const value = String(key);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`).toLocaleDateString('en-PH', {day:'numeric',month:'long',year:'numeric'});
  if (/^\d{4}-\d{2}$/.test(value)) return new Date(`${value}-01T12:00:00`).toLocaleDateString('en-PH', {month:'long',year:'numeric'});
  return value;
}
function Bars({rows,field='reading',color='bg-sky-500',unit='m'}) {
  const [selected, setSelected] = useState(null);
  const normalized = rows.map(row=>({ key:String(row.key ?? row[0]), value:Number(row[field] ?? row[1] ?? 0) }));
  const peak=Math.max(1,...normalized.map(row=>row.value));
  const picked=normalized.find(row=>row.key===selected);
  if (!rows.length) return <Empty/>;
  return <div className="min-w-0 space-y-3">
    <div aria-live="polite" className="rounded-xl bg-gray-50 dark:bg-white/[0.05] px-3 py-2.5 text-xs">
      {picked ? <><strong>{formatPeriod(picked.key)}</strong><span className="ml-2 tabular-nums">{number(picked.value,1)} {unit}</span></> : 'Tap a bar to see its full date and value.'}
    </div>
    <div className="min-w-0 max-w-full overflow-x-auto pb-2" role="region" aria-label="Interactive statistics chart" tabIndex={0}>
      <div className="flex min-w-max h-40 items-end gap-2.5 sm:gap-3 pr-2">
        {normalized.map(row=><button type="button" key={row.key} onClick={()=>setSelected(row.key)} aria-pressed={selected===row.key} aria-label={`${formatPeriod(row.key)}: ${number(row.value,1)} ${unit}`} className={`flex h-full w-11 shrink-0 flex-col items-center justify-end gap-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-500 ${selected===row.key?'bg-sky-50 dark:bg-sky-900/20':''}`}>
          <span className="max-w-full truncate text-[10px] tabular-nums text-gray-500 dark:text-gray-400">{number(row.value,1)}</span>
          <span className="flex h-24 w-full items-end overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800"><span className={`${color} w-full rounded-t-md motion-safe:transition-[height] motion-safe:duration-300`} style={{height:fit(row.value,peak)}}/></span>
          <span className="max-w-full truncate text-[10px] text-gray-500 dark:text-slate-400">{row.key.slice(5) || row.key}</span>
        </button>)}
      </div>
    </div>
  </div>;
}
Bars.propTypes={rows:PropTypes.array.isRequired,field:PropTypes.string,color:PropTypes.string,unit:PropTypes.string};
function Rankings({rows,unit='items'}) { return rows.length ? <div className="space-y-2">{rows.slice(0,8).map(([label,val],i)=><div key={`${label}-${i}`} className="flex min-w-0 items-start justify-between gap-3 text-xs"><span className="min-w-0 break-words text-gray-700 dark:text-slate-200">{label}</span><span className="shrink-0 font-semibold tabular-nums text-gray-600 dark:text-slate-300">{number(val,1)} {unit}</span></div>)}</div>:<Empty/>; }
Rankings.propTypes={rows:PropTypes.array.isRequired,unit:PropTypes.string};
function Heatmap({days,onSelect,selected}) {
  const max=Math.max(1,...days.map(d=>d.readingMinutes+d.gamingMinutes));
  return <div className="space-y-2"><div className="flex flex-wrap gap-[3px]" role="group" aria-label="Reading and gaming activity by date">{days.map(d=>{
    const value=d.readingMinutes+d.gamingMinutes;const intensity=value/max;
    const bg=!value?'bg-slate-100 dark:bg-slate-800/80':intensity>.65?'bg-sky-600':intensity>.3?'bg-sky-400':'bg-sky-200 dark:bg-sky-700';
    return <button key={d.date} type="button" onClick={()=>onSelect(d.date)} title={`${d.date}: ${number(d.readingMinutes,1)} reading min, ${number(d.gamingMinutes,1)} gaming min, ${d.pages} pages`} aria-label={`${d.date}: ${number(value,1)} minutes of activity`} aria-pressed={selected===d.date} className={`h-[13px] w-[13px] shrink-0 rounded-[3px] ${bg} ${selected===d.date?'ring-2 ring-sky-700 ring-offset-1 dark:ring-sky-200':''}`}/>;
  })}</div><p className="text-[11px] text-gray-500 dark:text-slate-400">Select a square to inspect verified activity for that date. Empty dates may also mean unrecorded reading.</p></div>;
}
Heatmap.propTypes={days:PropTypes.array.isRequired,onSelect:PropTypes.func.isRequired,selected:PropTypes.string};

export default function AdvancedInsights({books,games,sessions,aggregates,journal,timeRange,customRange = {}}) {
  const [tab,setTab]=useState('activity');
  const [selectedDate,setSelectedDate]=useState('');
  const [year,setYear]=useState(String(new Date().getFullYear()));
  const [granularity,setGranularity]=useState('month');
  const analytics=useMemo(()=>buildAdvancedInsights({books,games,sessions,aggregates,journal,timeRange,custom:customRange,year}),[books,games,sessions,aggregates,journal,timeRange,customRange,year]);
  const a=analytics, activity=a.activity, reading=a.reading, collection=a.collection, gaming=a.gaming, rewind=a.rewind;
  const keyValue=activity.heatmap.find(d=>d.date===selectedDate);
  const trendRows=granularity==='day'?activity.days.slice(-30).map(d=>({...d,key:d.date,reading:d.readingMinutes,gaming:d.gamingMinutes})):granularity==='week'?activity.weekly.slice(-20):granularity==='year'?activity.yearly:activity.monthly.slice(-24);
  const selectableYears=useMemo(()=>{
    const years=new Set([new Date().getFullYear(),...activity.yearly.map(d=>Number(d.key))]);return [...years].filter(y=>y>1900).sort((a,b)=>b-a);
  },[activity.yearly]);
  return <section aria-label="Advanced analytics" className="mt-4 min-w-0 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-base font-bold text-gray-900 dark:text-white">Explore your patterns</h2><p className="mt-1 text-xs leading-5 text-gray-500 dark:text-slate-400">Real dated activity only · Historical Bookmory totals are kept separate</p></div></div>
    <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-2xl border border-gray-200 bg-white p-1.5 dark:border-white/10 dark:bg-[#141b2c]" role="tablist" aria-label="Advanced insight categories">
      {sections.map(([value,label])=><button key={value} role="tab" aria-selected={tab===value} onClick={()=>setTab(value)} className={`shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors ${tab===value?'bg-sky-600 text-white':'text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}>{label}</button>)}
    </div>
    <div className={`${card} text-xs leading-5 text-gray-600 dark:text-slate-300`}>
      {timeRange === 'custom' ? `Custom period: ${customRange.from || 'choose start'} to ${customRange.to || 'choose end'}` : `All analytics follow the ${timeRange === 'all' ? 'All Time' : timeRange} filter above.`}
      {!a.window.valid && <p role="alert" className="mt-2 text-rose-600">Choose a valid From and To date above.</p>}
      <p className="mt-1 text-[11px] text-gray-500">Library size and lifetime ratings remain lifetime metrics and are labeled accordingly.</p>
    </div>
    {a.window.valid && <>
    {tab==='activity' && <>
      <Block title="01 · Full-year activity heatmap" description="Reading and gaming minutes on precisely recorded dates. Select a square for details.">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><label className="text-xs text-gray-600 dark:text-slate-300">Year <span className="inline-block min-w-[118px] align-middle"><DiarySelect label="Activity year" value={year} onChange={v=>setYear(Number(v))} options={[...new Set([Number(year), ...selectableYears])].map(y=>({value:String(y),label:String(y)}))}/></span></label><span className="text-xs text-gray-500 dark:text-slate-400">{activity.currentStreak} current · {activity.longestStreak} longest</span></div>
        <Heatmap days={activity.heatmap} selected={selectedDate} onSelect={setSelectedDate}/>
        {keyValue && <div className={`${pad} mt-3 text-xs text-gray-600 dark:text-slate-300`}><strong>{selectedDate}</strong> · Reading {fmtTime(keyValue.readingMinutes)} · Gaming {fmtTime(keyValue.gamingMinutes)} · {keyValue.pages} pages</div>}
      </Block>
      <Block title="02 · Reading & gaming trends" description="Compare logged reading minutes, gaming minutes and pages. The bars show activity in the chosen period.">
        <div className="mb-3 flex flex-wrap gap-2">{[['day','Daily'],['week','Weekly'],['month','Monthly'],['year','Yearly']].map(([v,label])=><button key={v} type="button" onClick={()=>setGranularity(v)} aria-pressed={granularity===v} className={`rounded-lg px-3 py-1.5 text-xs ${granularity===v?'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-100':'bg-gray-100 dark:bg-slate-800'}`}>{label}</button>)}</div>
        <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-slate-300">Reading minutes</p><Bars rows={trendRows}/>
        <p className="mb-2 mt-4 text-xs font-semibold text-gray-700 dark:text-slate-300">Gaming minutes</p><Bars rows={trendRows} field="gaming" color="bg-violet-500"/>
        <p className="mb-2 mt-4 text-xs font-semibold text-gray-700 dark:text-slate-300">Pages read</p><Bars rows={trendRows} field="pages" color="bg-emerald-500" unit="pages"/>
      </Block>
      <Block title="03 · Reading streak history" description="Only actual saved reading dates qualify, never aggregated Bookmory ranges."><StatGrid><MiniStat title="Current streak" value={`${activity.currentStreak} days`}/><MiniStat title="Longest streak" value={`${activity.longestStreak} days`}/></StatGrid><div className="mt-3"><Rankings rows={activity.streaks.slice(-6).reverse().map(s=>[`${s.start} → ${s.end}`,s.length])} unit="days"/></div></Block>
    </>}
    {tab==='reading' && <>
      <Block title="04 · Reading pace over time" description="Speed is calculated only when a real timed session includes pages read."><StatGrid><MiniStat title="Average speed" value={reading.averageSpeed == null?'—':`${number(reading.averageSpeed,1)} pages/h`}/><MiniStat title="Timed reading sessions" value={activity.readingSessions}/></StatGrid><div className="mt-4"><Rankings rows={reading.speedByBook} unit="pages/h"/></div>{reading.speedSessions.length>0 && <p className="mt-3 text-[11px] text-gray-500">{reading.speedSessions.length} valid page-and-time samples; imported historical totals excluded.</p>}</Block>
      <Block title="05 · Book completion analysis" description="Average days require both a start and finish date; longest books require valid edition page totals."><StatGrid><MiniStat title="Average days to finish" value={reading.averageCompletionDays == null?'—':`${number(reading.averageCompletionDays,1)} days`}/><MiniStat title="Completion rate" value={`${number(reading.completedRate,1)}%`} hint="Completed / books actually started"/><MiniStat title="Fastest recorded" value={reading.fastest?`${reading.fastest.days} days`:'—'} hint={reading.fastest?.title}/><MiniStat title="Longest completed book" value={reading.longest?`${number(reading.longest.pages)} pages`:'—'} hint={reading.longest?.title}/></StatGrid><p className="mt-3 text-[11px] text-gray-500">{reading.undatedCompletions} completed books have no known finish date.</p></Block>
      <Block title="06 · When you read" description="Recorded session timing, not inferred from completed-book dates."><StatGrid><MiniStat title="Average timed session" value={fmtTime(reading.averageSessionMinutes)}/><MiniStat title="Sessions with known time" value={reading.timedSessions}/></StatGrid><div className="mt-4 space-y-4"><div><h5 className="mb-2 text-xs font-semibold text-gray-600 dark:text-slate-300">Most common weekdays</h5><Rankings rows={reading.weekdayBreakdown} unit="sessions"/></div><div><h5 className="mb-2 text-xs font-semibold text-gray-600 dark:text-slate-300">Session start hours (Manila)</h5><Rankings rows={reading.hourBreakdown} unit="sessions"/></div></div></Block>
      <Block title="07 · Rereading insights" description="Counts repeated reading attempts when they are explicitly recorded."><StatGrid><MiniStat title="Additional read-throughs" value={reading.additionalReads}/><MiniStat title="Reread titles" value={reading.rereadBooks.length}/></StatGrid><div className="mt-3"><Rankings rows={reading.rereadBooks.map(b=>[b.title,b.reads])} unit="reads"/></div></Block>
    </>}
    {tab==='collection' && <>
      <Block title="08 · Purchases and spending" description="Only dated purchases are shown in period charts. Unknown amounts never count as free."><StatGrid><MiniStat title="Purchases with known dates" value={collection.purchases}/><MiniStat title="Known PHP spending" value={new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(collection.knownSpendPHP)} hint="Other currencies tracked separately"/></StatGrid><div className="mt-4"><Rankings rows={collection.spendingByMonth} unit="PHP"/></div></Block>
      <Block title="09 · Lending and gifts" description="Loan and gift insights require saved transactions; Bookmory exports may not contain these records."><StatGrid><MiniStat title="Recorded loans" value={collection.loanCount}/><MiniStat title="Returned loans" value={collection.loansReturned}/><MiniStat title="Recorded gifts" value={collection.giftCount}/><MiniStat title="To-read shelf" value={collection.wishlist}/></StatGrid>{!collection.loanDataPresent && !collection.giftDataPresent && <div className="mt-3"><Empty>No loan or gift transactions are available in the current diary records.</Empty></div>}</Block>
      <Block title="10 · Notes & quotes activity" description="Based on private journal records, including explicitly linked books and games."><StatGrid><MiniStat title="Journal entries" value={collection.notes}/><MiniStat title="Saved book quotes" value={collection.quotes}/></StatGrid><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><h5 className="mb-2 text-xs font-semibold">Entry types</h5><Rankings rows={collection.noteTypes} unit="entries"/></div><div><h5 className="mb-2 text-xs font-semibold">Most noted media</h5><Rankings rows={collection.noteMedia} unit="entries"/></div></div></Block>
    </>}
    {tab==='gaming' && <>
      <Block title="11 · Advanced gaming trends" description="Actual session minutes by month or year. Manual lifetime-hour totals are not assigned to dates."><StatGrid><MiniStat title="Timed playtime" value={fmtTime(gaming.playedMinutes)}/><MiniStat title="Average play session" value={fmtTime(gaming.averageSessionMinutes)}/><MiniStat title="Longest recorded session" value={fmtTime(gaming.longestSessionMinutes)}/><MiniStat title="Game sessions" value={activity.gamingSessions}/></StatGrid><div className="mt-4"><Bars rows={activity.monthly} field="gaming" color="bg-violet-500"/></div></Block>
      <Block title="12 · Game completion and backlog" description="Includes normalized Finished/Completed statuses and dated completions where available."><StatGrid><MiniStat title="Completion rate" value={`${number(gaming.completedRate,1)}%`}/><MiniStat title="Avg time to finish" value={gaming.averageCompletionDays == null?'—':`${number(gaming.averageCompletionDays,1)} days`}/><MiniStat title="Replays recorded" value={gaming.replayCount}/><MiniStat title="Status groups" value={gaming.statusBreakdown.length}/></StatGrid><div className="mt-4"><Rankings rows={gaming.statusBreakdown} unit="games"/></div></Block>
    </>}
    {tab==='rewind' && <>
      <div className="rounded-2xl bg-gradient-to-br from-[#10223b] to-[#252853] p-5 text-white shadow-sm sm:p-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">Year in stories</p>
        <h3 className="mt-1 font-display text-4xl font-bold tabular-nums">{rewind.year}</h3>
        <p className="mt-2 max-w-xs text-xs leading-5 text-slate-200">{rewind.booksCompleted} books · {rewind.gamesCompleted} games · Verified reading and gaming sessions only</p>
        <button type="button" className="diary-press mt-4 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#13213f]" onClick={() => void downloadRewindCard(rewind).catch((error) => window.alert(`Rewind export failed: ${error.message}`))}>
          Download Year in Books & Games (PNG)
        </button>
      </div>
      <Block title="13 · Year in Books" description="Annual recap based on dated completion records and genuine reading sessions."><StatGrid><MiniStat title="Books completed" value={rewind.booksCompleted}/><MiniStat title="Timed reading" value={fmtTime(rewind.bookMinutes)}/><MiniStat title="Pages in actual sessions" value={number(rewind.pages)}/><MiniStat title="Reading sessions" value={rewind.bookSessions}/></StatGrid><div className="mt-4"><h5 className="mb-2 text-xs font-semibold">Highest-rated finished books</h5><Rankings rows={rewind.topRatedBooks.map(b=>[b.title,b.rating])} unit="/ 5"/></div></Block>
      <Block title="14 · Year in Games" description="Annual completed-game and real timed-play summary."><StatGrid><MiniStat title="Games completed" value={rewind.gamesCompleted}/><MiniStat title="Timed play" value={fmtTime(rewind.gameMinutes)}/><MiniStat title="Game sessions" value={rewind.gameSessions}/><MiniStat title="Year" value={rewind.year}/></StatGrid></Block>
      <Block title="15 · Your media rewind" description="Combined Books + Games recap for the selected year. No hidden assumptions about undated records."><StatGrid><MiniStat title="Total completed media" value={rewind.booksCompleted+rewind.gamesCompleted}/><MiniStat title="Combined timed activity" value={fmtTime(rewind.bookMinutes+rewind.gameMinutes)}/></StatGrid><div className="mt-4"><h5 className="mb-2 text-xs font-semibold">Top completed-book genres</h5><Rankings rows={rewind.topTags} unit="books"/></div></Block>
    </>}
    </>}
    <p className="px-1 pb-1 text-[11px] leading-5 text-gray-500 dark:text-slate-400">Accuracy: historical Bookmory aggregates are not distributed across calendar days. Missing timestamps, unknown purchase amounts and missing loan records remain unestimated.</p>
  </section>;
}
AdvancedInsights.propTypes={books:PropTypes.array.isRequired,games:PropTypes.array.isRequired,sessions:PropTypes.array.isRequired,aggregates:PropTypes.array.isRequired,journal:PropTypes.array.isRequired,timeRange:PropTypes.oneOf(['month','year','all','custom']).isRequired,customRange:PropTypes.shape({from:PropTypes.string,to:PropTypes.string})};
