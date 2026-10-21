import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import { BsCheck, BsChevronDown } from 'react-icons/bs';

/** Styled, keyboard-accessible single-select; list is portalled above modal masks. */
export default function DiarySelect({ value, onChange, options, label = 'Select option', disabled = false, className = '' }) {
  const listId = useId();
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const [active, setActive] = useState(0);
  const normalized = options.map(opt => typeof opt === 'string' ? { value: opt, label: opt } : opt);
  const selectedIndex = normalized.findIndex(o => String(o.value) === String(value));
  const currentLabel = selectedIndex >= 0 ? normalized[selectedIndex].label : label;
  const updateRect = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const estimatedHeight = Math.min(280, normalized.length * 44 + 12);
    const below = window.innerHeight - r.bottom;
    const upwards = below < estimatedHeight + 16 && r.top > below;
    setRect({ left: Math.max(8, r.left), width: Math.min(r.width, window.innerWidth - 16), top: upwards ? Math.max(8, r.top - estimatedHeight - 6) : r.bottom + 6 });
  }, [normalized.length]);

  useEffect(() => {
    if (!open) return;
    updateRect();
    const closeOutside = (event) => {
      if (!triggerRef.current?.contains(event.target) && !listRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnScroll = (event) => {
      // Scrolling within the options is fine; parent/page scrolling should dismiss.
      if (!listRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('resize', updateRect);
    document.addEventListener('scroll', closeOnScroll, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('resize', updateRect);
      document.removeEventListener('scroll', closeOnScroll, true);
    };
  }, [open, updateRect]);
  useEffect(() => { if (open) listRef.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => { if (open) document.getElementById(`${listId}-item-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [open, active, listId]);
  const choose = (index) => {
    if (index < 0 || index >= normalized.length) return;
    onChange(String(normalized[index].value));
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); triggerRef.current?.focus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setActive(Math.max(0, selectedIndex)); setOpen(true); }
      else setActive(i => Math.min(normalized.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Home' && open) { e.preventDefault(); setActive(0); }
    else if (e.key === 'End' && open) { e.preventDefault(); setActive(normalized.length - 1); }
    else if ((e.key === 'Enter' || e.key === ' ') && open) { e.preventDefault(); choose(active); }
  };
  return <>
    <button ref={triggerRef} type="button" disabled={disabled} aria-haspopup="listbox" aria-controls={open ? listId : undefined} aria-expanded={open} aria-label={label} onKeyDown={onKeyDown} onClick={() => {
      if (!open) { setActive(Math.max(0, selectedIndex)); updateRect(); }
      setOpen(!open);
    }} className={`diary-select-trigger ${className}`}>
      <span className="min-w-0 truncate text-left">{currentLabel}</span><BsChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
    </button>
    {open && rect && createPortal(
      <div ref={listRef} id={listId} role="listbox" tabIndex={-1} aria-label={label} aria-activedescendant={`${listId}-item-${active}`} onKeyDown={onKeyDown} className="diary-select-options" style={{ left: rect.left, top: rect.top, width: rect.width }}>
        {normalized.map((opt, i) => <button key={`${opt.value}-${i}`} type="button" id={`${listId}-item-${i}`} role="option" aria-selected={i === selectedIndex} onPointerMove={() => setActive(i)} onClick={() => choose(i)} className={`diary-select-option ${i === active ? 'diary-select-option-active' : ''}`}>
          <span className="flex-1 truncate text-left">{opt.label}</span>{i === selectedIndex && <BsCheck className="h-4 w-4 text-sky-500" aria-hidden="true"/>}
        </button>)}
      </div>, document.body
    )}
  </>;
}
DiarySelect.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.shape({ value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired, label: PropTypes.string.isRequired })])).isRequired,
  label: PropTypes.string,
  disabled: PropTypes.bool,
  className: PropTypes.string,
};
