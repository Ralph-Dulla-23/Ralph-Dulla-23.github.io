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

    const nodeProcess = typeof globalThis !== 'undefined' ? globalThis.process : undefined;
    if (typeof window === 'undefined' && nodeProcess?.cwd) {
        try {
            const fsName = 'node:fs';
            const pathName = 'node:path';
            const fs = await import(/* @vite-ignore */ fsName);
            const path = await import(/* @vite-ignore */ pathName);
            const filePath = path.resolve(nodeProcess.cwd(), 'public', 'data', 'steam-stats.json');
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                cachedSteamData = data;
                return data;
            }
        } catch {
            // fallback to fetch
        }
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
        lastPlayedTimestamp: found.lastPlayedTimestamp || 0,
        lastPlayed: found.lastPlayed || null,
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

/**
 * Resolves a unified list of games by merging diary records with synced Steam stats.
 * - Steam titles are enriched with verified hours, app IDs, and store URLs.
 * - Owned Steam games with >= 1.0 hr playtime not yet in the diary are appended.
 * - Sorted by recent activity (latest played / completed / updated first).
 * @param {Array} [games=[]] User's diary games
 * @param {object|null} [steamData=null] Synced Steam dataset
 * @returns {Array} Unified game objects
 */
export function getUnifiedGames(games = [], steamData = null) {
    const steamTitles = new Set();
    const enriched = (Array.isArray(games) ? games : []).map((g) => {
        const match = findSteamGameHours(g.title, steamData);
        if (match) {
            steamTitles.add(normalizeTitle(g.title));
            return {
                ...g,
                isSteam: true,
                steamAppId: match.appId,
                hoursPlayed: Number(g.hoursPlayed) || match.hours || 0,
                lastPlayedTimestamp: match.lastPlayedTimestamp || 0,
                lastPlayed: match.lastPlayed || null,
                storeUrl: match.appId ? `https://store.steampowered.com/app/${match.appId}` : null,
            };
        }
        return g;
    });

    const pool = [
        ...(Array.isArray(steamData?.ownedGamesSummary) ? steamData.ownedGamesSummary : []),
        ...(Array.isArray(steamData?.recentGames) ? steamData.recentGames : []),
    ];

    const recentAppIds = new Set(
        (Array.isArray(steamData?.recentGames) ? steamData.recentGames : []).map((g) => String(g.appId))
    );

    const seenAppIds = new Set(
        enriched.filter((g) => g.steamAppId).map((g) => String(g.steamAppId))
    );

    const additionalSteamGames = [];
    for (const sg of pool) {
        const safeAppId = String(sg.appId);
        const normTitle = normalizeTitle(sg.name);
        const hours = Number(sg.playtimeForeverHours) || 0;
        if (
            safeAppId !== '480' &&
            sg.name &&
            sg.name !== 'Spacewar' &&
            hours >= 1 &&
            !seenAppIds.has(safeAppId) &&
            !steamTitles.has(normTitle)
        ) {
            seenAppIds.add(safeAppId);
            steamTitles.add(normTitle);
            additionalSteamGames.push({
                id: `steam-${safeAppId}`,
                title: sg.name,
                cover: sg.logoUrl || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${safeAppId}/header.jpg`,
                platform: 'Steam',
                hoursPlayed: hours,
                lastPlayedTimestamp: Number(sg.lastPlayedTimestamp) || 0,
                lastPlayed: sg.lastPlayed || null,
                isRecent: recentAppIds.has(safeAppId) || Boolean(sg.playtime2WkHours > 0),
                rating: null,
                status: hours > 0 ? 'playing' : 'backlog',
                isSteam: true,
                steamAppId: safeAppId,
                storeUrl: sg.storeUrl || `https://store.steampowered.com/app/${safeAppId}`,
                finishedOn: null,
            });
        }
    }

    const getActivityTime = (item) => {
        if (item.lastPlayedTimestamp) return Number(item.lastPlayedTimestamp) * 1000;
        if (item.finishedOn) {
            const t = new Date(item.finishedOn).getTime();
            if (!isNaN(t)) return t;
        }
        if (item.startedOn) {
            const t = new Date(item.startedOn).getTime();
            if (!isNaN(t)) return t;
        }
        if (item.updatedAt) {
            const t = new Date(item.updatedAt?.toDate ? item.updatedAt.toDate() : item.updatedAt).getTime();
            if (!isNaN(t)) return t;
        }
        return 0;
    };

    const all = [...enriched, ...additionalSteamGames];
    all.sort((a, b) => {
        const timeA = getActivityTime(a);
        const timeB = getActivityTime(b);
        if (timeB !== timeA) return timeB - timeA;
        return (Number(b.hoursPlayed) || 0) - (Number(a.hoursPlayed) || 0);
    });

    return all;
}
