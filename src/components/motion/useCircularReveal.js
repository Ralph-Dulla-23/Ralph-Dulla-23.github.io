import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { getCircularRevealGeometry } from './revealGeometry';

const OPEN_DURATION = 420;
const CLOSE_DURATION = 320;
const DIAMETER = 160;
const EASE = 'cubic-bezier(.22, 1, .36, 1)';

function reduceMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Compositor-friendly bottom-to-top circular reveal.
 * Animate one small, solid-color circle using GPU transform/opacity, instead of
 * clip-path on an entire React tree (a paint-heavy path on some Android WebViews).
 * Content fades in at the end. The timer clock and persisted state never change.
 */
export function useCircularReveal(origin, onMinimize) {
  const surfaceRef = useRef(null);
  const circleRef = useRef(null);
  const animationsRef = useRef([]);
  const closingRef = useRef(false);
  const onMinimizeRef = useRef(onMinimize);
  useEffect(() => { onMinimizeRef.current = onMinimize; }, [onMinimize]);

  const makeCircle = useCallback(() => {
    const node = surfaceRef.current;
    if (!node) return null;
    const { x, y, radius } = getCircularRevealGeometry(origin, window.innerWidth, window.innerHeight);
    const maxScale = radius / (DIAMETER / 2);
    const circle = document.createElement('div');
    Object.assign(circle.style, {
      position: 'fixed', left: `${x}px`, top: `${y}px`, width: `${DIAMETER}px`, height: `${DIAMETER}px`,
      zIndex: '59', pointerEvents: 'none', borderRadius: '50%',
      backgroundColor: window.getComputedStyle(node).backgroundColor,
      transformOrigin: 'center', transform: 'translate3d(-50%, -50%, 0) scale(0.001)',
      willChange: 'transform',
    });
    circle.setAttribute('aria-hidden', 'true');
    document.body.appendChild(circle);
    circleRef.current = circle;
    return { circle, maxScale };
  }, [origin]);

  useLayoutEffect(() => {
    const node = surfaceRef.current;
    if (!node) return undefined;
    if (reduceMotion() || typeof node.animate !== 'function') return undefined;

    const item = makeCircle();
    if (!item) return undefined;
    const { circle, maxScale } = item;
    node.style.opacity = '0';
    const grow = circle.animate([
      { transform: 'translate3d(-50%, -50%, 0) scale(0.001)' },
      { transform: `translate3d(-50%, -50%, 0) scale(${maxScale})` },
    ], { duration: OPEN_DURATION, easing: EASE, fill: 'forwards' });
    const reveal = node.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: 120, delay: 300, easing: 'ease-out', fill: 'forwards' });
    animationsRef.current = [grow, reveal];
    void grow.finished.then(() => {
      if (closingRef.current) return;
      node.style.opacity = '1';
      grow.cancel(); reveal.cancel();
      circle.remove();
      circleRef.current = null;
      animationsRef.current = [];
    }).catch(() => {});
    return () => {
      animationsRef.current.forEach((animation) => animation.cancel());
      animationsRef.current = [];
      circle.remove();
      circleRef.current = null;
      node.style.opacity = '';
    };
    // The origin is captured on focus mount; do not replay when the clock ticks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeWithReveal = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    const node = surfaceRef.current;
    if (!node || reduceMotion() || typeof node.animate !== 'function') {
      onMinimizeRef.current();
      return;
    }

    const existing = circleRef.current;
    const fromTransform = existing ? window.getComputedStyle(existing).transform : null;
    animationsRef.current.forEach((animation) => animation.cancel());
    const entry = existing
      ? { circle: existing }
      : makeCircle();
    if (!entry) { onMinimizeRef.current(); return; }
    const { circle } = entry;
    const { radius } = getCircularRevealGeometry(origin, window.innerWidth, window.innerHeight);
    const maxScale = radius / (DIAMETER / 2);
    const initialTransform = fromTransform && fromTransform !== 'none'
      ? fromTransform
      : `translate3d(-50%, -50%, 0) scale(${maxScale})`;
    circle.style.transform = initialTransform;
    node.style.opacity = '0';
    const shrink = circle.animate([
      { transform: initialTransform },
      { transform: 'translate3d(-50%, -50%, 0) scale(0.001)' },
    ], { duration: CLOSE_DURATION, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' });
    animationsRef.current = [shrink];
    void shrink.finished.then(() => {
      circle.remove();
      circleRef.current = null;
      onMinimizeRef.current();
    }).catch(() => {});
  }, [origin, makeCircle]);

  return { surfaceRef, closeWithReveal };
}
