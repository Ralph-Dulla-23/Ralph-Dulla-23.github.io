import { normTitle } from './bookmoryParser.js';

/**
 * Pure migration preview, collision detection, and rollback manifest engine.
 * Completely side-effect free (zero database/storage writes during preview).
 * Resolves DATA-01 (idempotency & duplicate detection), DATA-03 (warns on null pages),
 * DATA-05 (legacy session supersession), and provides safe rollback manifests.
 */

/**
 * Builds fast lookup maps from existing library items.
 */
export function buildSourceIdMap(existingItems = []) {
    const byId = new Map();
    const byTitle = new Map();
    const byIsbn = new Map();

    for (const item of existingItems) {
        if (item.id) byId.set(String(item.id), item);
        if (item.title) byTitle.set(normTitle(item.title), item);
        if (item.isbn) byIsbn.set(String(item.isbn).toLowerCase(), item);
    }

    return { byId, byTitle, byIsbn };
}

/**
 * Detects discrepancies between a candidate and an existing item.
 */
export function detectCollisions(candidate, existingItem) {
    const collisions = [];
    if (!candidate || !existingItem) return collisions;

    const candItem = candidate.item || candidate;

    // Status conflict
    if (candItem.status && existingItem.status && candItem.status !== existingItem.status) {
        collisions.push({
            field: 'status',
            candidate: candItem.status,
            existing: existingItem.status,
            message: `Candidate status "${candItem.status}" conflicts with existing status "${existingItem.status}".`,
        });
    }

    // ISBN conflict
    if (candItem.isbn && existingItem.isbn && candItem.isbn !== existingItem.isbn) {
        collisions.push({
            field: 'isbn',
            candidate: candItem.isbn,
            existing: existingItem.isbn,
            message: `Candidate ISBN "${candItem.isbn}" conflicts with existing ISBN "${existingItem.isbn}".`,
        });
    }

    // Page count conflict
    const candPages = candItem.progress?.total ?? candItem.pages;
    const existPages = existingItem.progress?.total ?? existingItem.pages;
    if (candPages && existPages && candPages !== existPages) {
        collisions.push({
            field: 'totalPages',
            candidate: candPages,
            existing: existPages,
            message: `Candidate total pages (${candPages}) conflicts with existing pages (${existPages}).`,
        });
    }

    return collisions;
}

/**
 * Purely calculates the dry-run diff report and stages entities for migration.
 * Does NOT write to storage or Firestore.
 *
 * @param {Array} candidates - Array of parsed Bookmory outputs
 * @param {object} [existingState] - Current library snapshot { items, attempts, historicalAggregates, sessions, journalEntries }
 * @returns {object} Dry-run preview report
 */
export function previewMigrationBatch(candidates = [], existingState = {}) {
    const existingItems = existingState.items || [];
    const existingAttempts = existingState.attempts || [];
    const existingAggregates = existingState.historicalAggregates || [];
    const existingJournals = existingState.journalEntries || [];
    const existingSessions = existingState.sessions || [];
    const existingCanonicalSessionIds = new Set(existingSessions.map((v) => v.id));
    const { byId, byTitle, byIsbn } = buildSourceIdMap(existingItems);
    const summary = { totalCandidates: candidates.length, additions: 0, updates: 0,
        duplicates: 0, historicalAggregatesCount: 0, journalEntriesCount: 0, sessionsCount: 0, warningsCount: 0 };
    const stagedEntities = { items: [], attempts: [], sessions: [], historicalAggregates: [], journalEntries: [] };
    const warnings = [], diff = [];
    const existingAttemptIds = new Set(existingAttempts.map((v) => v.id));
    const existingAggIds = new Set(existingAggregates.map((v) => v.id));
    const existingJournalIds = new Set(existingJournals.map((v) => v.id));
    const seenSourceIds = new Set();
    let legacySessionsSuperseded = 0;

    for (const candidate of candidates) {
        if (!candidate?.item?.title) continue;
        const sourceItem = candidate.item;
        const sourceKey = sourceItem.provenance?.sourceKey || sourceItem.id;
        if (seenSourceIds.has(sourceKey)) {
            warnings.push({ code: 'DUPLICATE_SOURCE', title: sourceItem.title, message: 'Duplicate export record skipped.' });
            summary.duplicates++;
            continue;
        }
        seenSourceIds.add(sourceKey);
        const titleMatch = byTitle.get(normTitle(sourceItem.title));
        const isbnMatch = sourceItem.isbn ? byIsbn.get(String(sourceItem.isbn).toLowerCase()) : null;
        // Conflicting ISBNs on a title match are different editions: require manual handling.
        if (titleMatch && sourceItem.isbn && titleMatch.isbn && String(titleMatch.isbn) !== String(sourceItem.isbn) && !isbnMatch) {
            warnings.push({ code: 'EDITION_CONFLICT', title: sourceItem.title, message: 'Existing title has a different ISBN; skipped to prevent edition collision.' });
            diff.push({ type: 'skip', id: sourceItem.id, title: sourceItem.title });
            continue;
        }
        const existing = isbnMatch || byId.get(String(sourceItem.id)) || titleMatch;
        const finalId = existing?.id || sourceItem.id;
        if (sourceItem.progress?.total === null) {
            warnings.push({ code: 'UNKNOWN_TOTAL_PAGES', title: sourceItem.title,
                message: 'Export contains no page total; existing known value will be preserved.' });
        }
        const collisions = existing ? detectCollisions(candidate, existing) : [];
        if (collisions.length) warnings.push({ code: 'COLLISION', title: sourceItem.title, collisions });
        // Preserve owner edits, current reading position, cover and visibility.
        // New Bookmory metadata is accepted only for empty fields or the approved source status/rating.
        const existingPages = existing?.progress?.total ?? existing?.pages ?? null;
        const incomingPages = sourceItem.progress?.total ?? null;
        const resolvedPages = existingPages && incomingPages && existingPages !== incomingPages
            ? existingPages // Explicit conflict: retain existing edition length until manually reviewed.
            : (incomingPages ?? existingPages);
        const merged = existing ? {
            ...existing,
            ...sourceItem,
            id: finalId,
            cover: existing.cover || sourceItem.cover || '',
            coverId: existing.coverId ?? sourceItem.coverId ?? null,
            olKey: existing.olKey || sourceItem.olKey || '',
            visibility: existing.visibility || 'private',
            favorite: existing.favorite ?? sourceItem.favorite,
            wishlist: existing.wishlist ?? sourceItem.wishlist,
            progress: {
                ...sourceItem.progress,
                total: resolvedPages,
                current: sourceItem.status === 'completed'
                    ? (resolvedPages ?? existing.currentPage ?? 0)
                    : (existing.progress?.current ?? existing.currentPage ?? 0),
            },
            purchases: Array.from(new Map([...(existing.purchases || []), ...(sourceItem.purchases || [])]
                .map((v) => [v.id || `${v.date}_${v.amount}`, v])).values()),
            startedOn: sourceItem.startedOn || existing.startedOn || null,
            finishedOn: sourceItem.finishedOn || existing.finishedOn || null,
        } : sourceItem;
        // Never mutate an existing book's private notes or unpublished state.
        const changed = !existing || [
            'status','rating','favorite','isbn','publisher','publicationDate','language','bookFormat',
            'bookmoryLogCount','startedOn','finishedOn','wishlist'
        ].some((key) => JSON.stringify(merged[key] ?? null) !== JSON.stringify(existing[key] ?? null)) ||
            JSON.stringify(merged.tags || []) !== JSON.stringify(existing.tags || existing.genres || []) ||
            JSON.stringify(merged.purchases || []) !== JSON.stringify(existing.purchases || []) ||
            JSON.stringify(merged.progress) !== JSON.stringify(existing.progress || {
                unit: 'page', current: existing.currentPage || 0, total: existing.pages || null
            });
        const mapChild = (child) => ({ ...child,
            id: child.id?.replace(sourceItem.id, finalId),
            ...(child.libraryItemId ? { libraryItemId: finalId } : {}),
            ...(child.mediaId ? { mediaId: finalId } : {}),
            ...(child.linkedMediaId ? { linkedMediaId: finalId } : {}),
        });
        const childAttempts = (candidate.attempts || []).map(mapChild).filter((v) => !existingAttemptIds.has(v.id));
        const childAggs = (candidate.historicalAggregates || []).map(mapChild).filter((v) => !existingAggIds.has(v.id));
        const childJournals = (candidate.journalEntries || []).map(mapChild).filter((v) => !existingJournalIds.has(v.id));
        const childSessions = (candidate.sessions || []).map(mapChild).filter((v) => !existingCanonicalSessionIds.has(v.id));
        // Mark staged IDs immediately to avoid duplicate siblings within the same import.
        childAttempts.forEach((v) => existingAttemptIds.add(v.id));
        childAggs.forEach((v) => existingAggIds.add(v.id));
        childJournals.forEach((v) => existingJournalIds.add(v.id));
        childSessions.forEach((v) => existingCanonicalSessionIds.add(v.id));
        if (changed) stagedEntities.items.push(merged);
        stagedEntities.attempts.push(...childAttempts);
        stagedEntities.historicalAggregates.push(...childAggs);
        stagedEntities.journalEntries.push(...childJournals);
        stagedEntities.sessions.push(...childSessions);
        summary.sessionsCount += childSessions.length;
        summary.historicalAggregatesCount += childAggs.length;
        summary.journalEntriesCount += childJournals.length;
        const isDuplicate = !changed && !childAttempts.length && !childAggs.length && !childJournals.length && !childSessions.length;
        if (isDuplicate) summary.duplicates++;
        else if (existing) summary.updates++;
        else summary.additions++;
        diff.push({ type: isDuplicate ? 'duplicate' : (existing ? 'update' : 'add'),
            id: finalId, title: sourceItem.title, changes: collisions });
        legacySessionsSuperseded += existingSessions.filter((session) =>
            session.id && (session.id.startsWith(`bookmory_${finalId}_`) || session.id.startsWith(`bookmory_${sourceItem.id}_`))
        ).length;
    }
    summary.warningsCount = warnings.length;
    return { summary, diff, warnings, stagedEntities, legacySessionsSuperseded };
}

/**
 * Generates an immutable rollback manifest recording pre-migration state and planned actions.
 */
export function generateRollbackManifest(previewReport, existingState = {}) {
    const staged = previewReport.stagedEntities || {};

    return {
        schemaVersion: 2,
        timestamp: new Date().toISOString(),
        affectedEntityIds: {
            items: staged.items ? staged.items.map((i) => i.id) : [],
            attempts: staged.attempts ? staged.attempts.map((a) => a.id) : [],
            historicalAggregates: staged.historicalAggregates ? staged.historicalAggregates.map((h) => h.id) : [],
            journalEntries: staged.journalEntries ? staged.journalEntries.map((j) => j.id) : [],
            sessions: staged.sessions ? staged.sessions.map((j) => j.id) : [],
        },
        rollbackActions: (staged.items || []).map((i) => {
            const existed = (existingState.items || []).find((e) => e.id === i.id);
            return {
                action: existed ? 'restore' : 'delete',
                entity: 'LibraryItem',
                id: i.id,
                previousState: existed || null,
            };
        }),
    };
}

/**
 * Executes a migration batch based on an approved preview report.
 * Strictly respects stagedEntities, idempotently creates a rollback manifest,
 * and calls the appropriate repository write methods.
 *
 * @param {object} params
 * @param {string} params.uid - Owner user ID
 * @param {object} params.previewReport - Approved preview report from previewMigrationBatch
 * @param {object} params.repository - DiaryRepository instance or repository interface
 * @param {(progress: { current: number, total: number, message: string }) => void} [params.onProgress]
 * @returns {Promise<{ success: boolean, importedCount: number, aggregatesCount: number, journalEntriesCount: number, rollbackManifest: object }>}
 */
export async function executeMigrationBatch({ previewReport, repository, onProgress }) {
    if (!previewReport || !repository) {
        throw new Error('executeMigrationBatch requires previewReport and repository');
    }

    const staged = previewReport.stagedEntities || {};
    const items = staged.items || [];
    const attempts = staged.attempts || [];
    const historicalAggregates = staged.historicalAggregates || [];
    const journalEntries = staged.journalEntries || [];
    const sessions = staged.sessions || [];

    const totalOperations = items.length + attempts.length + historicalAggregates.length + journalEntries.length + sessions.length;
    let completed = 0;

    const notify = (message) => {
        onProgress?.({
            current: completed,
            total: totalOperations,
            message,
        });
    };

    // 1. Write Library Items
    for (const item of items) {
        notify(`Saving book: ${item.title}`);
        if (typeof repository.saveLibraryItem === 'function') {
            await repository.saveLibraryItem(item);
        }
        if (typeof repository.saveLegacyBook === 'function') {
            await repository.saveLegacyBook(item);
        }
        completed++;
    }

    // 2. Write Reading Attempts
    for (const attempt of attempts) {
        notify('Saving reading attempt');
        if (typeof repository.createAttempt === 'function') {
            await repository.createAttempt(attempt);
        }
        completed++;
    }

    // 3. Write actual native Bookmory timer sessions when timestamps exist.
    for (const session of sessions) {
        notify('Saving verified native reading timer');
        if (typeof repository.createSession !== 'function') throw new Error('Repository cannot save canonical sessions.');
        await repository.createSession(session);
        completed++;
    }

    // 4. Write Historical Aggregates
    for (const agg of historicalAggregates) {
        notify('Saving reading history');
        if (typeof repository.createHistoricalAggregate === 'function') {
            await repository.createHistoricalAggregate(agg);
        }
        completed++;
    }

    // 5. Write Private Journal Entries
    for (const entry of journalEntries) {
        notify('Saving private note/review');
        if (typeof repository.createJournalEntry === 'function') {
            await repository.createJournalEntry(entry);
        }
        completed++;
    }

    const rollbackManifest = generateRollbackManifest(previewReport);

    return {
        success: true,
        importedCount: items.length,
        aggregatesCount: historicalAggregates.length,
        sessionsCount: sessions.length,
        journalEntriesCount: journalEntries.length,
        rollbackManifest,
    };
}

