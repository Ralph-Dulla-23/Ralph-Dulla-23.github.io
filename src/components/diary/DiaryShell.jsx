import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
    BsHouse,
    BsBook,
    BsCalendar3,
    BsJournalText,
    BsBarChart,
    BsPlusLg,
    BsSun,
    BsMoonStars,
    BsBoxArrowRight,
    BsDownload,
    BsPerson,
} from 'react-icons/bs';
import { useAuth } from '../../context/AuthContext';
import { exportUserData, downloadJsonBackup } from '../../lib/db';
import { PRIMARY_DIARY_TABS, getActiveTab } from './navigationConfig';
import { QuickActionModal } from './QuickActionModal';
import ActiveTimerTray from '../timer/ActiveTimerTray';
import ActivityTimerReviewModal from '../timer/ActivityTimerReviewModal';

const iconMap = {
    BsHouse,
    BsBook,
    BsCalendar3,
    BsJournalText,
    BsBarChart,
};

export function DiaryShell({ children, title = 'Diary', darkMode, setDarkMode }) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [exporting, setExporting] = useState(false);
    const [quickActionOpen, setQuickActionOpen] = useState(false);

    const activeTabId = getActiveTab(location.pathname);

    const handleLogout = async () => {
        await logout();
        navigate('/portfolio');
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
        <div className={`min-h-screen flex flex-col justify-between transition-colors ${darkMode ? 'dark bg-gray-950 text-gray-100' : 'bg-[#faf9f6] text-gray-900'}`}>
            {/* Top Bar Header with safe-area support */}
            <header
                className="sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 pt-[env(safe-area-inset-top,0px)]"
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            >
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <NavLink
                            to="/app/home"
                            className="font-display font-bold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2 hover:opacity-80 transition-opacity"
                            aria-label="Diary Home"
                        >
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                            {title}
                        </NavLink>
                    </div>

                    <div className="flex items-center gap-2">
                        {user && (
                            <span className="hidden sm:inline-block text-xs font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                                {user.email}
                            </span>
                        )}

                        {user && (
                            <button
                                onClick={handleBackup}
                                disabled={exporting}
                                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer disabled:opacity-50"
                                title="Export Full JSON Backup"
                                aria-label="Export Full JSON Backup"
                            >
                                <BsDownload className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} />
                            </button>
                        )}

                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
                            aria-label="Toggle Dark Mode"
                            title="Toggle Dark Mode"
                        >
                            {darkMode ? <BsMoonStars className="w-4 h-4" /> : <BsSun className="w-4 h-4" />}
                        </button>

                        <NavLink
                            to="/portfolio"
                            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
                            title="View Public Portfolio"
                            aria-label="View Public Portfolio"
                        >
                            <BsPerson className="w-4 h-4" />
                        </NavLink>

                        <button
                            onClick={handleLogout}
                            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all cursor-pointer"
                            title="Sign Out"
                            aria-label="Sign Out"
                        >
                            <BsBoxArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content with safe area padding */}
            <main
                className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-6 pb-32 md:pb-24"
                style={{ paddingBottom: 'calc(7rem + env(safe-area-inset-bottom, 0px))' }}
            >
                {children}
            </main>

            {/* Persistent 5-Tab Bar with Center Quick Add & safe area inset */}
            <nav
                className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-gray-950/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 py-1.5 px-3 pb-[env(safe-area-inset-bottom,0px)] shadow-lg md:max-w-lg md:left-1/2 md:-translate-x-1/2 md:bottom-4 md:rounded-full md:border"
                style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom, 0px))' }}
                aria-label="Primary Diary Navigation"
            >
                <div className="flex items-center justify-around gap-1">
                    {PRIMARY_DIARY_TABS.slice(0, 2).map((tab) => {
                        const IconComponent = iconMap[tab.iconName] || BsBook;
                        const isActive = activeTabId === tab.id;
                        return (
                            <NavLink
                                key={tab.id}
                                to={tab.path}
                                aria-label={tab.label}
                                className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-3 rounded-xl transition-all cursor-pointer ${
                                    isActive
                                        ? 'text-primary dark:text-emerald-400 font-bold scale-105'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                <IconComponent className="w-5 h-5 mb-0.5" />
                                <span className="text-[10px] tracking-tight">{tab.label}</span>
                            </NavLink>
                        );
                    })}

                    {/* Prominent Global + Quick Action Button */}
                    <div className="flex items-center justify-center px-1">
                        <button
                            onClick={() => setQuickActionOpen(true)}
                            className="w-12 h-12 min-h-[44px] min-w-[44px] rounded-full bg-primary dark:bg-emerald-500 text-white dark:text-gray-950 flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition-all cursor-pointer"
                            aria-label="Quick Log Action"
                            title="Quick Log Action"
                        >
                            <BsPlusLg className="w-5 h-5" />
                        </button>
                    </div>

                    {PRIMARY_DIARY_TABS.slice(2).map((tab) => {
                        const IconComponent = iconMap[tab.iconName] || BsBook;
                        const isActive = activeTabId === tab.id;
                        return (
                            <NavLink
                                key={tab.id}
                                to={tab.path}
                                aria-label={tab.label}
                                className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] py-1 px-3 rounded-xl transition-all cursor-pointer ${
                                    isActive
                                        ? 'text-primary dark:text-emerald-400 font-bold scale-105'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                                }`}
                            >
                                <IconComponent className="w-5 h-5 mb-0.5" />
                                <span className="text-[10px] tracking-tight">{tab.label}</span>
                            </NavLink>
                        );
                    })}
                </div>
            </nav>

            {/* Persistent Active Timer Mini Tray & Global Review Modal */}
            <ActiveTimerTray />
            <ActivityTimerReviewModal />

            {/* Quick Action Chooser Modal */}
            <QuickActionModal
                isOpen={quickActionOpen}
                onClose={() => setQuickActionOpen(false)}
            />
        </div>
    );
}

DiaryShell.propTypes = {
    children: PropTypes.node.isRequired,
    title: PropTypes.string,
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};

export default DiaryShell;
