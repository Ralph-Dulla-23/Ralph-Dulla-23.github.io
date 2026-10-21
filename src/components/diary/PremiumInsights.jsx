import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { calculatePremiumBookInsights, calculatePremiumGameInsights } from '../../domain/selectors/premiumInsights';
import { formatDurationMinutes } from '../../domain/dates';

const surface = 'rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141b2c] p-3.5 sm:p-5';
function Metric({ label, value, note, emphasis = false }) {
  return <div className={`${surface} min-w-0`}>
    <p className="text-[11px] leading-4 font-semibold text-gray-500 dark:text-slate-400">{label}</p>
    <p className={`mt-1.5 text-xl sm:text-2xl font-bold tabular-nums tracking-tight break-words ${emphasis ? 'text-sky-600 dark:text-sky-300' : 'text-gray-900 dark:text-white'}`}>{value}</p>
    {note && <p className="mt-1 text-[11px] leading-4 text-gray-500 dark:text-slate-400">{note}</p>}
  </div>;
}
Metric.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.node.isRequired, note: PropTypes.string, emphasis: PropTypes.bool };
function Metrics({ children }) {
  const [expanded, setExpanded] = useState(false);
  const items = React.Children.toArray(children);
  return <div className="space-y-3">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">{expanded ? items : items.slice(0,4)}</div>
    {items.length > 4 && <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 dark:border-white/10 dark:bg-[#141b2c] dark:text-slate-300">{expanded ? 'Show fewer metrics' : `Show ${items.length-4} more metrics`}</button>}
  </div>;
}
Metrics.propTypes = { children: PropTypes.node };
function Breakdown({ title, values, unit = 'items', empty = 'Not enough metadata yet' }) {
  const max = Math.max(1, ...values.map(([, value]) => Number(value) || 0));
  return <section className={`${surface} space-y-3`} aria-label={title}>
    <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">{title}</h3>
    {values.length === 0 ? <p className="text-sm text-gray-500 dark:text-slate-400">{empty}</p> :
      <div className="space-y-3">{values.map(([name, value]) =>
        <div key={name} className="space-y-1">
          <div className="flex items-start justify-between gap-3 text-xs"><span className="truncate text-gray-700 dark:text-slate-200">{name}</span><span className="shrink-0 font-semibold tabular-nums text-gray-500 dark:text-slate-400">{value} {unit}</span></div>
          <div className="h-1.5 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden"><div className="h-full rounded-full bg-sky-500/80" style={{ width: `${100 * value / max}%` }}/></div>
        </div>)}</div>}
  </section>;
}
Breakdown.propTypes = { title: PropTypes.string.isRequired, values: PropTypes.array.isRequired, unit: PropTypes.string, empty: PropTypes.string };
function MonthlyBars({ title, rows, footer }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <section className={surface}>
    <h3 className="text-sm font-bold text-gray-900 dark:text-slate-100">{title}</h3>
    <div className="mt-5 flex h-32 gap-1.5 items-end" role="img" aria-label={`${title}. ${rows.map((r) => `${r.key}: ${r.value}`).join('; ')}`}>
      {rows.map((row) => <div key={row.key} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1" title={`${row.key}: ${row.value}`}>
        <span className="text-[10px] text-slate-500 tabular-nums">{row.value || ''}</span>
        <div className="w-full rounded-t-md bg-sky-500/80 min-h-[2px]" style={{ height: `${100 * row.value / max}%` }}/>
      </div>)}
    </div>
    <div className="mt-1 flex justify-between gap-1 text-[10px] text-gray-400"><span>{rows[0]?.key || ''}</span><span>{rows.at(-1)?.key || ''}</span></div>
    <p className="mt-2 text-[11px] text-gray-500 dark:text-slate-400">{footer}</p>
  </section>;
}
MonthlyBars.propTypes = { title: PropTypes.string.isRequired, rows: PropTypes.array.isRequired, footer: PropTypes.string };

export default function PremiumInsights({ books, games, sessions, aggregates, segment, timeRange, customRange = {}, historyError }) {
  const b = useMemo(() => calculatePremiumBookInsights(books, sessions, aggregates, timeRange, undefined, customRange), [books, sessions, aggregates, timeRange, customRange]);
  const g = useMemo(() => calculatePremiumGameInsights(games, sessions, timeRange, undefined, customRange), [games, sessions, timeRange, customRange]);
  const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 });
  return <div className="space-y-5" aria-label="Premium detailed insights">
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-gray-900 dark:text-white">At a glance</h2><span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">Personal edition</span></div>
      <p className="text-xs text-gray-500 dark:text-slate-400">Live diary data plus separately labeled Bookmory history. Statistics never invent daily sessions.</p>
    </div>
    {historyError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">Historical Bookmory records unavailable: {historyError.code || historyError.message}</p>}
    {segment === 'combined' && <>
      <Metrics>
        <Metric label="Books in library" value={b.libraryCount} />
        <Metric label="Games in library" value={g.libraryCount} />
        <Metric label="Completed books" value={b.completedCount} />
        <Metric label="Completed games" value={g.completedCount} />
        <Metric label="Timed reading" value={formatDurationMinutes(b.trackedMinutes)} note="Verified sessions in selected period" />
        <Metric label="Timed gaming" value={formatDurationMinutes(g.verifiedMinutes)} note="Verified sessions in selected period" />
        <Metric label="Books finished in period" value={b.completedInPeriod} note="Known finish dates only" />
        <Metric label="Bookmory historical time" value={timeRange === 'all' ? formatDurationMinutes(b.historicalMinutes) : 'All time only'} note="Unallocated history only; native timed records are not double counted" />
      </Metrics>
      <div className="grid md:grid-cols-2 gap-4"><MonthlyBars title="Books finished · last 12 months" rows={b.monthlyCompletions} footer="Uses actual completed dates, not imported reading-session guesses."/><MonthlyBars title="Games finished · last 12 months" rows={g.monthlyCompletions} footer="Uses saved game completion dates only."/></div>
    </>}
    {segment === 'books' && <>
      <Metrics>
        <Metric label="Total books" value={b.libraryCount}/>
        <Metric label="Completed" value={b.completedCount}/>
        <Metric label="Favorites" value={b.favorites}/>
        <Metric label="Wishlist" value={b.wishlist}/>
        <Metric label="Timed sessions" value={b.sessionCount} note={`${b.activeDays} distinct recorded days`}/>
        <Metric label="Actual pages logged" value={b.trackedPages.toLocaleString()} note="Only individual recorded sessions"/>
        <Metric label="Reading time (sessions)" value={formatDurationMinutes(b.trackedMinutes)}/>
        <Metric label="Reading speed" value={b.pagesPerHour === null ? '—' : `${b.pagesPerHour} p/h`} note="Only when timed page logs exist"/>
        <Metric label="Bookmory historical time" value={timeRange === 'all' ? formatDurationMinutes(b.historicalMinutes) : 'All time only'} note="Not assigned to specific days"/>
        <Metric label="Known completed-page totals" value={b.knownCompletedPages.toLocaleString()} note="Book lengths, not tracked pages read"/>
        <Metric label="Average rating" value={b.avgRating === null ? '—' : `${b.avgRating} / 5`} />
        <Metric label="Additional read-throughs" value={b.rereads} note="Recorded rereads from Bookmory logs"/>
        <Metric label="Book purchases logged" value={b.purchases}/>
        <Metric label="Known PHP purchase costs" value={money.format(b.phpPurchaseAmount)} note="Unknown costs and currencies excluded"/>
        <Metric label="Finished in selected period" value={b.completedInPeriod} note={`${b.completionDateMissing} completed books have no finish date`}/>
        <Metric label="Books read per session" value={b.sessionCount ? (b.trackedPages / b.sessionCount).toFixed(1) : '—'} note="Mean recorded pages per session"/>
      </Metrics>
      <MonthlyBars title="Completed books by month" rows={b.monthlyCompletions} footer="Tracks books with actual finish dates; undated completions remain in lifetime totals."/>
      <div className="grid md:grid-cols-2 gap-4">
        <Breakdown title="Book status" values={b.statusCounts} unit="books"/>
        <Breakdown title="Rating distribution (out of 5)" values={b.ratingCounts} unit="books"/>
        <Breakdown title="Most read authors" values={b.topAuthors} unit="books"/>
        <Breakdown title="Genres and tags" values={b.topTags} unit="books"/>
        <Breakdown title="Publishers" values={b.topPublishers} unit="books"/>
        <Breakdown title="Book formats" values={b.topFormats} unit="books"/>
        <Breakdown title="Languages" values={b.topLanguages} unit="books" empty="No language metadata in these imported records."/>
      </div>
    </>}
    {segment === 'games' && <>
      <Metrics>
        <Metric label="Games tracked" value={g.libraryCount}/>
        <Metric label="Finished games" value={g.completedCount}/>
        <Metric label="Currently playing" value={g.playingCount}/>
        <Metric label="Average rating" value={g.avgRating === null ? '—' : `${g.avgRating} / 10`}/>
        <Metric label="Timed gaming" value={formatDurationMinutes(g.verifiedMinutes)} note="Actual sessions in selected period"/>
        <Metric label="Manual historical baseline" value={`${g.baselineHours}h`} note="Lifetime game totals entered manually"/>
        <Metric label="Total known playtime" value={`${g.totalAllTimeHours}h`} note="Lifetime baseline + verified sessions"/>
        <Metric label="Active play days" value={g.activeDays} note={`${g.sessionCount} sessions in selected period`}/>
      </Metrics>
      <MonthlyBars title="Games finished by month" rows={g.monthlyCompletions} footer="Known game completion dates only."/>
      <div className="grid md:grid-cols-2 gap-4">
        <Breakdown title="Platforms" values={g.topPlatforms} unit="games"/>
        <Breakdown title="Game genres" values={g.topGenres} unit="games"/>
        <Breakdown title="Game status" values={g.statusCounts} unit="games"/>
        <Breakdown title="Rating distribution (out of 10)" values={g.ratingCounts} unit="games"/>
        <Breakdown title="Most played games (manual baseline hours)" values={g.topGames.map((v) => [v.title, v.value])} unit="hrs"/>
      </div>
    </>}
  </div>;
}
PremiumInsights.propTypes = {
  books: PropTypes.array.isRequired, games: PropTypes.array.isRequired,
  sessions: PropTypes.array.isRequired, aggregates: PropTypes.array.isRequired,
  segment: PropTypes.oneOf(['combined','books','games']).isRequired,
  timeRange: PropTypes.oneOf(['month','year','all','custom']).isRequired,
  customRange: PropTypes.shape({ from: PropTypes.string, to: PropTypes.string }),
  historyError: PropTypes.object,
};
