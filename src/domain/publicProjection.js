/**
 * Strictly allowlisted mapper for public shelf items and highlights.
 * Conforms to Section 10.4 and 14 (P4-01 & P4-02) of BOOKS_GAMES_DIARY_IMPLEMENTATION.md
 * and Section 5 (SEC-01) of DIARY_STABILIZATION_IMPLEMENTATION.md.
 * Never spreads private objects into public writes.
 */

export function toPublicShelfItem(item, publishOptions = {}) {
    if (!item || typeof item !== 'object') {
        throw new Error('Item must be a valid object to project to public shelf.');
    }

    const creators = Array.isArray(item.creators)
        ? [...item.creators]
        : item.author
        ? [item.author]
        : [];
    const author = item.author || (creators.length > 0 ? creators[0] : '');

    return {
        schemaVersion: 2,
        id: item.id,
        mediaType: item.mediaType || 'book',
        title: item.title,
        creators,
        author,
        coverUrl: item.coverUrl || item.cover || null,
        cover: item.cover || item.coverUrl || null,
        status: publishOptions.showStatus !== false ? item.status || null : null,
        rating: publishOptions.showRating !== false ? item.rating ?? null : null,
        ratingScale:
            publishOptions.showRating !== false
                ? item.ratingScale || (item.mediaType === 'game' ? 10 : 5)
                : null,
        tags:
            publishOptions.showTags !== false && Array.isArray(item.tags)
                ? [...item.tags]
                : [],
        genres: Array.isArray(item.genres) ? [...item.genres] : [],
        platforms: Array.isArray(item.platforms) ? [...item.platforms] : [],
        platform: item.platform || (Array.isArray(item.platforms) ? item.platforms[0] || '' : ''),
        hoursPlayed: typeof item.hoursPlayed === 'number' ? item.hoursPlayed : 0,
        pages: item.pages || item.progress?.total || null,
        currentPage: item.currentPage || item.progress?.current || 0,
        progress: item.progress || null,
        favorite: Boolean(item.favorite),
        publishedAt: new Date().toISOString(),
    };
}

export function toPublicHighlight(entry, publishOptions = {}) {
    if (!entry || typeof entry !== 'object') {
        throw new Error('Highlight must be a valid object to project to public highlights.');
    }

    return {
        schemaVersion: 2,
        id: entry.id,
        type: entry.type || 'book_quote',
        body: entry.body,
        mediaTitle: publishOptions.mediaTitle || entry.mediaTitle || entry.itemTitle || null,
        mediaType: publishOptions.mediaType || entry.mediaType || entry.linkedMediaType || null,
        mediaCover: publishOptions.mediaCover || entry.mediaCover || entry.itemCover || null,
        publishedAt: new Date().toISOString(),
    };
}
