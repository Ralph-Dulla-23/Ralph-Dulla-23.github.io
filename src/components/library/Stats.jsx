import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './Icons';

export const useCounter = (target, duration = 1200) => {
    const [val, setVal] = useState(0);
    const ref = useRef(null);
    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) {
                let start = 0;
                const step = target / (duration / 16);
                const tick = () => {
                    start += step;
                    if (start >= target) { setVal(target); return; }
                    setVal(Math.floor(start));
                    requestAnimationFrame(tick);
                };
                tick();
                obs.disconnect();
            }
        }, { threshold: 0.3 });
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, [target, duration]);
    return [val, ref];
};

export const StatCard = ({ icon, label, value, suffix = '' }) => {
    const [count, ref] = useCounter(typeof value === 'number' ? value : 0);
    const display = typeof value === 'number' ? count + suffix : value;
    return (
        <div ref={ref} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 text-center">
            <div className="flex justify-center mb-1 text-secondary dark:text-gray-400">{icon}</div>
            <p className="text-2xl font-display font-bold text-primary dark:text-gray-100">{display}</p>
            <p className="text-xs text-secondary dark:text-gray-400 mt-1">{label}</p>
        </div>
    );
};

export const ProgressRing = ({ pctComplete, completedCount, totalCount }) => {
    const [animated, setAnimated] = useState(false);
    const ref = useRef(null);
    const r = 70, circ = 2 * Math.PI * r;
    const offset = circ - (pctComplete / 100) * circ;

    useEffect(() => {
        const obs = new IntersectionObserver(([e]) => {
            if (e.isIntersecting) { setAnimated(true); obs.disconnect(); }
        }, { threshold: 0.3 });
        if (ref.current) obs.observe(ref.current);
        return () => obs.disconnect();
    }, []);

    return (
        <div ref={ref} className="flex flex-col items-center justify-center">
            <svg width="180" height="180" className="transform -rotate-90">
                <circle cx="90" cy="90" r={r} stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="12" fill="none" />
                <circle cx="90" cy="90" r={r} stroke="url(#ringGrad)" strokeWidth="12" fill="none" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={animated ? offset : circ}
                    style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
                />
                <defs>
                    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#6ee7b7" />
                        <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="absolute text-center">
                <p className="text-3xl font-display font-bold text-primary dark:text-gray-100">{pctComplete}%</p>
                <p className="text-xs text-secondary dark:text-gray-400 mt-0.5">{completedCount} / {totalCount} read</p>
            </div>
        </div>
    );
};
