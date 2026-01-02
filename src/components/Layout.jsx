import React, { useState, useEffect } from 'react';
import { BsSun, BsMoonStars } from 'react-icons/bs';

const Layout = ({ children }) => {
    const [darkMode, setDarkMode] = useState(() => {
        // Check local storage or system preference
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark' ||
                (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        return false;
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (darkMode) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [darkMode]);

    return (
        <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-950' : 'bg-background'}`}>
            <main className="max-w-3xl mx-auto px-6 py-12 md:py-2 border-x border-dashed border-border dark:border-gray-800 min-h-screen bg-surface/50 dark:bg-gray-900/50 backdrop-blur-sm shadow-sm ring-1 ring-black/5 dark:ring-white/5 relative">
                <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all shadow-sm z-10"
                    aria-label="Toggle Dark Mode"
                >
                    {darkMode ? <BsMoonStars className="w-5 h-5" /> : <BsSun className="w-5 h-5" />}
                </button>
                {children}
            </main>
        </div>
    );
};

export default Layout;
