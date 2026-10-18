import { RAWG_API_KEY } from './config';

const RAWG_BASE_URL = 'https://api.rawg.io/api';

/**
 * Searches the RAWG video game database.
 * 
 * @param {string} query Search terms (game title)
 * @param {number} [page=1] Page number
 * @param {number} [pageSize=20] Results per page
 * @returns {Promise<Array<Object>>} Normalized game list
 */
export async function searchGames(query, page = 1, pageSize = 20) {
    if (!query || !query.trim()) return [];
    if (!RAWG_API_KEY) {
        console.warn('RAWG_API_KEY is not set in environment (VITE_RAWG_API_KEY).');
        return [];
    }

    const url = new URL(`${RAWG_BASE_URL}/games`);
    url.searchParams.set('key', RAWG_API_KEY);
    url.searchParams.set('search', query.trim());
    url.searchParams.set('page', String(page));
    url.searchParams.set('page_size', String(pageSize));

    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error(`RAWG search failed (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    const results = data.results || [];

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
