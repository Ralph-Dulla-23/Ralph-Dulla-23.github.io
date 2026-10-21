/** Show authorization failures instead of silently pretending cloud data synced. */
export function reportFirestoreError(error, operation = 'diary request') {
    if (!error) return;
    const code = String(error.code || '');
    if (!code.includes('permission-denied') && !code.includes('unauthenticated')) return;
    const message = code.includes('permission-denied')
        ? `Firestore permission denied while accessing ${operation}. Check that the signed-in Firebase user matches your owner UID and that the current firestore.rules have been deployed to the correct project.`
        : `Sign in again to access ${operation}. Firebase did not authenticate this request.`;
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('diary:firestore-access-error', {
            detail: { message, code, operation },
        }));
    }
}
