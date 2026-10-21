import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { BsX } from 'react-icons/bs';

/** Portal prevents animated/translated route parents from trapping position:fixed. */
export default function DiaryEditorModal({ title, onClose, children, footer, busy = false }) {
  const headingId = useId();
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  const closeCallback = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    closeCallback.current = onClose;
    busyRef.current = busy;
  });
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busyRef.current) { event.preventDefault(); closeCallback.current(); }
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = [...panelRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
        if (!focusable.length) return;
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return createPortal(
    <div className="diary-editor-backdrop" role="presentation">
      <section ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={headingId} className="diary-editor-panel">
        <header className="diary-editor-header">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-sky-600 dark:text-sky-300">Personal library</p>
            <h2 id={headingId} className="mt-1 text-lg font-bold leading-snug text-gray-950 dark:text-gray-50">{title}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} disabled={busy} className="diary-editor-close" aria-label="Close editor"><BsX size={24}/></button>
        </header>
        <div className="diary-editor-scroll">{children}</div>
        <footer className="diary-editor-footer">{footer}</footer>
      </section>
    </div>, document.body
  );
}
DiaryEditorModal.propTypes = {
  title: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node,
  footer: PropTypes.node,
  busy: PropTypes.bool,
};
