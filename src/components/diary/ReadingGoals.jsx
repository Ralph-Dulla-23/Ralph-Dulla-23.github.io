import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { toLocalDateKey, getCurrentLocalDateKey } from '../../domain/dates';
import { normalizeBookStatus, normalizeGameStatus } from '../../domain/status';

const fields = [
  { key:'yearlyBooks', label:'Books this year', max:1000 },
  { key:'monthlyBooks', label:'Books this month', max:100 },
  { key:'dailyMinutes', label:'Daily reading minutes', max:1440 },
  { key:'weeklyMinutes', label:'Weekly reading minutes', max:10080 },
  { key:'yearlyGames', label:'Games this year', max:1000 },
];
const defaults = Object.fromEntries(fields.map(f=>[f.key,0]));
const card='min-w-0 rounded-2xl border border-gray-200 bg-white dark:border-white/10 dark:bg-[#141b2c]';
function GoalProgress({title,value,target,unit}) {
  const percent=target>0?Math.min(100,Math.round(value/target*100)):0;
  return <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs"><span className="text-gray-600 dark:text-slate-300">{title}</span><span className="font-bold tabular-nums text-gray-800 dark:text-white">{value} / {target || '—'} {unit}</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700"><div className="h-full rounded-full bg-sky-500 motion-safe:transition-[width] motion-safe:duration-300" style={{width:`${percent}%`}}/></div></div>;
}
GoalProgress.propTypes={title:PropTypes.string.isRequired,value:PropTypes.number.isRequired,target:PropTypes.number.isRequired,unit:PropTypes.string.isRequired};
function startOfWeek(today) { const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7)); return date.toISOString().slice(0,10); }
function getProgress(books,games,sessions,today) {
  const y=today.slice(0,4),m=today.slice(0,7),w=startOfWeek(today);
  const finishes=(books||[]).filter(b=>normalizeBookStatus(b.status)==='completed').map(b=>toLocalDateKey(b.finishedOn||b.completedOn));
  const gameFinishes=(games||[]).filter(g=>normalizeGameStatus(g.status)==='completed').map(g=>toLocalDateKey(g.finishedOn||g.completedOn||g.dateFinished));
  const reading=(sessions||[]).filter(s=>s?.mediaType!=='game'&&s?.source!=='bookmory'&&s?.isDailySession!==false&&!/^bookmory_/i.test(String(s?.id||''))).map(s=>({date:toLocalDateKey(s.date||s.startedAt),mins:Math.max(0,s.activeSeconds!=null?Number(s.activeSeconds)/60:s.durationSeconds!=null?Number(s.durationSeconds)/60:Number(s.minutes)||0)}));
  return {yearlyBooks:finishes.filter(d=>d?.startsWith(y)).length,monthlyBooks:finishes.filter(d=>d?.startsWith(m)).length,dailyMinutes:Math.round(reading.filter(s=>s.date===today).reduce((n,s)=>n+s.mins,0)),weeklyMinutes:Math.round(reading.filter(s=>s.date>=w && s.date<=today).reduce((n,s)=>n+s.mins,0)),yearlyGames:gameFinishes.filter(d=>d?.startsWith(y)).length};
}
export default function ReadingGoals({books,sessions,games=[]}) {
  const {user}=useAuth();
  const [stored,setStored]=useState({...defaults,history:[]});
  const [draft,setDraft]=useState(defaults);
  const [expanded,setExpanded]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  const [available,setAvailable]=useState(false);
  useEffect(()=>{
    if(!db||!user?.uid) return undefined;
    return onSnapshot(doc(db,'users',user.uid,'goals','main'), snap=>{
      const data=snap.data()||{};
      const next=Object.fromEntries(fields.map(f=>[f.key,Math.max(0,Number(data[f.key])||0)]));
      setStored({...next,history:Array.isArray(data.history)?data.history:[]});setDraft(next);setAvailable(true);setError('');
    },err=>{setError(err.code==='permission-denied'?'Goals are blocked by Firestore permissions. Deploy the owner-only /users/{uid}/goals/{goalId} rule to the Firebase project this app uses, and confirm your signed-in UID.':`Unable to load goals: ${err.message}`);setAvailable(false);});
  },[user?.uid,retry]);
  const progress=useMemo(()=>getProgress(books,games,sessions,getCurrentLocalDateKey()),[books,games,sessions]);
  const save=async e=>{
    e.preventDefault();if(!user?.uid||!db)return;
    setLoading(true);setError('');
    const next=Object.fromEntries(fields.map(f=>[f.key,Math.max(0,Math.min(f.max,Number(draft[f.key])||0))]));
    const changed=fields.some(f=>next[f.key]!==stored[f.key]);
    const history=changed?[...(stored.history||[]),{date:getCurrentLocalDateKey(),...next}].slice(-60):stored.history||[];
    try{await setDoc(doc(db,'users',user.uid,'goals','main'),{...next,history,updatedAt:serverTimestamp()},{merge:true});}
    catch(err){setError(err.code==='permission-denied'?'Cannot save goals: Firestore rules do not allow this account to write /users/{uid}/goals/main. Deploy the rules and retry.':`Could not save goals: ${err.message}`);}
    finally{setLoading(false);}
  };
  return <section className={`${card} mt-4 overflow-hidden`} aria-label="Reading and gaming goals">
    <button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)} className="flex w-full items-center justify-between gap-4 p-4 text-left sm:p-5"><span className="min-w-0"><strong className="block text-sm font-bold text-gray-900 dark:text-white">Goals & target history</strong><span className="mt-1 block text-xs leading-5 text-gray-500 dark:text-slate-400">Five personal targets · progress and recorded target changes</span>{error && !expanded && <span className="mt-1 block text-[11px] text-amber-700 dark:text-amber-300">Goal permissions need attention · expand for details</span>}</span><span aria-hidden="true" className="shrink-0 text-gray-400">{expanded?'−':'+'}</span></button>
    {expanded && <div className="space-y-5 border-t border-gray-100 px-4 py-4 dark:border-white/10 sm:px-5">
      <div className="space-y-4">{fields.map(f=><GoalProgress key={f.key} title={f.label} value={progress[f.key]} target={stored[f.key]} unit={f.key.includes('Minutes')?'min':'items'}/>)}</div>
      <form onSubmit={save} className="grid grid-cols-2 gap-3 sm:grid-cols-3">{fields.map(f=><label key={f.key} className="min-w-0 text-xs leading-5 text-gray-600 dark:text-slate-300">{f.label}<input type="number" min="0" max={f.max} inputMode="numeric" value={draft[f.key]} onChange={e=>setDraft(v=>({...v,[f.key]:e.target.value}))} className="mt-1.5 block w-full min-w-0 rounded-xl border border-gray-200 bg-transparent px-3 py-2.5 text-gray-900 dark:border-slate-600 dark:text-white"/></label>)}<button type="submit" disabled={loading||!available} className="col-span-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 sm:col-span-1">{loading?'Saving...':'Save goals'}</button></form>
      <div className="space-y-2"><h4 className="text-xs font-bold text-gray-700 dark:text-slate-200">Goal history</h4>{stored.history?.length?<div className="max-h-52 space-y-2 overflow-y-auto">{[...stored.history].reverse().map((row,i)=><div key={`${row.date}-${i}`} className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-slate-300"><strong>{row.date}</strong> · {row.yearlyBooks||0} yearly books · {row.dailyMinutes||0} daily min · {row.yearlyGames||0} games</div>)}</div>:<p className="text-xs text-gray-500 dark:text-slate-400">No goal changes recorded yet. Future updates will appear here; historical values cannot be reconstructed.</p>}</div>
      {error&&<div role="alert" className="space-y-2 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300"><p>{error}</p><button type="button" onClick={()=>setRetry(v=>v+1)} className="rounded-lg border border-rose-200 px-3 py-1.5 font-semibold dark:border-rose-800">Retry after updating rules</button></div>}
    </div>}
  </section>;
}
ReadingGoals.propTypes={books:PropTypes.array.isRequired,games:PropTypes.array,sessions:PropTypes.array.isRequired};
