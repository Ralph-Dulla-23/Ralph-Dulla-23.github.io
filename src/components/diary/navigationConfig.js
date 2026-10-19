/**
 * Navigation configuration for the persistent 5-tab Diary Shell.
 * Grounded in Section 3 of BOOKS_GAMES_DIARY_IMPLEMENTATION.md.
 */

export const PRIMARY_DIARY_TABS = Object.freeze([
    {
        id: 'home',
        label: 'Home',
        path: '/app/home',
        iconName: 'BsHouse',
    },
    {
        id: 'library',
        label: 'Library',
        path: '/app/library/books',
        iconName: 'BsBook',
    },
    {
        id: 'calendar',
        label: 'Calendar',
        path: '/app/calendar',
        iconName: 'BsCalendar3',
    },
    {
        id: 'journal',
        label: 'Journal',
        path: '/app/journal',
        iconName: 'BsJournalText',
    },
    {
        id: 'insights',
        label: 'Insights',
        path: '/app/insights',
        iconName: 'BsBarChart',
    },
]);

export const QUICK_ACTIONS = Object.freeze([
    {
        id: 'add_book',
        title: 'Add Book',
        description: 'Search catalog or enter metadata',
        target: '/app/library/books?action=add',
        iconName: 'BsBook',
    },
    {
        id: 'add_game',
        title: 'Add Game',
        description: 'Log a new title in your backlog',
        target: '/app/library/games?action=add',
        iconName: 'BsController',
    },
    {
        id: 'log_reading',
        title: 'Log Reading',
        description: 'Record pages read or manual time',
        target: '/app/library/books?action=log',
        iconName: 'BsClockHistory',
    },
    {
        id: 'log_playtime',
        title: 'Log Playtime',
        description: 'Record gaming hours and progress',
        target: '/app/library/games?action=log',
        iconName: 'BsController',
    },
    {
        id: 'write_note',
        title: 'Write Note',
        description: 'Capture a reflection, review or quote',
        target: '/app/journal?action=new',
        iconName: 'BsJournalPlus',
    },
]);

/**
 * Derives active tab directly from current pathname, avoiding stale state desync.
 *
 * @param {string} pathname
 * @returns {string|null} Active tab ID ('home', 'library', 'calendar', 'journal', 'insights') or null
 */
export function getActiveTab(pathname = '') {
    if (!pathname || typeof pathname !== 'string') return null;

    if (pathname === '/app/home' || pathname === '/app') {
        return 'home';
    }
    if (
        pathname.startsWith('/app/library') ||
        pathname.startsWith('/app/books') ||
        pathname.startsWith('/app/games')
    ) {
        return 'library';
    }
    if (pathname.startsWith('/app/calendar')) {
        return 'calendar';
    }
    if (pathname.startsWith('/app/journal')) {
        return 'journal';
    }
    if (pathname.startsWith('/app/insights')) {
        return 'insights';
    }

    return null;
}
