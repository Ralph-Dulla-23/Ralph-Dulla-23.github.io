#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT_DIR, 'public', 'data', 'steam-stats.json');

// Auto-load local .env if present
const envPath = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            const key = k.trim();
            const val = v.join('=').trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[key] && val) {
                process.env[key] = val;
            }
        }
    }
}

const DEFAULT_STEAM_ID = '76561198417375364';
const steamId = process.env.STEAM_ID64 || process.argv[2] || DEFAULT_STEAM_ID;
const apiKey = process.env.STEAM_API_KEY || null;

/**
 * Clean XML CDATA or plain text
 */
function cleanXmlVal(str) {
    if (!str) return '';
    return str.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').trim();
}

/**
 * Extract a single tag value from XML string
 */
function extractTag(xml, tag) {
    const regex = new RegExp(`<${tag}>(.*?)</${tag}>`, 's');
    const match = xml.match(regex);
    return match ? cleanXmlVal(match[1]) : '';
}

/**
 * Parse the public XML feed from Steam Community
 */
export function parseSteamXmlProfile(xml) {
    const steamId64 = extractTag(xml, 'steamID64') || DEFAULT_STEAM_ID;
    const personaName = extractTag(xml, 'steamID') || 'Steam User';
    const realName = extractTag(xml, 'realname') || '';
    const onlineState = extractTag(xml, 'onlineState') || 'offline';
    const stateMessage = extractTag(xml, 'stateMessage') || (onlineState === 'in-game' ? 'In-Game' : onlineState === 'online' ? 'Online' : 'Offline');
    const avatarUrl = extractTag(xml, 'avatarFull') || extractTag(xml, 'avatarMedium') || '';
    const memberSince = extractTag(xml, 'memberSince') || '';
    const summary = extractTag(xml, 'summary') || '';
    const hoursPlayed2Wk = parseFloat(extractTag(xml, 'hoursPlayed2Wk')) || 0;
    const customURL = extractTag(xml, 'customURL') || '';

    const profileUrl = customURL
        ? `https://steamcommunity.com/id/${customURL}/`
        : `https://steamcommunity.com/profiles/${steamId64}/`;

    // Parse mostPlayedGames
    const recentGames = [];
    const gameBlocks = xml.match(/<mostPlayedGame>([\s\S]*?)<\/mostPlayedGame>/g) || [];

    for (const block of gameBlocks) {
        const name = extractTag(block, 'gameName');
        const link = extractTag(block, 'gameLink');
        const iconUrl = extractTag(block, 'gameIcon');
        const logoUrl = extractTag(block, 'gameLogo');
        const hoursPlayed = parseFloat(extractTag(block, 'hoursPlayed')) || 0;
        const hoursOnRecord = parseFloat(extractTag(block, 'hoursOnRecord')) || 0;
        const statsName = extractTag(block, 'statsName');

        // Extract appId from link or statsName
        const appIdMatch = link.match(/\/app\/(\d+)/) || (statsName && statsName.match(/^\d+$/) ? [null, statsName] : null);
        const appId = appIdMatch ? appIdMatch[1] : statsName || '';

        if (name && appId !== '480') {
            recentGames.push({
                appId,
                name,
                playtime2WkHours: hoursPlayed,
                playtimeForeverHours: hoursOnRecord,
                iconUrl,
                logoUrl: logoUrl || (appId ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg` : ''),
                storeUrl: appId ? `https://store.steampowered.com/app/${appId}` : link || profileUrl,
            });
        }
    }

    const totalHours = recentGames.reduce((acc, g) => acc + (g.playtimeForeverHours || 0), 0);

    return {
        updatedAt: new Date().toISOString(),
        steamId64,
        personaName,
        realName,
        profileUrl,
        onlineState,
        stateMessage,
        avatarUrl,
        memberSince,
        summary: summary.replace(/<[^>]*>/g, '').trim(),
        hoursPlayed2Wk,
        totalGames: recentGames.length,
        totalHours: Math.round(totalHours * 10) / 10,
        recentGames,
        source: 'public_xml',
    };
}

/**
 * Fetch profile via Web API (when API key is present)
 */
async function fetchViaSteamApi(key, id) {
    const summaryRes = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${id}`);
    if (!summaryRes.ok) throw new Error(`Steam API player summary failed: ${summaryRes.status}`);
    const summaryData = await summaryRes.json();
    const player = summaryData?.response?.players?.[0];
    if (!player) throw new Error('Player not found in Steam API response');

    let ownedGames = [];
    try {
        const ownedRes = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${key}&steamid=${id}&include_appinfo=1&include_played_free_games=1`);
        if (ownedRes.ok) {
            const ownedData = await ownedRes.json();
            ownedGames = ownedData?.response?.games || [];
        }
    } catch (e) {
        console.warn('Could not fetch owned games:', e.message);
    }

    let recentGamesRaw = [];
    try {
        const recentRes = await fetch(`https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${key}&steamid=${id}`);
        if (recentRes.ok) {
            const recentData = await recentRes.json();
            recentGamesRaw = recentData?.response?.games || [];
        }
    } catch (e) {
        console.warn('Could not fetch recently played games:', e.message);
    }

    const stateMap = { 0: 'offline', 1: 'online', 2: 'busy', 3: 'away', 4: 'snooze', 5: 'looking to trade', 6: 'looking to play' };
    const onlineState = player.gameextrainfo ? 'in-game' : (stateMap[player.personastate] || 'offline');
    const stateMessage = player.gameextrainfo ? `Playing ${player.gameextrainfo}` : (onlineState === 'online' ? 'Online' : 'Offline');

    const totalHours = ownedGames.reduce((acc, g) => acc + ((g.playtime_forever || 0) / 60), 0);

    const recentGames = recentGamesRaw.filter(g => String(g.appid) !== '480' && g.name).map(g => ({
        appId: String(g.appid),
        name: g.name,
        playtime2WkHours: Math.round(((g.playtime_2weeks || 0) / 60) * 10) / 10,
        playtimeForeverHours: Math.round(((g.playtime_forever || 0) / 60) * 10) / 10,
        iconUrl: g.img_icon_url ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg` : '',
        logoUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`,
        storeUrl: `https://store.steampowered.com/app/${g.appid}`,
    }));

    // If recent games empty but owned games exist, pick top 5 by playtime
    if (recentGames.length === 0 && ownedGames.length > 0) {
        const sorted = [...ownedGames].sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0)).slice(0, 5);
        for (const g of sorted) {
            recentGames.push({
                appId: String(g.appid),
                name: g.name,
                playtime2WkHours: 0,
                playtimeForeverHours: Math.round(((g.playtime_forever || 0) / 60) * 10) / 10,
                iconUrl: g.img_icon_url ? `https://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg` : '',
                logoUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`,
                storeUrl: `https://store.steampowered.com/app/${g.appid}`,
            });
        }
    }

    return {
        updatedAt: new Date().toISOString(),
        steamId64: String(player.steamid),
        personaName: player.personaname,
        realName: player.realname || '',
        profileUrl: player.profileurl,
        onlineState,
        stateMessage,
        avatarUrl: player.avatarfull || player.avatarmedium,
        memberSince: player.timecreated ? new Date(player.timecreated * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '',
        summary: '',
        hoursPlayed2Wk: Math.round(recentGamesRaw.reduce((acc, g) => acc + ((g.playtime_2weeks || 0) / 60), 0) * 10) / 10,
        totalGames: ownedGames.length || recentGames.length,
        totalHours: Math.round(totalHours * 10) / 10,
        recentGames,
        ownedGamesSummary: ownedGames
            .filter(g => String(g.appid) !== '480' && g.name && Math.round(((g.playtime_forever || 0) / 60) * 10) / 10 >= 1.0)
            .map(g => ({
                appId: String(g.appid),
                name: g.name,
                playtimeForeverHours: Math.round(((g.playtime_forever || 0) / 60) * 10) / 10,
                logoUrl: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${g.appid}/header.jpg`,
                storeUrl: `https://store.steampowered.com/app/${g.appid}`,
            })),
        source: 'steam_web_api',
    };
}

/**
 * Main fetch & write pipeline
 */
export async function syncSteamStats() {
    console.log(`[Steam Sync] Starting sync for SteamID: ${steamId}`);
    let data;

    if (apiKey) {
        try {
            console.log('[Steam Sync] Using Steam Web API with API key...');
            data = await fetchViaSteamApi(apiKey, steamId);
        } catch (err) {
            console.warn(`[Steam Sync] API key fetch failed: ${err.message}. Falling back to public XML feed...`);
        }
    }

    if (!data) {
        console.log('[Steam Sync] Fetching public Steam XML feed...');
        const res = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Steam-Stats-Sync',
            },
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch Steam profile XML: HTTP ${res.status}`);
        }
        const xml = await res.text();
        data = parseSteamXmlProfile(xml);
    }

    const dir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`[Steam Sync] Successfully wrote Steam stats to ${OUTPUT_FILE}`);
    console.log(`[Steam Sync] Profile: ${data.personaName} (${data.onlineState}) | Recent games: ${data.recentGames?.length || 0}`);
    return data;
}

// Auto-run if executed directly
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
    syncSteamStats().catch(err => {
        console.error('[Steam Sync] Error:', err);
        process.exit(1);
    });
}
