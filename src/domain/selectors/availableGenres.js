/** Only offer genres found in the publicly published collection. */
export function getAvailableGenres(books = []) {
    const counts = new Map();
    books.forEach((book) => {
        const genres = Array.isArray(book?.genres) ? book.genres : [];
        const uniqueForBook = new Set(genres.map((g) => typeof g === 'string' ? g.trim() : '').filter(Boolean));
        uniqueForBook.forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + 1));
    });
    return Array.from(counts, ([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

