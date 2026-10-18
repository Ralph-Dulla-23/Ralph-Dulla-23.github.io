const OL_BASE_URL = 'https://openlibrary.org';
const COVERS_BASE_URL = 'https://covers.openlibrary.org/b/id';

/**
 * Builds an Open Library cover image URL.
 * 
 * @param {number|string} coverId The Open Library cover ID
 * @param {'S'|'M'|'L'} [size='L'] Image size (S=small, M=medium, L=large)
 * @returns {string} Image URL or empty string
 */
export function getBookCoverUrl(coverId, size = 'L') {
    if (!coverId) return '';
    return `${COVERS_BASE_URL}/${coverId}-${size}.jpg`;
}

/**
 * Searches books on Open Library (no API key required).
 * 
 * @param {string} query Search terms (title, author, or keyword)
 * @param {number} [limit=20] Max results to return
 * @returns {Promise<Array<Object>>} Normalized book results
 */
export async function searchBooks(query, limit = 20) {
    if (!query || !query.trim()) return [];

    const url = new URL(`${OL_BASE_URL}/search.json`);
    url.searchParams.set('q', query.trim());
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('fields', 'key,title,author_name,cover_i,number_of_pages_median,first_publish_year,subject');

    const res = await fetch(url.toString());
    if (!res.ok) {
        throw new Error(`Open Library search failed (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    const docs = data.docs || [];

    return docs.map(doc => {
        const coverId = doc.cover_i || null;
        const authors = doc.author_name || [];
        return {
            olKey: doc.key || '',
            title: doc.title || 'Untitled',
            authors,
            author: authors.join(', ') || 'Unknown Author',
            coverId,
            cover: coverId ? getBookCoverUrl(coverId, 'L') : '',
            pages: doc.number_of_pages_median || null,
            firstPublishYear: doc.first_publish_year || null,
            genres: (doc.subject || []).slice(0, 6),
        };
    });
}

/**
 * Fetches additional work/book details from Open Library.
 * 
 * @param {string} workKey Open Library key (e.g. "/works/OL45883W" or "OL45883W")
 * @returns {Promise<Object>} Book metadata
 */
export async function getBookDetails(workKey) {
    if (!workKey) throw new Error('Work key is required');
    const path = workKey.startsWith('/') ? workKey : `/works/${workKey}`;
    const url = `${OL_BASE_URL}${path}.json`;

    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to fetch Open Library details (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    let description = '';
    if (typeof data.description === 'string') {
        description = data.description;
    } else if (data.description && typeof data.description.value === 'string') {
        description = data.description.value;
    }

    return {
        olKey: data.key,
        title: data.title,
        description,
        subjects: data.subjects || [],
        covers: (data.covers || []).filter(c => c > 0),
    };
}
