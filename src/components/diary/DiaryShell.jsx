import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BsHouse, BsBook, BsCalendar3, BsJournalText, BsBarChart, BsPlusLg,
  BsSun, BsMoonStars, BsBoxArrowRight, BsDownload, BsPerson, BsThreeDots, BsX,
} from 'react-icons/bs';
import { useAuth } from '../../context/AuthContext';
import { useTimer } from '../../context/TimerContext';
import { exportUserData, downloadJsonBackup, getAllSessions, getDiaryRepository } from '../../lib/db';
import { previewLegacySessionMigration } from '../../domain/legacySessionMigration';
import { buildDiaryRestorePlan, restoreDiaryBackup } from '../../services/diaryRestore';
import { db } from '../../lib/firebase';
import { measureFramePacing } from '../../lib/framePacing';
import { checkOwnerFirestoreAccess } from '../../lib/firebaseAccessCheck';
import { PRIMARY_DIARY_TABS, getActiveTab } from './navigationConfig';
import { QuickActionModal } from './QuickActionModal';
import ActiveTimerTray from '../timer/ActiveTimerTray';
import ActivityTimerReviewModal from '../timer/ActivityTimerReviewModal';
import ImmersiveReadingTimer from '../reading/ImmersiveReadingTimer';
import ReadingSessionResult from '../reading/ReadingSessionResult';

const icons = { BsHouse, BsBook, BsCalendar3, BsJournalText, BsBarChart };
const DiaryFrameContext = createContext(null);

// The legacy pages still use <DiaryShell title="…">. When inside the persistent
// route layout this adapter contributes only its page content + a header title;
// it does not create a second navigation bar or duplicate timer overlays.
function DiaryScreen({ title, children }) {
  const frame = useContext(DiaryFrameContext);
  useEffect(() => {
    frame?.setTitle(title || 'My Diary');
  }, [frame, title]);
  return <div className="diary-screen-enter min-w-0">{children}</div>;
}

DiaryScreen.propTypes = { title: PropTypes.string, children: PropTypes.node };

function DiaryFrame({ children, darkMode, setDarkMode }) {
  const { user, logout } = useAuth();
  const { activeTimer } = useTimer();
  const location = useLocation();
  const navigate = useNavigate();
  const [title, setTitle] = useState('My Diary');
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const restoreInputRef = useRef(null);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [firestoreError, setFirestoreError] = useState(null);
  const menuTriggerRef = useRef(null);
  const menuRef = useRef(null);
  const scrollPositions = useRef(new Map());
  const currentRouteRef = useRef(location.pathname);
  const frameContext = React.useMemo(() => ({ setTitle }), []);
  const activeTabId = getActiveTab(location.pathname);
  const isDetail = /^\/app\/(books|games)\/[^/]+/.test(location.pathname);

  useEffect(() => {
    const onError = (event) => setFirestoreError(event.detail?.message || 'Firestore access denied.');
    window.addEventListener('diary:firestore-access-error', onError);
    return () => window.removeEventListener('diary:firestore-access-error', onError);
  }, []);

  // Separate scroll position for each destination, with the shell mounted once.
  useEffect(() => {
    const previousRoute = currentRouteRef.current;
    if (previousRoute !== location.pathname) {
      scrollPositions.current.set(previousRoute, window.scrollY);
      currentRouteRef.current = location.pathname;
      window.scrollTo({ top: scrollPositions.current.get(location.pathname) || 0, behavior: 'instant' });
      setMenuOpen(false);
      setQuickActionOpen(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') { setMenuOpen(false); menuTriggerRef.current?.focus(); }
    };
    const onPointer = (event) => {
      if (!menuRef.current?.contains(event.target) && !menuTriggerRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer); };
  }, [menuOpen]);

  const handleBackup = async () => {
    if (!user || exporting) return;
    setExporting(true);
    try {
      const data = await exportUserData(user.uid);
      if (!data.isCloudComplete && !window.confirm('Cloud data could not be fully verified. This would be a PARTIAL backup. Download anyway?')) return;
      await downloadJsonBackup(data);
    } catch (error) {
      window.alert(`Failed to export diary backup: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleRestoreFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user || restoring) return;
    setRestoring(true);
    try {
      if (file.size > 25_000_000) throw new Error('Backup exceeds the 25 MB import limit.');
      const backup = JSON.parse(await file.text());
      const plan = buildDiaryRestorePlan(backup, user.uid);
      if (!plan.documentCount) throw new Error('No diary documents found.');
      if (!window.confirm(`Restore preview: ${plan.documentCount} records. Existing cloud records will be SKIPPED, never overwritten. Published shelf records will NOT be restored. Continue?`)) return;
      const result = await restoreDiaryBackup(db, plan);
      window.alert(`Restore finished: ${result.restored} missing documents added, ${result.skipped} existing documents preserved. Reopen the diary to refresh the view.`);
    } catch (error) {
      window.alert(`Restore stopped: ${error.message}. Existing documents were not deleted. If the connection failed midway, safely retry the same file.`);
    } finally { setRestoring(false); }
  };

  const handleLegacyMigration = async () => {
    if (!user?.uid || migrating) return;
    setMigrating(true);
    try {
      const repo = getDiaryRepository(user.uid);
      const [sessions, state] = await Promise.all([getAllSessions(user.uid), repo.getImportState()]);
      const preview = previewLegacySessionMigration(sessions, state.sessions || []);
      if (!preview.eligible.length) { window.alert(`No legacy sessions need copying. ${preview.skipped.length} records were already canonical, aggregates, or incomplete.`); return; }
      if (!window.confirm(`Migration preview: Copy ${preview.eligible.length} valid legacy sessions into the canonical collection without deleting originals. Create and verify a FULL backup first. Proceed?`)) return;
      let copied = 0;
      for (const session of preview.eligible) { await repo.createSession(session); copied++; }
      window.alert(`Migration complete: ${copied} sessions copied. Original legacy records preserved. Reopen Insights to refresh.`);
    } catch (error) { window.alert(`Migration stopped: ${error.message}. Previously copied records are safe; rerunning skips canonical IDs.`); }
    finally { setMigrating(false); }
  };

  const handleLogout = async () => {
    // Do not strand a running or unsaved session in unencrypted local storage.
    if (activeTimer) {
      window.alert('Finish and save, or discard, your active session before signing out.');
      return;
    }
    try { await logout(); navigate('/portfolio'); }
    catch (error) { window.alert(`Sign out failed: ${error.message}`); }
  };

  return (
    <DiaryFrameContext.Provider value={frameContext}>
      <div className={`diary-app min-h-screen flex flex-col ${darkMode ? 'dark bg-[#0c111b] text-[#f4f5f6]' : 'bg-[#faf8f5] text-[#22252c]'}`}>
        <header className="diary-header sticky top-0 z-40 border-b border-gray-200/70 dark:border-white/10 bg-[#faf8f5] dark:bg-[#0c111b]" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {isDetail ? (
                <button type="button" className="diary-icon-button shrink-0" onClick={() => navigate(-1)} aria-label="Go back"><span aria-hidden="true">←</span></button>
              ) : null}
              <NavLink to="/app/home" className="font-display font-semibold tracking-tight text-[17px] sm:text-lg truncate" aria-label="Diary Home">{title}</NavLink>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={() => setDarkMode(!darkMode)} className="diary-icon-button diary-press" aria-label={darkMode ? 'Use light appearance' : 'Use dark appearance'} title="Appearance">
                {darkMode ? <BsMoonStars className="w-[19px] h-[19px]" /> : <BsSun className="w-[19px] h-[19px]" />}
              </button>
              <div className="relative">
                <button ref={menuTriggerRef} type="button" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="diary-overflow-menu" aria-haspopup="menu" aria-label={menuOpen ? 'Close diary menu' : 'Open diary menu'} className="diary-icon-button diary-press">
                  {menuOpen ? <BsX className="w-6 h-6" /> : <BsThreeDots className="w-5 h-5" />}
                </button>
                {menuOpen && (
                  <div ref={menuRef} id="diary-overflow-menu" role="menu" aria-label="Diary options" className="diary-pop-in absolute z-50 right-0 top-12 w-[min(17rem,calc(100vw-2rem))] p-2 rounded-[20px] border border-gray-200 dark:border-slate-700 bg-white dark:bg-[#202a3a] shadow-xl">
                    <p className="px-3 py-2 text-xs text-gray-500 dark:text-slate-300 truncate">{user?.email || 'My Diary'}</p>
                    <NavLink role="menuitem" to="/portfolio" onClick={() => setMenuOpen(false)} className="diary-menu-item"><BsPerson aria-hidden="true" /> View portfolio</NavLink>
                    <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); void handleBackup(); }} disabled={exporting} className="diary-menu-item w-full disabled:opacity-50"><BsDownload aria-hidden="true" /> {exporting ? 'Preparing backup…' : 'Export backup'}</button>
                    <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); restoreInputRef.current?.click(); }} disabled={restoring} className="diary-menu-item w-full disabled:opacity-50"><BsDownload aria-hidden="true" /> {restoring ? 'Restoring…' : 'Restore backup (missing records only)'}</button>
                    <button role="menuitem" type="button" disabled={migrating} onClick={() => {setMenuOpen(false); void handleLegacyMigration();}} className="diary-menu-item w-full disabled:opacity-50">{migrating ? 'Migrating…' : 'Migrate legacy reading sessions'}</button>
                    <button role="menuitem" type="button" onClick={() => {setMenuOpen(false);window.alert('For the next 8 seconds, switch tabs, scroll or open the timer. The result measures frame pacing on this device.');void measureFramePacing({durationMs:8000}).then(v => window.alert(v.hidden ? 'Measurement stopped when the app was hidden.' : `Interaction frame pacing: ${v.averageFps.toFixed(1)} average FPS, ${v.p95FrameMs.toFixed(1)} ms p95, ${v.slowFrames60Hz}/${v.frames} slow frames, ${v.longTasks || 0} main-thread long tasks. Chrome DevTools is needed for root-cause tracing.`)).catch(err => window.alert(err.message));}} className="diary-menu-item w-full">Measure interactions (8s)</button>
                    <button role="menuitem" type="button" onClick={() => {setMenuOpen(false);void checkOwnerFirestoreAccess().then(rows => window.alert(rows.map(r => `${r.collection}: ${r.allowed ? 'ALLOWED' : (r.code || 'DENIED')}`).join('\n'))).catch(err => window.alert(err.message));}} className="diary-menu-item w-full">Check Firebase permissions</button>
                    <div className="my-1 border-t border-gray-200 dark:border-slate-600" />
                    <button role="menuitem" type="button" onClick={() => { setMenuOpen(false); void handleLogout(); }} className="diary-menu-item w-full text-red-600 dark:text-red-300"><BsBoxArrowRight aria-hidden="true" /> Sign out</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <input ref={restoreInputRef} type="file" accept="application/json,.json" aria-label="Select full diary backup to restore" onChange={handleRestoreFile} className="sr-only" />
        {firestoreError && (
          <div role="alert" className="max-w-4xl w-full mx-auto px-4 sm:px-6 pt-3">
            <div className="flex items-start gap-3 p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-sm">
              <p className="flex-1">{firestoreError}</p>
              <button type="button" onClick={() => setFirestoreError(null)} aria-label="Dismiss database error" className="min-w-8 min-h-8 font-bold">×</button>
            </div>
          </div>
        )}

        <main id="diary-main" className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-5 sm:pt-7" style={{ paddingBottom: 'calc(8.5rem + env(safe-area-inset-bottom, 0px))' }}>
          {children}
        </main>

        {/* Quick Add is an action, not an additional tab destination. */}
        {!activeTimer && <button type="button" onClick={() => setQuickActionOpen(true)} className="diary-fab diary-press fixed z-40 right-4 md:right-[max(1rem,calc((100vw-52rem)/2))]" style={{ bottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))' }} aria-label="Quick add a book, game, session or journal entry" title="Quick add"><BsPlusLg className="w-5 h-5" /></button>}

        <nav aria-label="Primary Diary Navigation" className="diary-bottom-nav fixed z-40 bottom-0 left-0 right-0 md:max-w-lg md:mx-auto md:bottom-4 md:rounded-[24px] border-t md:border border-gray-200 dark:border-white/10 bg-[#faf8f5] dark:bg-[#0c111b] shadow-[0_-6px_26px_rgba(0,0,0,.06)] px-2 pt-2" style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex items-stretch justify-around gap-0.5">
            {PRIMARY_DIARY_TABS.map((tab) => {
              const IconComponent = icons[tab.iconName] || BsBook;
              const selected = activeTabId === tab.id;
              return (
                <NavLink key={tab.id} to={tab.path} aria-current={selected ? 'page' : undefined} className={`diary-tab diary-press min-h-[44px] min-w-[44px] ${selected ? 'diary-tab-active' : ''}`}>
                  <span className="diary-tab-marker" aria-hidden="true" />
                  <IconComponent className="w-5 h-5" aria-hidden="true" />
                  <span className="text-[10px] sm:text-[11px] leading-none mt-1.5">{tab.label}</span>
                </NavLink>
              );
            })}
          </div>
        </nav>

        <ActiveTimerTray />
        <ActivityTimerReviewModal />
        <ImmersiveReadingTimer />
        <ReadingSessionResult />
        <QuickActionModal isOpen={quickActionOpen} onClose={() => setQuickActionOpen(false)} />
      </div>
    </DiaryFrameContext.Provider>
  );
}

DiaryFrame.propTypes = { children: PropTypes.node, darkMode: PropTypes.bool.isRequired, setDarkMode: PropTypes.func.isRequired };

export function DiaryShell({ children, title = 'My Diary', darkMode, setDarkMode }) {
  const existingFrame = useContext(DiaryFrameContext);
  if (existingFrame) return <DiaryScreen title={title}>{children}</DiaryScreen>;
  return <DiaryFrame darkMode={darkMode} setDarkMode={setDarkMode}><DiaryScreen title={title}>{children}</DiaryScreen></DiaryFrame>;
}

DiaryShell.propTypes = { children: PropTypes.node, title: PropTypes.string, darkMode: PropTypes.bool.isRequired, setDarkMode: PropTypes.func.isRequired };
export default DiaryShell;
