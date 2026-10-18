import fs from 'fs';
import path from 'path';

const dir = 'C:/Users/dulla/.gemini/antigravity/brain/03fd88e9-9930-4576-b18d-61ad3d90a2c2/scratch/bookmory_new';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

const STATUS_MAP = {
    "i've read it all!": 'completed',
    'read': 'completed',
    'to read': 'want-to-read',
    'reading': 'reading',
    'gave up': 'dropped',
};
const SKIP_TAGS = new Set(['audiobook', 'fiction', 'adult', 'dark', 'magic']);

const field = (text, label) => {
    const m = text.match(new RegExp(`^- ${label}:[ \\t]*(.*)$`, 'm'));
    return m ? m[1].trim() : '';
};

const toIsoDate = (s) => {
    const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : '';
};

const toMinutes = (s) => {
    const h = String(s || '').match(/(\d+)\s*h/i);
    const m = String(s || '').match(/(\d+)\s*m/i);
    return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
};

// Import existing 29 books from src/data/books.js
const existingBooksData = (await import('../src/data/books.js')).default;
const existingByTitle = new Map();
existingBooksData.forEach(b => {
    const norm = b.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    existingByTitle.set(norm, b);
});

async function findCover(title, author, isbn) {
    // 1. Check existing books first
    const norm = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = existingByTitle.get(norm);
    if (existing?.coverId) {
        return {
            coverId: existing.coverId,
            cover: existing.cover || `https://covers.openlibrary.org/b/id/${existing.coverId}-L.jpg`,
            olKey: existing.olKey || ''
        };
    }
    if (existing?.cover) {
        return { coverId: null, cover: existing.cover, olKey: existing.olKey || '' };
    }

    // 2. Open Library search by ISBN
    if (isbn) {
        try {
            const url = `https://openlibrary.org/isbn/${isbn}.json`;
            const res = await fetch(url, { headers: { 'User-Agent': 'PortfolioApp/1.0' } });
            if (res.ok) {
                const data = await res.json();
                if (data.covers && data.covers.length > 0) {
                    const cid = data.covers[0];
                    return {
                        coverId: cid,
                        cover: `https://covers.openlibrary.org/b/id/${cid}-L.jpg`,
                        olKey: data.key || ''
                    };
                }
            }
        } catch {
            // Ignore error
        }
    }

    // 3. Open Library search by Title + Author
    try {
        const cleanTitle = title.replace(/\(.*?\)/g, '').trim();
        const q = `${cleanTitle} ${author}`.trim();
        const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=3&fields=title,cover_i,key,number_of_pages_median`;
        const res = await fetch(url, { headers: { 'User-Agent': 'PortfolioApp/1.0' } });
        if (res.ok) {
            const data = await res.json();
            const hit = (data.docs || []).find(d => d.cover_i);
            if (hit) {
                return {
                    coverId: hit.cover_i,
                    cover: `https://covers.openlibrary.org/b/id/${hit.cover_i}-L.jpg`,
                    olKey: hit.key || ''
                };
            }
        }
    } catch {
        // Ignore error
    }

    // 4. iTunes Books search
    try {
        const cleanTitle = title.replace(/\(.*?\)/g, '').trim();
        const term = `${cleanTitle} ${author}`.trim();
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=ebook&limit=3`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                const art = data.results[0].artworkUrl100?.replace('100x100bb', '600x600bb');
                if (art) {
                    return { coverId: null, cover: art, olKey: '' };
                }
            }
        }
    } catch {
        // Ignore error
    }

    // 5. Open Library direct ISBN cover
    if (isbn) {
        return {
            coverId: null,
            cover: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
            olKey: ''
        };
    }

    return { coverId: null, cover: '', olKey: '' };
}

const all51Books = [];

console.log(`Resolving metadata and covers for all ${files.length} books...`);

for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const title = field(content, 'Title');
    if (!title) continue;

    const authors = field(content, 'Authors')
        .split(',')
        .map((a) => a.trim().replace(/\s+/g, ' '))
        .filter(Boolean);
    const pages = Number(field(content, 'Total pages').replace(/[^\d]/g, '')) || 0;
    const isbn = field(content, 'ISBN').replace(/[^\dXx]/g, '');
    const collections = field(content, 'Collections');
    const statusRaw = field(content, 'Status').toLowerCase();

    const genres = Array.from(
        new Set(
            (field(content, 'Tags in use').match(/#([^\s#]+)/g) || [])
                .map((t) => t.slice(1))
                .filter((t) => !SKIP_TAGS.has(t.toLowerCase()))
                .map(t => t.replace(/([a-z])([A-Z])/g, '$1 $2').trim())
        )
    );

    const logs = content.split(/###\s*Reading log/i).slice(1).map(b => {
        const period = field(b, 'Read period');
        const [start, end] = period.split('~').map(p => toIsoDate(p));
        return {
            start: start || '',
            end: end || '',
            rating: Number(field(b, 'Star ratings')) || 0,
            comment: field(b, 'Comment'),
            minutes: toMinutes(field(b, 'Total read time'))
        };
    });

    const status = STATUS_MAP[statusRaw] || 'want-to-read';
    const rating = [...logs].reverse().find(l => l.rating > 0)?.rating || null;
    const startedOn = logs.find(l => l.start)?.start || '';
    const finishedOn = status === 'completed' ? [...logs].reverse().find(l => l.end)?.end || '' : '';
    const comments = logs.map(l => l.comment).filter(Boolean);

    const norm = title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const existing = existingByTitle.get(norm);

    const coverInfo = await findCover(title, authors.join(', '), isbn);

    const bookGenres = genres.length ? genres : (existing?.genres || ['Fiction']);
    const isCompleted = status === 'completed';

    const safeId = existing?.id || (coverInfo.coverId ? String(coverInfo.coverId) : title.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

    all51Books.push({
        id: safeId,
        title,
        author: authors.join(', '),
        authors: authors.length ? authors : [authors.join(', ')],
        pages: pages || existing?.pages || 350,
        currentPage: isCompleted ? (pages || 350) : (existing?.currentPage || 0),
        progress: isCompleted ? 100 : (existing?.progress || 0),
        status,
        rating: rating !== null ? rating : (existing?.rating ?? null),
        favorite: /favorite/i.test(collections) || Boolean(existing?.favorite),
        genres: bookGenres,
        startedOn: startedOn || existing?.startedOn || '',
        finishedOn: finishedOn || existing?.finishedOn || '',
        isbn,
        olKey: coverInfo.olKey || existing?.olKey || '',
        coverId: coverInfo.coverId,
        cover: coverInfo.cover,
        logs,
        privateNotes: comments.join('\n\n')
    });

    console.log(`[${i + 1}/${files.length}] ${title} -> Cover: ${coverInfo.cover ? 'OK' : 'MISSING'}`);
    // Tiny delay to avoid rate-limiting
    await new Promise(r => setTimeout(r, 150));
}

fs.writeFileSync(
    'C:/Users/dulla/.gemini/antigravity/brain/03fd88e9-9930-4576-b18d-61ad3d90a2c2/scratch/all_51_books.json',
    JSON.stringify(all51Books, null, 2),
    'utf8'
);

console.log('\nAll 51 books processed and saved to scratch/all_51_books.json!');
console.log('Books with covers:', all51Books.filter(b => b.cover).length, '/ 51');
