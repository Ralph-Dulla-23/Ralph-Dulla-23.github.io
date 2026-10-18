import { RAWG_API_KEY } from './config';

const RAWG_BASE_URL = 'https://api.rawg.io/api';
const WIKI_API_URL = 'https://en.wikipedia.org/w/api.php';
const CHEAPSHARK_API_URL = 'https://www.cheapshark.com/api/1.0/games';

const PLATFORM_CATEGORY_MAP = [
    { pattern: /windows games|personal computer games|macos games|linux games|dos games/i, name: 'PC' },
    { pattern: /playstation 5 games/i, name: 'PS5' },
    { pattern: /playstation 4 games/i, name: 'PS4' },
    { pattern: /playstation 3 games|playstation 2 games|playstation \(console\) games/i, name: 'PlayStation' },
    { pattern: /nintendo switch 2 games|nintendo switch games/i, name: 'Switch' },
    { pattern: /xbox series x and series s games|xbox one games|xbox 360 games|xbox games/i, name: 'Xbox' },
    { pattern: /android \(operating system\) games|ios games|mobile games/i, name: 'Mobile' },
];

const GENRE_PATTERNS = [
    { pattern: /action role-playing/i, name: 'Action RPG' },
    { pattern: /action-adventure/i, name: 'Action-Adventure' },
    { pattern: /role-playing/i, name: 'RPG' },
    { pattern: /soulslike/i, name: 'Soulslike' },
    { pattern: /open-world|open world/i, name: 'Open World' },
    { pattern: /first-person shooter|third-person shooter|shooter/i, name: 'Shooter' },
    { pattern: /real-time strategy|turn-based strategy|strategy/i, name: 'Strategy' },
    { pattern: /roguelike/i, name: 'Roguelike' },
    { pattern: /platform|metroidvania/i, name: 'Platformer' },
    { pattern: /survival horror|horror/i, name: 'Horror' },
    { pattern: /life simulation|simulation/i, name: 'Simulation' },
    { pattern: /sports/i, name: 'Sports' },
    { pattern: /racing/i, name: 'Racing' },
    { pattern: /fighting/i, name: 'Fighting' },
    { pattern: /puzzle/i, name: 'Puzzle' },
    { pattern: /survival/i, name: 'Survival' },
    { pattern: /visual novel/i, name: 'Visual Novel' },
    { pattern: /indie/i, name: 'Indie' },
    { pattern: /adventure/i, name: 'Adventure' },
    { pattern: /action/i, name: 'Action' },
];

function normalizeKey(str) {
    return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseWikiGamePage(page) {
    const rawTitle = page.title || '';
    const desc = page.description || '';
    const categories = (page.categories || []).map(c => c.title || '');
    const catsText = categories.join(' | ');
    const combinedText = `${rawTitle} | ${desc} | ${catsText}`;

    const isGame =
        /\(video game\)/i.test(rawTitle) ||
        /video game|computer game|expansion pack|arcade game|mobile game/i.test(desc) ||
        categories.some(c => /video games| games$/i.test(c));

    const cleanTitle = rawTitle
        .replace(/\s*\((?:\d{4}\s+)?video game\)/i, '')
        .replace(/\s*\(series\)/i, '')
        .trim();

    // Extract release year from categories or description
    let year = '';
    for (const cat of categories) {
        const m = cat.match(/Category:(19\d\d|20\d\d)\s+video games/i);
        if (m) {
            year = m[1];
            break;
        }
    }
    if (!year) {
        const descMatch = desc.match(/\b(19\d\d|20\d\d)\b/) || rawTitle.match(/\((19\d\d|20\d\d)\s+video game\)/i);
        if (descMatch) year = descMatch[1];
    }

    // Extract platforms
    const platformsSet = new Set();
    for (const rule of PLATFORM_CATEGORY_MAP) {
        if (rule.pattern.test(catsText) || rule.pattern.test(desc)) {
            platformsSet.add(rule.name);
        }
    }
    const platforms = platformsSet.size > 0 ? Array.from(platformsSet) : ['PC'];

    // Extract clean genres
    const genresSet = new Set();
    for (const rule of GENRE_PATTERNS) {
        if (rule.pattern.test(combinedText)) {
            genresSet.add(rule.name);
        }
        if (genresSet.size >= 4) break;
    }
    const genres = genresSet.size > 0 ? Array.from(genresSet) : ['Action', 'Adventure'];

    const cover = page.original?.source || page.thumbnail?.source || '';

    return {
        isGame,
        index: page.index || 999,
        game: {
            rawgId: `wiki-${page.pageid}`,
            title: cleanTitle || rawTitle,
            cover,
            released: year ? `${year}-01-01` : '',
            genres,
            platforms,
            metacritic: null,
            communityRating: null,
        },
    };
}

async function searchWikipediaGames(query, pageSize = 15) {
    const url = `${WIKI_API_URL}?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(
        query.trim() + ' video game'
    )}&gsrlimit=${pageSize}&prop=pageimages|description|categories&piprop=thumbnail|original&pithumbsize=600&pilicense=any&cllimit=30&clshow=!hidden`;

    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data.query?.pages ? Object.values(data.query.pages) : [];

    const parsed = pages.map(parseWikiGamePage);
    const gamesOnly = parsed.filter(p => p.isGame);
    const list = gamesOnly.length > 0 ? gamesOnly : parsed;

    list.sort((a, b) => {
        if (a.isGame !== b.isGame) return a.isGame ? -1 : 1;
        return a.index - b.index;
    });

    return list.map(item => item.game);
}

async function searchCheapSharkGames(query, limit = 8) {
    const url = `${CHEAPSHARK_API_URL}?title=${encodeURIComponent(query.trim())}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data.map(item => {
        const steamHeader = item.steamAppID
            ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${item.steamAppID}/header.jpg`
            : '';
        return {
            rawgId: `cs-${item.gameID}`,
            title: item.external || 'Unknown Game',
            cover: steamHeader || item.thumb || '',
            released: '',
            genres: ['Action', 'PC'],
            platforms: ['PC'],
            metacritic: null,
            communityRating: null,
        };
    });
}

/**
 * Searches games using RAWG (if API key configured) with an automatic 100% free
 * zero-API-key fallback powered by Wikipedia Video Games API + CheapShark API.
 *
 * @param {string} query Search terms (game title)
 * @param {number} [page=1] Page number
 * @param {number} [pageSize=15] Results per page
 * @returns {Promise<Array<Object>>} Normalized game list
 */
export async function searchGames(query, page = 1, pageSize = 15) {
    if (!query || !query.trim()) return [];

    // 1. Try RAWG first if API key is present
    if (RAWG_API_KEY) {
        try {
            const url = new URL(`${RAWG_BASE_URL}/games`);
            url.searchParams.set('key', RAWG_API_KEY);
            url.searchParams.set('search', query.trim());
            url.searchParams.set('page', String(page));
            url.searchParams.set('page_size', String(pageSize));

            const res = await fetch(url.toString());
            if (res.ok) {
                const data = await res.json();
                const results = data.results || [];
                if (results.length > 0) {
                    return results.map(g => ({
                        rawgId: g.id,
                        title: g.name,
                        cover: g.background_image || '',
                        released: g.released || '',
                        genres: (g.genres || []).map(genre => genre.name),
                        platforms: (g.platforms || []).map(p => p.platform?.name).filter(Boolean),
                        metacritic: g.metacritic || null,
                        communityRating: g.rating || null,
                    }));
                }
            }
        } catch (err) {
            console.warn('RAWG API search failed, falling back to free game search:', err);
        }
    }

    // 2. Zero-API-key parallel search via Wikipedia Video Games API + CheapShark API
    const [wikiSettled, csSettled] = await Promise.allSettled([
        searchWikipediaGames(query, pageSize),
        searchCheapSharkGames(query, 8),
    ]);

    const wikiResults = wikiSettled.status === 'fulfilled' ? wikiSettled.value : [];
    const csResults = csSettled.status === 'fulfilled' ? csSettled.value : [];

    const mergedMap = new Map();

    for (const game of wikiResults) {
        const key = normalizeKey(game.title);
        if (!key) continue;
        if (!mergedMap.has(key)) {
            mergedMap.set(key, { ...game });
        }
    }

    for (const csGame of csResults) {
        const key = normalizeKey(csGame.title);
        if (!key) continue;
        if (mergedMap.has(key)) {
            const existing = mergedMap.get(key);
            if (!existing.cover && csGame.cover) {
                existing.cover = csGame.cover;
            }
        } else {
            mergedMap.set(key, csGame);
        }
    }

    return Array.from(mergedMap.values()).slice(0, pageSize);
}

/**
 * Fetches full details for a game from RAWG.
 *
 * @param {number|string} rawgId The RAWG game ID
 * @returns {Promise<Object>} Detailed game info
 */
export async function getGameDetails(rawgId) {
    if (!rawgId) throw new Error('Game ID is required');
    if (!RAWG_API_KEY) {
        throw new Error('RAWG_API_KEY is not set. Add VITE_RAWG_API_KEY to your .env file.');
    }

    const url = `${RAWG_BASE_URL}/games/${rawgId}?key=${RAWG_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch game details (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    return {
        rawgId: data.id,
        title: data.name,
        description: data.description_raw || data.description || '',
        cover: data.background_image || '',
        released: data.released || '',
        genres: (data.genres || []).map(g => g.name),
        platforms: (data.platforms || []).map(p => p.platform?.name).filter(Boolean),
        developers: (data.developers || []).map(d => d.name),
        publishers: (data.publishers || []).map(p => p.name),
        metacritic: data.metacritic || null,
        website: data.website || '',
    };
}
