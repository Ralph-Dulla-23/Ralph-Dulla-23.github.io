/** Measure actual requestAnimationFrame cadence on the current device, on demand.
 * This does NOT replace a Chrome DevTools frame trace during a real transition.
 */
export function measureFramePacing({ durationMs = 2400, onSample } = {}) {
  if (typeof window === 'undefined' || !window.requestAnimationFrame) return Promise.reject(new Error('Frame measurement requires a browser.'));
  return new Promise((resolve) => {
    const gaps = [];
    let longTasks = 0;
    let observer = null;
    try {
      if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
        observer = new PerformanceObserver(list => { longTasks += list.getEntries().length; });
        observer.observe({entryTypes:['longtask']});
      }
    } catch { observer = null; }
    let start = 0, previous = 0;
    let hidden = document.hidden;
    const visibility = () => { if (document.hidden) hidden = true; };
    document.addEventListener('visibilitychange', visibility);
    const tick = (t) => {
      if (!start) { start = t; previous = t; }
      else { const gap = t - previous; if (gap > 0) gaps.push(gap); previous = t; }
      if (t - start < durationMs && !hidden) window.requestAnimationFrame(tick);
      else {
        document.removeEventListener('visibilitychange', visibility);
        observer?.disconnect();
        const sorted = [...gaps].sort((a,b) => a-b);
        const percentile = (q) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0;
        const average = gaps.length ? gaps.reduce((a,b) => a+b,0)/gaps.length : 0;
        const result = { frames: gaps.length, averageFps: average ? 1000/average : 0,
          p95FrameMs: percentile(.95), slowFrames60Hz: gaps.filter(ms=>ms>20).length,
          hidden, longTasks, durationMs: Math.round(t-start) };
        onSample?.(result); resolve(result);
      }
    };
    window.requestAnimationFrame(tick);
  });
}
