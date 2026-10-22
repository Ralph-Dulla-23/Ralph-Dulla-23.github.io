/**
 * Steam Integration Utilities
 * Handles loading synced Steam profile data, recent activity, and playtime lookup.
 */

export const DEFAULT_STEAM_ID = '76561198417375364';
export const DEFAULT_PROFILE_URL = `https://steamcommunity.com/profiles/${DEFAULT_STEAM_ID}/`;

let cachedSteamData = null;

/**
 * Fetch static synced Steam stats from public/data/steam-stats.json
 * @param {boolean} [forceRefresh=false]
 * @returns {Promise<object|null>}
 */
export async function loadSteamStats(forceRefresh = false) {
    if (cachedSteamData && !forceRefresh) {
        return cachedSteamData;
    }

    try {
        const baseUrl = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
            ? import.meta.env.BASE_URL
            : '/';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        const url = `${cleanBase}data/steam-stats.json${forceRefresh ? `?_=${Date.now()}` : ''}`;

        const res = await fetch(url);
        if (!res.ok) {
            return null;
        }

        const data = await res.json();
        cachedSteamData = data;
        return data;
    } catch {
        return null;
    }
}

/**
 * Normalize game title for fuzzy matching (strips punctuation, extra spaces, accents)
 * @param {string} str
 * @returns {string}
 */
export function normalizeTitle(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .toLowerCase()
        .replace(/[:\-_'’™®]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Find Steam playtime for a given title against synced Steam stats
 * @param {string} queryTitle
 * @param {object|null} steamData
 * @returns {{ appId: string, name: string, hours: number, source: string } | null}
 */
export function findSteamGameHours(queryTitle, steamData) {
    if (!queryTitle || !steamData) return null;

    const normQuery = normalizeTitle(queryTitle);
    if (!normQuery) return null;

    // Search recent games first
    const pool = [
        ...(Array.isArray(steamData.recentGames) ? steamData.recentGames : []),
        ...(Array.isArray(steamData.ownedGamesSummary) ? steamData.ownedGamesSummary : []),
    ];

    // 1. Exact normalized match
    let found = pool.find(g => normalizeTitle(g.name) === normQuery);

    // 2. Contains match
    if (!found) {
        found = pool.find(g => {
            const normName = normalizeTitle(g.name);
            return normName.includes(normQuery) || normQuery.includes(normName);
        });
    }

    if (!found) return null;

    const hours = Number(found.playtimeForeverHours) || Number(found.hoursOnRecord) || 0;
    return {
        appId: found.appId || '',
        name: found.name,
        hours: Math.round(hours * 10) / 10,
        source: 'steam',
    };
}

/**
 * Get online state badge styling
 * @param {string} state
 * @returns {{ label: string, badgeClass: string, dotClass: string }}
 */
export function getSteamOnlineStatusConfig(state) {
    switch ((state || '').toLowerCase()) {
        case 'in-game':
            return {
                label: 'In-Game',
                badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
                dotClass: 'bg-emerald-500 animate-pulse',
            };
        case 'online':
            return {
                label: 'Online',
                badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
                dotClass: 'bg-blue-500',
            };
        default:
            return {
                label: 'Offline',
                badgeClass: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700',
                dotClass: 'bg-gray-400 dark:bg-gray-600',
            };
    }
}
