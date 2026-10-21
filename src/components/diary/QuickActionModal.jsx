import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { BsBook, BsController, BsClockHistory, BsJournalPlus, BsX, BsChevronRight } from 'react-icons/bs';
import { QUICK_ACTIONS } from './navigationConfig';

const icons = { BsBook, BsController, BsClockHistory, BsJournalPlus };

export function QuickActionModal({ isOpen, onClose }) {
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const returnFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const elements = Array.from(dialogRef.current.querySelectorAll('button:not([disabled]),a[href],input:not([disabled])'));
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocus?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/55" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="quick-actions-title" aria-describedby="quick-actions-description" className="diary-sheet-enter w-full sm:max-w-[440px] rounded-t-[28px] sm:rounded-[24px] bg-[#faf8f5] dark:bg-[#161e2b] text-gray-900 dark:text-slate-100 border border-gray-200/70 dark:border-slate-700 shadow-2xl px-5 pt-4 max-h-[min(85dvh,700px)] overflow-y-auto" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))' }}>
        <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-slate-600 mx-auto mb-5 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 mb-4">
          <div><h2 id="quick-actions-title" className="font-display font-bold text-xl">What would you like to log?</h2><p id="quick-actions-description" className="text-xs text-gray-500 dark:text-slate-400 mt-1">A quick way to capture a new chapter or adventure.</p></div>
          <button ref={closeRef} type="button" onClick={onClose} className="diary-icon-button diary-press shrink-0" aria-label="Close quick actions"><BsX className="w-6 h-6" /></button>
        </div>
        <div className="grid gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = icons[action.iconName] || BsJournalPlus;
            return <button type="button" key={action.id} onClick={() => { onClose(); if (action.target) navigate(action.target); }} className="diary-press min-h-[68px] w-full flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-800 border border-gray-200/75 dark:border-slate-700 p-3 text-left hover:border-sky-300 dark:hover:border-sky-700">
              <span className="w-11 h-11 shrink-0 rounded-[14px] grid place-items-center bg-[#eaf2f5] dark:bg-sky-950/50 text-[#3f7e98] dark:text-sky-300"><Icon className="w-5 h-5" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{action.title}</span><span className="block text-xs text-gray-500 dark:text-slate-400 mt-0.5">{action.description}</span></span>
              <BsChevronRight className="text-gray-400 shrink-0" aria-hidden="true" />
            </button>;
          })}
        </div>
      </section>
    </div>
  );
}
QuickActionModal.propTypes = { isOpen: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired };
