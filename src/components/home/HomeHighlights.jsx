import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { BsBook, BsController, BsPlayFill, BsArrowUpRight, BsClockHistory } from 'react-icons/bs';
import { toLocalDateKey, formatDurationMinutes } from '../../domain/dates';

function MediaCover({ src, title, type = 'book', width = 92, height = 138 }) {
  const Icon = type === 'game' ? BsController : BsBook;
  return (
    <div className="overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0 shadow-sm" style={{ width, height }}>
      {src ? <img src={src} alt={`${title} cover`} width={width} height={height} decoding="async" loading="lazy" className="diary-cover-image w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-slate-400"><Icon className="w-6 h-6" /></div>}
    </div>
  );
}
MediaCover.propTypes = { src: PropTypes.string, title: PropTypes.string, type: PropTypes.string, width: PropTypes.number, height: PropTypes.number };

function getBookId(item) { return String(item.id || item.coverId || (item.title || 'book').replace(/\s+/g, '-').toLowerCase()); }
function getGameId(item) { return String(item.id || item.rawgId || item.title); }

export default function HomeHighlights({ books, games, sessions, loading, onRead, onPlay }) {
  const featured = books[0];
  const otherBooks = books.slice(1, 5);
  const recent = useMemo(() => (sessions || [])
    .filter((session) => session.isDailySession !== false && Boolean(session.date || session.startedAt))
    .slice().sort((a, b) => Date.parse(b.startedAt || b.date) - Date.parse(a.startedAt || a.date))
    .slice(0, 3), [sessions]);

  return (
    <>
      <section className="mb-8 diary-section-motion" aria-labelledby="reading-heading">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 id="reading-heading" className="font-display font-bold text-lg text-gray-900 dark:text-white">Continue reading</h2>
          <Link to="/app/library/books" className="text-xs font-semibold text-[#3f7e98] dark:text-sky-300 min-h-10 inline-flex items-center gap-1">My books <BsArrowUpRight aria-hidden="true" /></Link>
        </div>
        {loading ? <div className="diary-feature-card h-[200px] animate-pulse" aria-label="Loading your reading list" /> : featured ? (() => {
          const total = Number(featured.pages);
          const current = Math.max(0, Number(featured.currentPage) || 0);
          const percent = total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : null;
          const image = featured.cover || (featured.coverId ? `https://covers.openlibrary.org/b/id/${featured.coverId}-M.jpg` : '');
          return <div className="diary-feature-card diary-feature-entrance relative overflow-hidden p-4 sm:p-6">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#3f7e98] dark:bg-[#75b6d1]" aria-hidden="true" />
            <div className="flex items-start gap-4 sm:gap-6">
              <Link to={`/app/books/${getBookId(featured)}`} className="diary-press shrink-0" aria-label={`Open ${featured.title}`}><MediaCover src={image} title={featured.title} width={92} height={138} /></Link>
              <div className="flex-1 min-w-0 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#3f7e98] dark:text-sky-300 mb-1">Currently reading</p>
                <Link to={`/app/books/${getBookId(featured)}`} className="font-display font-bold text-lg sm:text-xl leading-tight text-gray-900 dark:text-white line-clamp-2">{featured.title}</Link>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 line-clamp-1">{featured.author || 'Unknown author'}</p>
                <p className="mt-4 text-xs font-medium text-gray-600 dark:text-slate-300">{total > 0 ? `Page ${current} of ${total} · ${Math.round(percent)}%` : `Page ${current} · total not recorded`}</p>
                {percent !== null && <div className="h-1.5 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden mt-2" role="progressbar" aria-label={`${featured.title} reading progress`} aria-valuenow={Math.round(percent)} aria-valuemin="0" aria-valuemax="100"><div className="diary-progress-fill bg-[#3f7e98] dark:bg-[#75b6d1] h-full rounded-full" style={{ width: `${percent}%` }} /></div>}
                <button type="button" onClick={() => onRead(featured)} className="diary-press mt-4 min-h-11 px-4 py-2 rounded-xl bg-[#3f7e98] dark:bg-[#75b6d1] text-white dark:text-[#0c111b] text-xs font-bold inline-flex items-center gap-2"><BsPlayFill aria-hidden="true" /> Resume reading</button>
              </div>
            </div>
          </div>;
        })() : <div className="diary-feature-card px-5 py-7 text-center"><BsBook className="w-7 h-7 mx-auto text-[#3f7e98] mb-2" /><p className="font-semibold text-sm">Your next chapter starts here.</p><p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Choose a book and mark it as Reading.</p><Link className="inline-flex mt-4 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold" to="/app/library/books?action=add">Add a book</Link></div>}
        {otherBooks.length > 0 && <div className="flex gap-3 overflow-x-auto mt-3 pb-1" aria-label="Other books in progress">{otherBooks.map((book) => <Link to={`/app/books/${getBookId(book)}`} key={getBookId(book)} className="diary-press flex items-center gap-2 px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-gray-200/70 dark:border-slate-700 min-w-[165px] max-w-[225px]"><MediaCover src={book.cover || (book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-S.jpg` : '')} title={book.title} width={32} height={48} /><span className="min-w-0 text-xs font-semibold line-clamp-2">{book.title}</span></Link>)}</div>}
      </section>

      <section className="mb-8 diary-section-motion" aria-labelledby="playing-heading">
        <div className="flex items-center justify-between gap-3 mb-3"><h2 id="playing-heading" className="font-display font-bold text-lg text-gray-900 dark:text-white">Continue playing</h2><Link to="/app/library/games" className="text-xs font-semibold text-violet-600 dark:text-violet-300 min-h-10 inline-flex items-center gap-1">My games <BsArrowUpRight aria-hidden="true" /></Link></div>
        {loading ? <div className="diary-feature-card h-32 animate-pulse" /> : games.length > 0 ? <div className="diary-game-rail">{games.map(game => <div key={getGameId(game)} className="diary-feature-card diary-card-interactive flex items-center gap-3 p-3 flex-[0_0_85%] sm:flex-[0_0_310px] max-w-[350px] min-w-0">
          <Link to={`/app/games/${getGameId(game)}`} className="diary-press"><MediaCover src={game.cover} title={game.title} type="game" width={62} height={85} /></Link>
          <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-widest text-violet-600 dark:text-violet-300 font-semibold">Playing</p><Link to={`/app/games/${getGameId(game)}`} className="font-semibold text-sm line-clamp-2 mt-1">{game.title}</Link><p className="text-xs text-gray-500 dark:text-slate-400 mt-1 truncate">{game.platform || 'Platform not set'}</p><button type="button" onClick={() => onPlay(game)} className="diary-press mt-2 min-h-9 inline-flex items-center gap-1.5 px-3 rounded-lg bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200 font-semibold text-xs"><BsPlayFill aria-hidden="true" /> Continue</button></div>
        </div>)}</div> : <div className="diary-feature-card p-5 flex items-center gap-3"><BsController className="text-violet-500 w-6 h-6"/><div className="flex-1 min-w-0"><p className="font-semibold text-sm">No games in progress</p><p className="text-xs text-gray-500 dark:text-slate-400">Choose a title from your backlog to start playing.</p></div><Link to="/app/library/games" className="text-xs font-semibold text-violet-600 dark:text-violet-300">Browse</Link></div>}
      </section>

      {recent.length > 0 && <section className="mb-8 diary-section-motion" aria-labelledby="recent-heading"><div className="flex items-center justify-between mb-3"><h2 id="recent-heading" className="font-display font-bold text-lg">Recent diary activity</h2><Link to="/app/calendar" className="text-xs font-semibold text-[#3f7e98] dark:text-sky-300">Calendar</Link></div><div className="diary-feature-card divide-y divide-gray-100 dark:divide-slate-700 overflow-hidden">{recent.map((session, index) => {
        const isBook = session.mediaType ? session.mediaType === 'book' : session.startPage !== undefined || session.fromPage !== undefined;
        const seconds = Number(session.activeSeconds ?? 0);
        const minutes = Number(session.durationMinutes ?? session.minutes ?? (seconds / 60));
        const mediaId = session.libraryItemId || session.itemId || session.bookId || session.gameId;
        const destination = mediaId ? `/app/${isBook ? 'books' : 'games'}/${String(mediaId)}` : '/app/calendar';
        return <Link key={String(session.id || index)} to={destination} className="diary-press diary-activity-enter flex items-center gap-3 p-3.5 hover:bg-gray-50 dark:hover:bg-slate-800/50"><span className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 grid place-items-center shrink-0">{isBook ? <BsBook className="text-[#3f7e98]" /> : <BsController className="text-violet-500" />}</span><span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate">{session.itemTitle || (isBook ? 'Reading session' : 'Gaming session')}</span><span className="text-xs text-gray-500 dark:text-slate-400 flex gap-2 items-center"><BsClockHistory aria-hidden="true" />{toLocalDateKey(session.date || session.startedAt)} · {Number.isFinite(minutes) && minutes > 0 ? formatDurationMinutes(minutes) : 'Untimed entry'}</span></span><BsArrowUpRight className="text-gray-400 shrink-0" /></Link>;
      })}</div></section>}
    </>
  );
}
HomeHighlights.propTypes = { books: PropTypes.array.isRequired, games: PropTypes.array.isRequired, sessions: PropTypes.array, loading: PropTypes.bool, onRead: PropTypes.func.isRequired, onPlay: PropTypes.func.isRequired };
