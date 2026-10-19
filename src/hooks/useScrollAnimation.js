import { useCallback, useRef } from 'react';

/**
 * Hook that adds scroll-triggered entrance animations using IntersectionObserver.
 * Adds 'is-visible' class when element enters the viewport.
 * Works reliably with both static mounts and conditional/tab re-renders using a callback ref.
 * 
 * @param {Object} options
 * @param {number} options.threshold - Visibility threshold (0-1), default 0.02
 * @param {string} options.rootMargin - Margin around root, default '0px 0px 50px 0px'
 * @returns {Function & { current: HTMLElement | null }} ref to attach to the animated element
 */
export function useScrollAnimation({ threshold = 0.02, rootMargin = '0px 0px 50px 0px' } = {}) {
    const observerRef = useRef(null);

    const refCallback = useCallback((element) => {
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }

        if (!element) return;

        // If already marked visible, keep it visible
        if (element.classList.contains('is-visible')) return;

        // Immediately reveal if reduced motion is requested or if already in/above the viewport
        const prefersReducedMotion = typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        const rect = element.getBoundingClientRect();
        const isInViewportOrAbove = rect.top < (window.innerHeight || document.documentElement.clientHeight);

        if (prefersReducedMotion || isInViewportOrAbove) {
            element.classList.add('is-visible');
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target); // Only animate once
                }
            },
            { threshold, rootMargin }
        );

        observer.observe(element);
        observerRef.current = observer;
    }, [threshold, rootMargin]);

    return refCallback;
}
