const OL_BASE_URL = 'https://openlibrary.org';
const COVERS_BASE_URL = 'https://covers.openlibrary.org/b/id';
const ITUNES_BOOKS_URL = 'https://itunes.apple.com/search';

const BOOK_GENRE_RULES = [
    { pattern: /fantasy|magic|dragons|fae|wizards|witches/i, name: 'Fantasy' },
    { pattern: /romance|love stories|contemporary romance/i, name: 'Romance' },
    { pattern: /science fiction|sci-fi|dystopia|cyberpunk|space opera/i, name: 'Sci-Fi' },
    { pattern: /mystery|detective|crime/i, name: 'Mystery' },
    { pattern: /thriller|suspense/i, name: 'Thriller' },
    { pattern: /young adult|ya fiction|juvenile|teen/i, name: 'Young Adult' },
    { pattern: /horror|ghost|supernatural|vampires|gothic/i, name: 'Horror' },
    { pattern: /historical|history/i, name: 'Historical' },
    { pattern: /biography|autobiography|memoir/i, name: 'Biography' },
    { pattern: /self-help|personal growth|productivity/i, name: 'Self-Help' },
    { pattern: /psychology|mental health/i, name: 'Psychology' },
    { pattern: /philosophy|stoicism/i, name: 'Philosophy' },
    { pattern: /business|economics|finance|leadership/i, name: 'Business' },
    { pattern: /nonfiction|non-fiction/i, name: 'Non-Fiction' },
    { pattern: /adventure|action/i, name: 'Adventure' },
    { pattern: /classic/i, name: 'Classics' },
    { pattern: /drama/i, name: 'Drama' },
    { pattern: /poetry|poems/i, name: 'Poetry' },
    { pattern: /fiction/i, name: 'Fiction' },
];

export function extractCleanBookGenres(rawSubjects = []) {
    if (!Array.isArray(rawSubjects) || rawSubjects.length === 0) return [];
    const combined = rawSubjects.join(' | ');
    const matched = new Set();

    for (const rule of BOOK_GENRE_RULES) {
        if (rule.pattern.test(combined)) {
            matched.add(rule.name);
        }
        if (matched.size >= 4) break;
    }

    if (matched.size > 0) {
        return Array.from(matched);
    }

    // Fallback: filter out noisy system tags from Open Library
    return rawSubjects
        .filter(
            s =>
                typeof s === 'string' &&
                s.length <= 28 &&
                !/[:_0-9]/.test(s) &&
                !/accessible book|protected daisy|in library|overdrive|new york times|large type|open syllabus|translations/i.test(s)
        )
        .slice(0, 3);
}

function normalizeBookKey(title) {
    return (title || '')
        .toLowerCase()
        .replace(/\(.*?\)/g, '')
        .split(':')[0]
        .replace(/[^a-z0-9]/g, '');
}

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

async function fetchOpenLibraryBooks(query, limit = 15) {
    const url = new URL(`${OL_BASE_URL}/search.json`);
    url.searchParams.set('q', query.trim());
    url.searchParams.set('limit', String(limit));
    url.searchParams.set(
        'fields',
        'key,title,author_name,cover_i,number_of_pages_median,first_publish_year,subject'
    );

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
            genres: extractCleanBookGenres(doc.subject || []),
        };
    });
}

async function fetchITunesBooks(query, limit = 10) {
    const url = `${ITUNES_BOOKS_URL}?term=${encodeURIComponent(query.trim())}&entity=ebook&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const results = data.results || [];

    return results.map(b => {
        const author = b.artistName || 'Unknown Author';
        const highResCover = b.artworkUrl100
            ? b.artworkUrl100.replace('100x100bb', '600x600bb')
            : '';
        return {
            olKey: b.trackId ? `itunes-${b.trackId}` : '',
            title: b.trackName || 'Untitled',
            authors: [author],
            author,
            coverId: null,
            cover: highResCover,
            pages: null,
            firstPublishYear: b.releaseDate ? new Date(b.releaseDate).getFullYear() : null,
            genres: extractCleanBookGenres(b.genres || []),
        };
    });
}

/**
 * Searches books on Open Library AND Apple iTunes Books API in parallel (no API key required).
 * Combines Open Library page counts with high-res covers and clean genres.
 *
 * @param {string} query Search terms (title, author, or keyword)
 * @param {number} [limit=15] Max results to return
 * @returns {Promise<Array<Object>>} Normalized book results
 */
export async function searchBooks(query, limit = 15) {
    if (!query || !query.trim()) return [];

    const [olSettled, itunesSettled] = await Promise.allSettled([
        fetchOpenLibraryBooks(query, limit),
        fetchITunesBooks(query, 10),
    ]);

    const olResults = olSettled.status === 'fulfilled' ? olSettled.value : [];
    const itunesResults = itunesSettled.status === 'fulfilled' ? itunesSettled.value : [];

    const mergedMap = new Map();

    for (const book of olResults) {
        const key = normalizeBookKey(book.title);
        if (!key) continue;
        if (!mergedMap.has(key)) {
            mergedMap.set(key, { ...book });
        } else {
            const existing = mergedMap.get(key);
            if (!existing.pages && book.pages) existing.pages = book.pages;
            if (!existing.cover && book.cover) {
                existing.cover = book.cover;
                existing.coverId = book.coverId;
            }
            if (existing.genres.length === 0 && book.genres.length > 0) {
                existing.genres = book.genres;
            }
        }
    }

    for (const ibook of itunesResults) {
        const key = normalizeBookKey(ibook.title);
        if (!key) continue;
        if (mergedMap.has(key)) {
            const existing = mergedMap.get(key);
            // Prefer iTunes crisp cover if OL has no cover, or supplement missing metadata
            if (!existing.cover && ibook.cover) {
                existing.cover = ibook.cover;
            }
            if (existing.author === 'Unknown Author' && ibook.author !== 'Unknown Author') {
                existing.author = ibook.author;
                existing.authors = ibook.authors;
            }
            if (ibook.genres?.length) {
                const combinedGenres = Array.from(new Set([...existing.genres, ...ibook.genres])).slice(0, 4);
                existing.genres = combinedGenres;
            }
        } else {
            mergedMap.set(key, ibook);
        }
    }

    const merged = Array.from(mergedMap.values());
    // Rank results that have covers and page counts first
    merged.sort((a, b) => {
        const scoreA = (a.cover ? 2 : 0) + (a.pages ? 1 : 0);
        const scoreB = (b.cover ? 2 : 0) + (b.pages ? 1 : 0);
        return scoreB - scoreA;
    });

    return merged.slice(0, limit);
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
