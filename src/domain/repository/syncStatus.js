/**
 * Determines the high-level sync state according to Section 7.5 of BOOKS_GAMES_DIARY_IMPLEMENTATION.md.
 * States:
 * - 'synced': Remote acknowledged
 * - 'saving_offline': Durable local save, remote pending write
 * - 'offline': Offline cache only, no active remote connection
 * - 'permission_denied': Permission issue / invalid auth
 * - 'error': General network or persistence failure
 */

export function determineSyncState({ isOnline = true, hasPendingWrites = false, error = null } = {}) {
    if (error) {
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
            return 'permission_denied';
        }
        return 'error';
    }

    if (!isOnline) {
        return 'offline';
    }

    if (hasPendingWrites) {
        return 'saving_offline';
    }

    return 'synced';
}
