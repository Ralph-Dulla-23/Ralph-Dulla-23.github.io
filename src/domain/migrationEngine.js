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
    const existingAggregates = existingState.historicalAggregates || [];
    const existingSessions = existingState.sessions || [];

    const { byId, byTitle, byIsbn } = buildSourceIdMap(existingItems);

    const summary = {
        totalCandidates: candidates.length,
        additions: 0,
        updates: 0,
        duplicates: 0,
        historicalAggregatesCount: 0,
        journalEntriesCount: 0,
        warningsCount: 0,
    };

    const diff = [];
    const warnings = [];
    const stagedEntities = {
        items: [],
        attempts: [],
        historicalAggregates: [],
        journalEntries: [],
    };

    let legacySessionsSuperseded = 0;

    for (const cand of candidates) {
        const item = cand.item;

        // Warn on unknown total pages without fabricating values
        if (item.progress?.total === null) {
            warnings.push({
                code: 'UNKNOWN_TOTAL_PAGES',
                title: item.title,
                message: `Book "${item.title}" has unknown total pages; total set to null per DATA-03.`,
            });
        }

        // Match against existing items
        const existing =
            byId.get(String(item.id)) ||
            byTitle.get(normTitle(item.title)) ||
            (item.isbn ? byIsbn.get(String(item.isbn).toLowerCase()) : null);

        if (existing) {
            const collisions = detectCollisions(cand, existing);
            if (collisions.length > 0) {
                warnings.push({
                    code: 'COLLISION',
                    title: item.title,
                    collisions,
                });
            }

            // Check if existing state already has this item and aggregates
            const alreadyHasAggregates = existingAggregates.some((a) => a.mediaId === existing.id);
            const isExactMatch =
                existing.status === item.status &&
                existing.rating === item.rating &&
                (alreadyHasAggregates || cand.historicalAggregates.length === 0);

            if (isExactMatch) {
                summary.duplicates++;
                diff.push({
                    type: 'duplicate',
                    title: item.title,
                    id: existing.id,
                });
                continue;
            }

            // Otherwise, staged as an update
            summary.updates++;
            diff.push({
                type: 'update',
                title: item.title,
                id: existing.id,
                changes: collisions,
            });
            stagedEntities.items.push({
                ...item,
                id: existing.id,
            });
        } else {
            // New addition
            summary.additions++;
            diff.push({
                type: 'add',
                title: item.title,
                id: item.id,
            });
            stagedEntities.items.push(item);
            stagedEntities.attempts.push(...cand.attempts);
            stagedEntities.historicalAggregates.push(...cand.historicalAggregates);
            stagedEntities.journalEntries.push(...cand.journalEntries);

            summary.historicalAggregatesCount += cand.historicalAggregates.length;
            summary.journalEntriesCount += cand.journalEntries.length;
        }

        // Check for legacy synthetic sessions (bookmory_${id}_${j}) to supersede
        const targetId = existing?.id || item.id;
        const matchingLegacy = existingSessions.filter(
            (s) => s.id && s.id.startsWith(`bookmory_${targetId}`)
        );
        if (matchingLegacy.length > 0) {
            legacySessionsSuperseded += matchingLegacy.length;
        }
    }

    summary.warningsCount = warnings.length;

    return {
        summary,
        diff,
        warnings,
        stagedEntities,
        legacySessionsSuperseded,
    };
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

    const totalOperations = items.length + attempts.length + historicalAggregates.length + journalEntries.length;
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

    // 3. Write Historical Aggregates
    for (const agg of historicalAggregates) {
        notify('Saving reading history');
        if (typeof repository.createHistoricalAggregate === 'function') {
            await repository.createHistoricalAggregate(agg);
        }
        completed++;
    }

    // 4. Write Private Journal Entries
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
        journalEntriesCount: journalEntries.length,
        rollbackManifest,
    };
}

