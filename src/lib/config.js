/**
 * Application & Service Configuration
 * Reads credentials and identifiers from Vite environment variables (VITE_*)
 */

const env = (typeof import.meta !== 'undefined' && import.meta.env)
    ? import.meta.env
    : (typeof globalThis !== 'undefined' && globalThis.process?.env ? globalThis.process.env : {});

export const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || '',
};

export const RAWG_API_KEY = env.VITE_RAWG_API_KEY || '';

/**
 * The Firebase Auth UID of the portfolio and diary owner.
 * Set in .env as VITE_OWNER_UID.
 */
export const OWNER_UID = (env.VITE_OWNER_UID || 'B0p0XBPscBNF4Dchuk1IsOACrvk2').trim();

/**
 * Returns true if Firebase config is present with required keys.
 */
export const isFirebaseConfigured = () => {
    return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
};

/**
 * Checks if the current authenticated user matches the owner UID.
 * Fails closed if user or OWNER_UID is missing or empty.
 */
export const isOwner = (user) => {
    if (!user?.uid || !OWNER_UID) return false;
    return user.uid === OWNER_UID;
};

