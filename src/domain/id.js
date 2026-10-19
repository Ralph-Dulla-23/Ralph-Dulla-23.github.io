/**
 * Stable opaque identifier generator and validator.
 * Conforms to Section 5.1: crypto.randomUUID() where supported; never Date.now() alone.
 */

export function generateId(prefix = '') {
    const rawUuid =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    return prefix ? `${prefix}_${rawUuid}` : rawUuid;
}

export function isValidId(id) {
    if (typeof id !== 'string') return false;
    const trimmed = id.trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return false;
    return trimmed.length >= 3 && !/[/\\]/.test(trimmed);
}
