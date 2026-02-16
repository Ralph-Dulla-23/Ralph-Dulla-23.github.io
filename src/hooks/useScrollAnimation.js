import { useEffect, useRef } from 'react';

/**
 * Hook that adds scroll-triggered entrance animations using IntersectionObserver.
 * Adds 'is-visible' class when element enters the viewport.
 * 
 * @param {Object} options
 * @param {number} options.threshold - Visibility threshold (0-1), default 0.15
 * @param {string} options.rootMargin - Margin around root, default '0px 0px -40px 0px'
 * @returns {React.RefObject} ref to attach to the animated element
 */
export function useScrollAnimation({ threshold = 0.15, rootMargin = '0px 0px -40px 0px' } = {}) {
    const ref = useRef(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

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

        return () => observer.disconnect();
    }, [threshold, rootMargin]);

    return ref;
}
