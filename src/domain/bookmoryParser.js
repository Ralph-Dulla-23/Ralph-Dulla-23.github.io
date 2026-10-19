import { generateId } from './id.js';

/**
 * Pure Bookmory export parser.
 * Side-effect free, deterministic, returns canonical v2 entities.
 * Resolves DATA-03 (null pages), DATA-04 (no synthetic full intervals),
 * DATA-05 & DATA-06 (HistoricalAggregate with isDailySession: false),
 * and SEC-01 (JournalEntry visibility: 'private').
 */

const STATUS_MAP = Object.freeze({
    "i've read it all!": 'completed',
    'read': 'completed',
    'completed': 'completed',
    'to read': 'want-to-read',
    'want-to-read': 'want-to-read',
    'reading': 'reading',
    'gave up': 'dropped',
    'dropped': 'dropped',
    'paused': 'paused',
});

export const toIsoDate = (s) => {
    const m = String(s || '').trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
};

export const toMinutes = (s) => {
    const h = String(s || '').match(/(\d+)\s*h/i);
    const m = String(s || '').match(/(\d+)\s*m/i);
    return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
};

export const normTitle = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

const field = (text, label) => {
    const m = text.match(new RegExp(`^(?:-\\s*)?${label}:[ \\t]*(.*)$`, 'm'));
    return m ? m[1].trim() : '';
};

/**
 * Parses raw Bookmory markdown into canonical v2 domain entities.
 *
 * @param {string} markdownText
 * @param {object} [options]
 * @param {string} [options.id] - Optional fixed ID to assign
 * @returns {object|null} { item, attempts, historicalAggregates, journalEntries, raw }
 */
export function parseBookmoryMarkdownPure(markdownText, options = {}) {
    if (!markdownText || typeof markdownText !== 'string') return null;

    const text = markdownText.replace(/\r\n/g, '\n');
    const title = field(text, 'Title');
    if (!title) return null;

    const authorsRaw = field(text, 'Authors');
    const authors = authorsRaw
        ? authorsRaw.split(',').map((a) => a.trim()).filter(Boolean)
        : [];

    const pagesRaw = field(text, 'Total pages');
    const parsedPages = Number(pagesRaw.replace(/[^\d]/g, ''));
    const totalPages = (parsedPages && parsedPages > 0) ? parsedPages : null;

    const isbnRaw = field(text, 'ISBN');
    const isbnClean = isbnRaw ? isbnRaw.replace(/[^0-9Xx]/g, '') : null;
    const isbn = (isbnClean && isbnClean.length >= 9) ? isbnClean : null;

    const collections = field(text, 'Collections');
    const favorite = /favorite/i.test(collections);

    const rawStatus = field(text, 'Status').toLowerCase().trim();
    const status = STATUS_MAP[rawStatus] || 'want-to-read';

    // Parse tags without lossy skipping
    const tags = Array.from(
        new Set(
            (field(text, 'Tags in use').match(/#([^\s#]+)/g) || [])
                .map((t) => t.slice(1).trim())
                .filter(Boolean)
        )
    );

    // Parse reading logs
    const logBlocks = text.split(/###\s*Reading log/i).slice(1);
    const logs = logBlocks.map((block, idx) => {
        const period = field(block, 'Read period');
        const [startRaw, endRaw] = period.split('~').map(toIsoDate);
        const ratingNum = Number(field(block, 'Star ratings')) || 0;
        const minutes = toMinutes(field(block, 'Total read time'));
        const comment = field(block, 'Comment');

        return {
            logIndex: idx + 1,
            start: startRaw || null,
            end: endRaw || null,
            rating: ratingNum > 0 ? ratingNum : null,
            minutes,
            comment: comment || '',
        };
    });

    const itemRating = [...logs].reverse().find((l) => l.rating)?.rating || null;
    const id = options.id || generateId();

    const current = status === 'completed' && totalPages !== null ? totalPages : 0;
    const progress = {
        unit: 'page',
        current,
        total: totalPages,
    };

    // Canonical LibraryItem
    const item = {
        schemaVersion: 2,
        id,
        mediaType: 'book',
        title,
        creators: authors.length > 0 ? authors : ['Unknown Author'],
        status,
        rating: itemRating,
        ratingScale: 5,
        progress,
        tags,
        favorite,
        visibility: 'private',
        isbn,
        provenance: {
            source: 'bookmory',
            importedAt: new Date().toISOString(),
        },
    };

    // Canonical Attempts
    const attempts = logs.map((log, index) => {
        const isLatest = index === logs.length - 1;
        let attemptStatus;
        if (isLatest) {
            attemptStatus = status === 'completed' ? 'completed' : (status === 'dropped' ? 'abandoned' : 'in_progress');
        } else {
            attemptStatus = 'completed';
        }

        return {
            schemaVersion: 2,
            id: generateId(),
            libraryItemId: id,
            ordinal: index + 1,
            status: attemptStatus,
            startedOn: log.start,
            completedOn: attemptStatus === 'completed' ? (log.end || log.start) : null,
            rating: log.rating,
            progress: {
                unit: 'page',
                current: attemptStatus === 'completed' && totalPages !== null ? totalPages : 0,
                total: totalPages,
            },
            provenance: { source: 'bookmory' },
        };
    });

    if (attempts.length === 0) {
        const fallbackStatus = status === 'completed' ? 'completed' : (status === 'dropped' ? 'abandoned' : 'in_progress');
        attempts.push({
            schemaVersion: 2,
            id: generateId(),
            libraryItemId: id,
            ordinal: 1,
            status: fallbackStatus,
            startedOn: null,
            completedOn: fallbackStatus === 'completed' ? new Date().toISOString().slice(0, 10) : null,
            rating: itemRating,
            progress,
            provenance: { source: 'bookmory' },
        });
    }

    // Canonical Historical Aggregates (isDailySession strictly false)
    const historicalAggregates = logs
        .filter((l) => l.minutes > 0)
        .map((l) => ({
            schemaVersion: 2,
            id: generateId(),
            mediaId: id,
            mediaType: 'book',
            isDailySession: false,
            totalMinutes: l.minutes,
            dateRange: {
                start: l.start,
                end: l.end,
            },
            notes: l.comment || null,
            provenance: {
                source: 'bookmory',
                logOrdinal: l.logIndex,
            },
        }));

    // Canonical Journal Entries (strictly private)
    const journalEntries = logs
        .filter((l) => l.comment && l.comment.trim().length > 0)
        .map((l) => ({
            schemaVersion: 2,
            id: generateId(),
            linkedMediaId: id,
            mediaType: 'book',
            type: 'review',
            body: l.comment.trim(),
            visibility: 'private',
            date: l.end || l.start || new Date().toISOString().slice(0, 10),
            provenance: {
                source: 'bookmory',
                logOrdinal: l.logIndex,
            },
        }));

    return {
        item,
        attempts,
        historicalAggregates,
        journalEntries,
        raw: {
            title,
            authors: authorsRaw,
            totalPages: pagesRaw,
            isbn: isbnRaw,
            collections,
            status: rawStatus,
            logs,
        },
    };
}
