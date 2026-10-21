import React from 'react';
import { BsBook, BsController, BsCheck2Circle, BsArrowRight } from 'react-icons/bs';
import { useNavigate } from 'react-router-dom';
import { useTimer } from '../../context/TimerContext';

export default function ReadingSessionResult() {
    const { lastSessionResult: result, closeSessionResult } = useTimer();
    const navigate = useNavigate();
    if (!result) return null;
    const isBook = result.mediaType === 'book';
    const minutes = result.activeSeconds / 60;
    const pages = result.pagesRead;
    const canCalculateSpeed = isBook && pages > 0 && minutes > 0;
    const perHour = canCalculateSpeed ? pages * 60 / minutes : null;
    const remaining = isBook && result.totalPages && result.endPage !== null
        ? Math.max(0, result.totalPages - result.endPage) : null;
    const remainingMinutes = canCalculateSpeed && remaining !== null ? remaining * 60 / perHour : null;
    const timeText = result.activeSeconds >= 3600
        ? `${Math.floor(result.activeSeconds / 3600)}h ${Math.round((result.activeSeconds % 3600) / 60)}m`
        : `${result.activeSeconds === 0 ? 0 : Math.max(1, Math.round(minutes))}m`;
    const handleDone = () => {
        closeSessionResult();
        navigate(isBook ? `/app/books/${encodeURIComponent(result.itemId)}` : `/app/games/${encodeURIComponent(result.itemId)}`);
    };
    return (
        <section role="dialog" aria-modal="true" aria-labelledby="session-results-title"
            className="diary-results-entrance fixed inset-0 z-[80] bg-[#f8f0e5] dark:bg-[#101827] text-[#4f4740] dark:text-slate-100 overflow-y-auto"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="max-w-lg mx-auto px-6 pt-12 pb-12 min-h-full flex flex-col">
                <p className="text-xs tracking-widest uppercase text-[#947e6e] dark:text-slate-400">Saved to your diary</p>
                <h1 id="session-results-title" className="font-display text-3xl font-bold mt-2">{isBook ? 'Reading session result' : 'Gaming session result'}</h1>
                <p className="text-sm mt-2 opacity-70">{result.date}</p>
                <div className="diary-result-cover mx-auto my-10 w-32 h-44 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center shadow-lg">
                    {result.itemCover ? <img src={result.itemCover} alt={result.itemTitle} className="w-full h-full object-cover" width="128" height="176" decoding="async" /> : isBook ? <BsBook className="text-4xl" /> : <BsController className="text-4xl" />}
                </div>
                <p className="text-center font-semibold text-lg mb-6">{result.itemTitle}</p>
                <div className="diary-result-stats space-y-3">
                    <div className="rounded-2xl bg-white/85 dark:bg-slate-800 px-5 py-4"><p className="text-sm">{isBook ? 'You read' : 'You played for'} <strong className="text-[#407da5] dark:text-sky-300 text-xl">{isBook && pages !== null ? `${pages} pages in ${timeText}` : timeText}</strong></p></div>
                    {canCalculateSpeed && <div className="rounded-2xl bg-white/85 dark:bg-slate-800 px-5 py-4 text-sm">Your reading pace <strong className="block text-xl text-[#407da5] dark:text-sky-300">{perHour.toFixed(1)} pages/hour</strong></div>}
                    {remaining !== null && <div className="rounded-2xl bg-white/85 dark:bg-slate-800 px-5 py-4 text-sm"><strong className="text-xl text-[#407da5] dark:text-sky-300">{remaining}</strong> pages remaining{remainingMinutes !== null ? ` · about ${Math.round(remainingMinutes)} minutes at this pace` : ''}</div>}
                </div>
                {result.progressWarning && <p role="alert" className="mt-4 p-3 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-sm text-amber-900 dark:text-amber-200">Session saved, but book progress needs attention: {result.progressWarning}</p>}
                <div className="mt-auto pt-10">
                    <button type="button" onClick={handleDone} className="w-full min-h-12 bg-[#407da5] text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2"><BsCheck2Circle /> Done <BsArrowRight /></button>
                </div>
            </div>
        </section>
    );
}
