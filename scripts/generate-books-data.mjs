import fs from 'fs';

const rawData = JSON.parse(
    fs.readFileSync(
        'C:/Users/dulla/.gemini/antigravity/brain/03fd88e9-9930-4576-b18d-61ad3d90a2c2/scratch/all_51_books.json',
        'utf8'
    )
);

// Clean up titles (remove invisible unicode marks)
rawData.forEach(b => {
    b.title = b.title.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '').trim();
    b.author = b.author.replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '').trim();
});

const code = `// Shared book data used by the homepage carousel, public library, and owner diary
// Auto-compiled from Bookmory export (51 total books)

const books = ${JSON.stringify(rawData, null, 4)};

// Add original index to preserve reverse chronological order and guarantee id/pages fields
books.forEach((b, i) => {
    b._originalIndex = i;
    b.id = String(b.coverId || b.id || b.title.replace(/\\s+/g, '-').toLowerCase() || \`book-\${i}\`);
    b.pages = b.pages || 350;
    b.currentPage = b.progress === 100 ? (b.pages || 350) : Math.round(((b.progress || 0) / 100) * (b.pages || 350));
});

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

export const allGenres = [...new Set(books.flatMap(b => b.genres || []))].filter(Boolean).sort();
`;

fs.writeFileSync('c:/ccs/Ralph-Dulla-23.github.io/src/data/books.js', code, 'utf8');
console.log('Successfully wrote src/data/books.js with all 51 books!');
