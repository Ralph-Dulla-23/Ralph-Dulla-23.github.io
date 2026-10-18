import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { exportUserData, downloadJsonBackup } from '../../lib/db';
import {
    BsController,
    BsBook,
    BsBarChart,
    BsPerson,
    BsBoxArrowRight,
    BsSun,
    BsMoonStars,
    BsDownload,
} from 'react-icons/bs';

const tabs = [
    { label: 'Games', path: '/app/games', icon: BsController },
    { label: 'Books', path: '/app/books', icon: BsBook },
    { label: 'Stats', path: '/stats', icon: BsBarChart },
    { label: 'Portfolio', path: '/', icon: BsPerson },
];

export const BottomTabs = ({ children, title = 'Diary', darkMode, setDarkMode }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [exporting, setExporting] = useState(false);

    const handleLogout = async () => {
        await logout();
        navigate('/');
    };

    const handleBackup = async () => {
        if (!user) return;
        setExporting(true);
        try {
            const data = await exportUserData(user.uid);
            downloadJsonBackup(data);
        } catch (err) {
            alert('Failed to export backup: ' + err.message);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className={`min-h-screen flex flex-col justify-between transition-colors ${darkMode ? 'dark bg-gray-950 text-gray-100' : 'bg-background text-primary'}`}>
            {/* Top Bar */}
            <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-border/50 dark:border-gray-800/50">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <NavLink
                            to="/app/games"
                            className="font-display font-bold text-lg text-primary dark:text-gray-100 flex items-center gap-2"
                        >
                            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block animate-pulse" />
                            {title}
                        </NavLink>
                    </div>

                    <div className="flex items-center gap-2">
                        {user && (
                            <span className="hidden sm:inline-block text-xs font-mono text-secondary dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                {user.email}
                            </span>
                        )}

                        {user && (
                            <button
                                onClick={handleBackup}
                                disabled={exporting}
                                className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-secondary dark:text-gray-300 hover:text-accent dark:hover:text-cyan-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer disabled:opacity-50"
                                title="Export Data Backup (JSON)"
                                aria-label="Export Data Backup"
                            >
                                <BsDownload className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
                            </button>
                        )}

                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
                            aria-label="Toggle Dark Mode"
                        >
                            {darkMode ? <BsMoonStars className="w-4 h-4" /> : <BsSun className="w-4 h-4" />}
                        </button>

                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-secondary dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                            title="Sign Out"
                            aria-label="Sign Out"
                        >
                            <BsBoxArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-12">
                {children}
            </main>

            {/* Bottom Tab Bar (Mobile & Desktop) */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-t border-border dark:border-gray-800 py-1.5 px-4 shadow-lg md:max-w-md md:left-1/2 md:-translate-x-1/2 md:bottom-4 md:rounded-full md:border">
                <div className="flex items-center justify-around">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <NavLink
                                key={tab.path}
                                to={tab.path}
                                className={({ isActive }) =>
                                    `flex flex-col items-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                                        isActive
                                            ? 'text-primary dark:text-gray-100 font-semibold'
                                            : 'text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                                    }`
                                }
                            >
                                {({ isActive }) => (
                                    <>
                                        <Icon className={`w-5 h-5 mb-0.5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                                        <span className="text-[10px] tracking-tight">{tab.label}</span>
                                    </>
                                )}
                            </NavLink>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

BottomTabs.propTypes = {
    children: PropTypes.node.isRequired,
    title: PropTypes.string,
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};

export default BottomTabs;
