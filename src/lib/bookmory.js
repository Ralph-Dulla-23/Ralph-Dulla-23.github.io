import { saveBook, addReadingSession, sanitizeId } from './db';
import { searchBooks } from './openlibrary';
import { parseBookmoryMarkdownPure } from '../domain/bookmoryParser';
import { previewMigrationBatch, detectCollisions, generateRollbackManifest, executeMigrationBatch } from '../domain/migrationEngine';

export { parseBookmoryMarkdownPure, previewMigrationBatch, detectCollisions, generateRollbackManifest, executeMigrationBatch };

/**
 * Bookmory export importer.
 * Bookmory exports one markdown file per book ("### Book information",
 * "### Reading log N", "### Purchase logs #N"). We map each file to a diary book.
 */

const STATUS_MAP = {
    "i've read it all!": 'completed',
    'read': 'completed',
    'to read': 'want-to-read',
    'reading': 'reading',
    'gave up': 'dropped',
};

// Tags that describe format/shelf rather than genre.
const SKIP_TAGS = new Set(['audiobook', 'fiction', 'adult', 'dark', 'magic']);

const normTitle = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const field = (text, label) => {
    const m = text.match(new RegExp(`^- ${label}:[ \\t]*(.*)$`, 'm'));
    return m ? m[1].trim() : '';
};

// "11/19/2025" -> "2025-11-19"
const toIsoDate = (s) => {
    const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : '';
};

// "27h 16m" / "45m" / "2h" -> minutes
const toMinutes = (s) => {
    const h = String(s || '').match(/(\d+)\s*h/i);
    const m = String(s || '').match(/(\d+)\s*m/i);
    return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
};

const prettyTag = (tag) =>
    tag
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^Romantasy$/i, 'Romantasy')
        .trim();

/**
 * Parses one Bookmory markdown file's text. Returns null if it has no title.
 */
export function parseBookmoryMarkdown(text) {
    const title = field(text, 'Title');
    if (!title) return null;

    const authors = field(text, 'Authors')
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
    const pages = Number(field(text, 'Total pages').replace(/[^\d]/g, '')) || 0;
    const isbn = field(text, 'ISBN').replace(/[^\dXx]/g, '');
    const collections = field(text, 'Collections');
    const statusRaw = field(text, 'Status').toLowerCase();

    const genres = Array.from(
        new Set(
            (field(text, 'Tags in use').match(/#([^\s#]+)/g) || [])
                .map((t) => t.slice(1))
                .filter((t) => !SKIP_TAGS.has(t.toLowerCase()))
                .map(prettyTag)
        )
    ).slice(0, 6);

    // Reading logs
    const logs = text
        .split(/###\s*Reading log/i)
        .slice(1)
        .map((block) => {
            const period = field(block, 'Read period');
            const [start, end] = period.split('~').map((p) => toIsoDate(p));
            return {
                start: start || '',
                end: end || '',
                rating: Number(field(block, 'Star ratings')) || 0,
                comment: field(block, 'Comment'),
                minutes: toMinutes(field(block, 'Total read time')),
            };
        });

    const status = STATUS_MAP[statusRaw] || 'want-to-read';
    const rating = [...logs].reverse().find((l) => l.rating > 0)?.rating || null;
    const startedOn = logs.find((l) => l.start)?.start || '';
    const finishedOn = status === 'completed' ? [...logs].reverse().find((l) => l.end)?.end || '' : '';
    const comments = logs.map((l) => l.comment).filter(Boolean);

    return {
        title,
        authors,
        author: authors.join(', '),
        pages,
        isbn,
        genres,
        favorite: /favorite/i.test(collections),
        status,
        rating,
        startedOn,
        finishedOn,
        logs,
        privateNotes: comments.join('\n\n'),
    };
}

/**
 * Imports parsed Bookmory books into the diary (local mirror + Firestore).
 * Books that already exist (matched by normalized title) are updated in place,
 * keeping their id and cover.
 *
 * @param {string} uid
 * @param {Array} parsedBooks output of parseBookmoryMarkdown
 * @param {Array} existingBooks current books (for title matching)
 * @param {(done:number,total:number,title:string)=>void} [onProgress]
 */
export async function importBookmoryBooks(uid, parsedBooks, existingBooks = [], onProgress) {
    const byTitle = new Map(existingBooks.map((b) => [normTitle(b.title), b]));
    const summary = { added: 0, updated: 0, sessions: 0, failed: [] };

    for (let i = 0; i < parsedBooks.length; i++) {
        const p = parsedBooks[i];
        onProgress?.(i, parsedBooks.length, p.title);
        try {
            const existing = byTitle.get(normTitle(p.title));
            let cover = existing?.cover || '';
            let coverId = existing?.coverId || null;
            let olKey = existing?.olKey || '';

            // New book (or one without art): look up a cover via the search APIs.
            if (!existing || (!cover && !coverId)) {
                try {
                    const hits = await searchBooks(`${p.title} ${p.author}`.trim(), 5);
                    const hit = hits.find((h) => normTitle(h.title) === normTitle(p.title)) || hits[0];
                    if (hit) {
                        cover = hit.cover || '';
                        coverId = hit.coverId || null;
                        olKey = hit.olKey || '';
                    }
                } catch {
                    /* cover lookup is best-effort */
                }
                if (!cover && !coverId && p.isbn) {
                    cover = `https://covers.openlibrary.org/b/isbn/${p.isbn}-L.jpg`;
                }
            }

            const pages = p.pages || existing?.pages || null;
            const id = sanitizeId(existing?.id || existing?.coverId || coverId || normTitle(p.title), 'book');
            const completed = p.status === 'completed';

            await saveBook(
                uid,
                {
                    ...(existing || {}),
                    id,
                    olKey,
                    title: p.title,
                    author: p.author || existing?.author || '',
                    authors: p.authors.length ? p.authors : existing?.authors,
                    cover,
                    coverId,
                    pages,
                    currentPage: completed ? (pages || 0) : existing?.currentPage || 0,
                    status: p.status,
                    rating: p.rating,
                    favorite: p.favorite,
                    genres: p.genres.length ? p.genres : existing?.genres || [],
                    startedOn: p.startedOn,
                    finishedOn: p.finishedOn,
                },
                p.privateNotes
            );
            existing ? summary.updated++ : summary.added++;

            // One reading session per log that recorded read time (powers reading stats).
            for (let j = 0; j < p.logs.length; j++) {
                const log = p.logs[j];
                if (!log.minutes) continue;
                await addReadingSession(uid, id, {
                    id: `bookmory_${id}_${j + 1}`,
                    startedAt: log.start ? `${log.start}T12:00:00.000Z` : new Date().toISOString(),
                    minutes: log.minutes,
                    fromPage: 0,
                    toPage: completed ? pages : 0,
                    totalPages: pages,
                    status: p.status,
                });
                summary.sessions++;
            }
        } catch (err) {
            summary.failed.push(`${p.title}: ${err.message}`);
        }
    }
    onProgress?.(parsedBooks.length, parsedBooks.length, '');
    return summary;
}
