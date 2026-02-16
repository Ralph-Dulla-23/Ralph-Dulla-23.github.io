import React, { useState, useEffect } from 'react';
import { BsSun, BsMoonStars } from 'react-icons/bs';

const navLinks = [
    { label: 'About', href: '#about' },
    { label: 'Experience', href: '#experience' },
    { label: 'Projects', href: '#projects' },
    { label: 'Certificates', href: '#certificates' },
    { label: 'Library', href: '#library' },
    { label: 'Contact', href: '#contact' },
];

const Layout = ({ children }) => {
    const [darkMode, setDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark' ||
                (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        return false;
    });

    const [scrolled, setScrolled] = useState(false);

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

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleNavClick = (e, href) => {
        e.preventDefault();
        const el = document.querySelector(href);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    return (
        <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-950' : 'bg-background'}`}>
            {/* Floating Navigation */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                ? 'bg-white/80 dark:bg-gray-950/80 backdrop-blur-md shadow-sm border-b border-border/50 dark:border-gray-800/50'
                : 'bg-transparent'
                }`}>
                <div className="max-w-3xl mx-auto px-6 flex items-center justify-between h-14">
                    <a
                        href="#hero"
                        onClick={(e) => handleNavClick(e, '#hero')}
                        className="font-display font-bold text-lg text-primary dark:text-gray-100 hover:opacity-70 transition-opacity cursor-pointer"
                    >
                        RD
                    </a>

                    <div className="flex items-center gap-6">
                        <div className="hidden sm:flex items-center gap-5">
                            {navLinks.map(link => (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    onClick={(e) => handleNavClick(e, link.href)}
                                    className="text-sm text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 transition-colors cursor-pointer"
                                >
                                    {link.label}
                                </a>
                            ))}
                        </div>

                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
                            aria-label="Toggle Dark Mode"
                        >
                            {darkMode ? <BsMoonStars className="w-4 h-4" /> : <BsSun className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-3xl mx-auto px-6 pt-20 pb-12 md:pt-20 md:pb-2 border-x border-dashed border-border dark:border-gray-800 min-h-screen bg-surface/50 dark:bg-gray-900/50 backdrop-blur-sm shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                {children}
            </main>
        </div>
    );
};

export default Layout;
