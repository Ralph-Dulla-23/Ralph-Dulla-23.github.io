import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { BsSun, BsMoonStars, BsList, BsX, BsController } from 'react-icons/bs';
import { GooeyFilter } from '@/components/ui/gooey-filter';
import { PixelTrail } from '@/components/ui/pixel-trail';
import { useScreenSize } from '@/hooks/use-screen-size';
import { useAuth } from '../context/AuthContext';
import Typewriter from './ui/typewriter';
import { lenisRef } from '../lib/scrollController';

const TYPEWRITER_LABELS = ['RD', 'RDeveloper', 'RDesigner'];

const navLinks = [
    { label: 'About', href: '#about' },
    { label: 'Experience', href: '#experience' },
    { label: 'Projects', href: '#projects' },
    { label: 'Certificates', href: '#certificates' },
    { label: 'Library', href: '#library' },
    { label: 'Contact', href: '#contact' },
];

/**
 * Main Layout component that provides the theme, navigation, and background effects.
 * 
 * @component
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components to render in the main content area
 * @param {boolean} props.darkMode - Current theme state
 * @param {Function} props.setDarkMode - Function to toggle theme state
 */
const Layout = ({ children, darkMode, setDarkMode }) => {
    const { isOwner } = useAuth();
    const isNative = typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
    const showDiaryButton = isOwner || isNative;

    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const screenSize = useScreenSize();

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile menu when screen expands beyond mobile
    const isMobile = screenSize.lessThan('sm');
    const [prevIsMobile, setPrevIsMobile] = useState(isMobile);
    if (prevIsMobile !== isMobile) {
        setPrevIsMobile(isMobile);
        if (!isMobile && mobileMenuOpen) {
            setMobileMenuOpen(false);
        }
    }

    // Close mobile menu on Escape key press
    useEffect(() => {
        if (!mobileMenuOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setMobileMenuOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [mobileMenuOpen]);

    const handleNavClick = (e, href) => {
        e.preventDefault();
        setMobileMenuOpen(false);
        const el = document.querySelector(href);
        if (el) {
            if (lenisRef?.current) {
                lenisRef.current.scrollTo(el);
            } else {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    };

    return (
        <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-gray-950' : 'bg-background'}`}>
            {/* Gooey Pixel Trail — background sides only, hidden on small screens and touch devices */}
            {!screenSize.lessThan('md') && (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) && (
                <>
                    <GooeyFilter id="gooey-bg" strength={5} />
                    <div
                        className="fixed inset-0 z-0 pointer-events-auto"
                        style={{ filter: 'url(#gooey-bg)' }}
                    >
                        <PixelTrail
                            pixelSize={screenSize.greaterThanOrEqual('xl') ? 32 : 24}
                            fadeDuration={500}
                            delay={0}
                            pixelColor={darkMode ? "#ffffff" : "#1f2937"}
                        />
                    </div>
                </>
            )}
            {/* Floating Navigation */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled || mobileMenuOpen
                ? 'bg-white/80 dark:bg-gray-950/80 backdrop-blur-md shadow-sm border-b border-border/50 dark:border-gray-800/50'
                : 'bg-transparent'
                }`}>
                <div className="max-w-3xl mx-auto px-6 flex items-center justify-between h-14">
                    <a
                        href="#hero"
                        onClick={(e) => handleNavClick(e, '#hero')}
                        className="font-display font-bold text-lg text-primary dark:text-gray-100 hover:opacity-70 transition-opacity cursor-pointer min-w-[120px]"
                    >
                        <Typewriter labels={TYPEWRITER_LABELS} />
                    </a>

                    <div className="flex items-center gap-3 sm:gap-6">
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

                        {/* Mobile Menu Toggle Button */}
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="sm:hidden p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
                            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                            aria-expanded={mobileMenuOpen}
                        >
                            {mobileMenuOpen ? <BsX className="w-5 h-5" /> : <BsList className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Navigation Dropdown */}
                {mobileMenuOpen && (
                    <div className="sm:hidden border-t border-border/50 dark:border-gray-800/50 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md px-6 py-4 shadow-lg transition-all">
                        <div className="flex flex-col space-y-3">
                            {navLinks.map(link => (
                                <a
                                    key={link.href}
                                    href={link.href}
                                    onClick={(e) => handleNavClick(e, link.href)}
                                    className="text-base font-medium py-1.5 text-secondary dark:text-gray-300 hover:text-primary dark:hover:text-white transition-colors cursor-pointer"
                                >
                                    {link.label}
                                </a>
                            ))}
                            {showDiaryButton && (
                                <Link
                                    to="/app/games"
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="flex items-center gap-2 text-base font-semibold py-1.5 text-primary dark:text-white hover:opacity-80 transition-opacity pt-2 border-t border-border/40 dark:border-gray-800/60"
                                >
                                    <BsController className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    <span>Open Diary App</span>
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </nav>

            <main className="relative z-10 max-w-3xl mx-auto px-6 pt-20 pb-12 md:pt-20 md:pb-2 border-x border-dashed border-border dark:border-gray-800 min-h-screen bg-surface/50 dark:bg-gray-900/50 md:backdrop-blur-sm shadow-sm ring-1 ring-black/5 dark:ring-white/5">
                {children}
            </main>

            {/* Floating Diary App Pill for Owner or Native App */}
            {showDiaryButton && (
                <Link
                    to="/app/games"
                    aria-label="Open Diary App"
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-white dark:bg-gray-100 dark:text-gray-900 shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all text-xs font-semibold backdrop-blur-md cursor-pointer border border-white/20 dark:border-gray-800 group"
                >
                    <BsController className="w-4 h-4 text-purple-400 dark:text-purple-600 transition-transform group-hover:rotate-12" />
                    <span>Open Diary App</span>
                </Link>
            )}
        </div>
    );
};

Layout.propTypes = {
    children: PropTypes.node.isRequired,
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};

export default Layout;
