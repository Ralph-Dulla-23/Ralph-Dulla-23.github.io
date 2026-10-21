import { useLayoutEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';

/** Isolated, DOM-local counter: does not re-render the rest of a metrics dashboard each frame. */
export default function AnimatedNumber({ value, decimals = 0 }) {
  const nodeRef = useRef(null);
  const previousRef = useRef(Number(value));
  const formatter = useMemo(() => new Intl.NumberFormat(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }), [decimals]);
  useLayoutEffect(() => {
    const node = nodeRef.current;
    const end = Number(value);
    if (!node || !Number.isFinite(end)) return undefined;
    const start = previousRef.current;
    previousRef.current = end;
    const format = (n) => formatter.format(n);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!Number.isFinite(start) || start === end || reduced) {
      node.textContent = format(end);
      return undefined;
    }
    const begin = performance.now();
    let frame;
    let lastText = '';
    let lastPaint = 0;
    const tick = (now) => {
      // Rendering text at 30fps is visually smooth for counters and reduces formatting/DOM work.
      if (now - lastPaint < 32 && lastPaint && now - begin < 450) {
        frame = requestAnimationFrame(tick);
        return;
      }
      lastPaint = now;
      const progress = Math.min(1, (now - begin) / 450);
      const eased = 1 - Math.pow(1 - progress, 3);
      const text = format(start + (end - start) * eased);
      if (text !== lastText) { node.textContent = text; lastText = text; }
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, decimals, formatter]);
  return <span ref={nodeRef} aria-label={Number(value).toLocaleString()} className="tabular-nums">{formatter.format(Number(value))}</span>;
}
AnimatedNumber.propTypes = { value: PropTypes.number.isRequired, decimals: PropTypes.number };
