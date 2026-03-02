// Shared book data used by both the homepage carousel and the Library page

const books = [
    // Stephanie Garber - Caraval series
    {
        coverId: 7990753, title: 'Caraval', author: 'Stephanie Garber',
        progress: 100, status: 'completed', rating: 5, favorite: true,
        genres: ['Fantasy', 'Romance'],
    },
    {
        coverId: 9242465, title: 'Legendary', author: 'Stephanie Garber',
        progress: 100, status: 'completed', rating: 5, favorite: true,
        genres: ['Fantasy', 'Romance'],
    },
    {
        coverId: 8802288, title: 'Finale', author: 'Stephanie Garber',
        progress: 100, status: 'completed', rating: 5, favorite: true,
        genres: ['Fantasy', 'Romance'],
    },
    {
        coverId: 15155801, title: 'Spectacular', author: 'Stephanie Garber',
        progress: 40, status: 'completed', rating: 5, favorite: true,
        genres: ['Fantasy', 'Romance'],
    },
    // Stephanie Garber - Once Upon a Broken Heart series (UK covers)
    {
        coverId: 12435818, title: 'Once Upon a Broken Heart', author: 'Stephanie Garber',
        progress: 100, status: 'completed', rating: 5, favorite: true,
        genres: ['Fantasy', 'Romance'],
    },
    {
        coverId: 15089716, title: 'The Ballad of Never After', author: 'Stephanie Garber',
        progress: 100, status: 'completed', rating: 5, favorite: true,
        genres: ['Fantasy', 'Romance'],
    },
    {
        coverId: 15089644, title: 'A Curse for True Love', author: 'Stephanie Garber',
        progress: 100, status: 'completed', rating: 5, favorite: true,
        genres: ['Fantasy', 'Romance'],
    },
    // Holly Black - Folk of the Air (to be read)
    {
        coverId: 8361789, title: 'The Cruel Prince', author: 'Holly Black',
        progress: 0, status: 'reading', rating: null, favorite: false,
        genres: ['Fantasy', 'Romance'],
    },
    {
        coverId: 8361788, title: 'The Wicked King', author: 'Holly Black',
        progress: 0, status: 'want-to-read', rating: null, favorite: false,
        genres: ['Fantasy', 'Romance'],
    },
    {
        coverId: 9146990, title: 'The Queen of Nothing', author: 'Holly Black',
        progress: 0, status: 'want-to-read', rating: null, favorite: false,
        genres: ['Fantasy', 'Romance'],
    },
    // Emily Henry
    {
        coverId: 14625690, title: 'Funny Story', author: 'Emily Henry',
        progress: 100, status: 'completed', rating: 5, favorite: false,
        genres: ['Romance', 'Contemporary'],
    },
    // Ali Hazelwood
    {
        coverId: 10601402, title: 'The Love Hypothesis', author: 'Ali Hazelwood',
        progress: 100, status: 'completed', rating: 5, favorite: false,
        genres: ['Romance', 'Contemporary'],
    },
    {
        coverId: 13264824, title: 'Love, Theoretically', author: 'Ali Hazelwood',
        progress: 100, status: 'completed', rating: 5, favorite: false,
        genres: ['Romance', 'Contemporary'],
    },
    // Christina Lauren
    {
        coverId: 15100497, title: 'Love and Other Words', author: 'Christina Lauren',
        progress: 100, status: 'completed', rating: 5, favorite: false,
        genres: ['Romance', 'Contemporary'],
    },
    // Lynn Painter
    {
        coverId: 11182600, title: 'Better Than the Movies', author: 'Lynn Painter',
        progress: 100, status: 'completed', rating: 5, favorite: false,
        genres: ['Romance', 'Young Adult'],
    },
    {
        coverId: 15150672, title: 'Nothing Like the Movies', author: 'Lynn Painter',
        progress: 100, status: 'completed', rating: 5, favorite: true,
        genres: ['Romance', 'Young Adult'],
    },
    {
        coverId: 13773782, title: 'Betting on You', author: 'Lynn Painter',
        progress: 100, status: 'completed', rating: 4, favorite: false,
        genres: ['Romance', 'Young Adult'],
    },
    {
        coverId: 15139935, title: 'Fake Skating', author: 'Lynn Painter',
        progress: 100, status: 'completed', rating: 5, favorite: false,
        genres: ['Romance', 'Young Adult'],
    },
    // Pierce Brown
    {
        coverId: 7316188, title: 'Red Rising', author: 'Pierce Brown',
        progress: 0, status: 'dropped', rating: null, favorite: false,
        genres: ['Sci-Fi', 'Fantasy'],
    },
    // Abby Jimenez
    {
        coverId: 13186198, title: 'Yours Truly', author: 'Abby Jimenez',
        progress: 100, status: 'completed', rating: 5, favorite: false,
        genres: ['Romance', 'Contemporary'],
    },
    // Mariana Zapata
    {
        coverId: 10326208, title: 'Luna and the Lie', author: 'Mariana Zapata',
        progress: 35, status: 'reading', rating: 5, favorite: false,
        genres: ['Romance', 'Contemporary'],
    },
    // Jenna Evans Welch
    {
        coverId: 8074552, title: 'Love & Gelato', author: 'Jenna Evans Welch',
        progress: 100, status: 'completed', rating: 5, favorite: true,
        genres: ['Romance', 'Young Adult'],
    },
    // Ann Liang
    {
        coverId: 12954164, title: 'If You Could See the Sun', author: 'Ann Liang',
        progress: 100, status: 'completed', rating: 5, favorite: false,
        genres: ['Romance', 'Young Adult', 'Fantasy'],
    },
    // Ashley Poston
    {
        coverId: 15098632, title: 'The Seven Year Slip', author: 'Ashley Poston',
        progress: 100, status: 'completed', rating: 4.5, favorite: false,
        genres: ['Romance', 'Contemporary'],
    },
    // Liana Cincotti
    {
        coverId: 15107508, title: 'Picking Daisies on Sundays', author: 'Liana Cincotti',
        progress: 100, status: 'completed', rating: 5, favorite: false,
        genres: ['Romance', 'Contemporary'],
    },
    {
        coverId: null, title: "Don't Be In Love", author: 'Liana Cincotti',
        progress: 100, status: 'completed', rating: 5, favorite: true,
        genres: ['Romance', 'Contemporary'],
    },
];

// Add original index to preserve reverse chronological order
books.forEach((b, i) => b._originalIndex = i);

books.sort((a, b) => {
    // Both are reading: sort by original index reversed
    if (a.status === 'reading' && b.status === 'reading') {
        return b._originalIndex - a._originalIndex;
    }
    // Only A is reading: A comes first
    if (a.status === 'reading') return -1;
    // Only B is reading: B comes first
    if (b.status === 'reading') return 1;

    // Neither is reading: sort by original index reversed
    return b._originalIndex - a._originalIndex;
});

export default books;

// Helper constants
export const statusConfig = {
    'completed': { label: 'Completed', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', barColor: 'bg-green-500' },
    'reading': { label: 'Reading', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', barColor: 'bg-blue-500' },
    'want-to-read': { label: 'To Read', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', barColor: 'bg-gray-300 dark:bg-gray-600' },
    'dropped': { label: 'Dropped', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', barColor: 'bg-red-500' },
};

export const allGenres = [...new Set(books.flatMap(b => b.genres))].sort();
