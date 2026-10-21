import { useEffect, useState } from 'react';

// Display-only clock: elapsed time is always calculated from original timestamps.
// A suspended WebView or throttled interval cannot change the recorded duration.
export function useElapsedDisplay(activeTimer, visible = true) {
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        if (activeTimer?.state !== 'running' || !visible) return undefined;
        // Background WebViews throttle timers; don't burn CPU while hidden.
        const refresh = () => { if (!document.hidden) setNow(Date.now()); };
        refresh();
        const interval = window.setInterval(refresh, 1000);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            window.clearInterval(interval);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [activeTimer?.state, activeTimer?.runningSinceEpochMs, visible]);

    if (!activeTimer) return 0;
    const base = Number(activeTimer.accumulatedActiveMs) || 0;
    const elapsed = activeTimer.state === 'running' && activeTimer.runningSinceEpochMs
        ? Math.max(0, now - Number(activeTimer.runningSinceEpochMs))
        : 0;
    return Math.max(0, Math.floor((base + elapsed) / 1000));
}

export function formatClock(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return [Math.floor(value / 3600), Math.floor((value % 3600) / 60), value % 60]
        .map((n) => String(n).padStart(2, '0')).join(':');
}
