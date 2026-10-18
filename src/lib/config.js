/**
 * Application & Service Configuration
 * Reads credentials and identifiers from Vite environment variables (VITE_*)
 */

export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

export const RAWG_API_KEY = import.meta.env.VITE_RAWG_API_KEY || '';

/**
 * The Firebase Auth UID of the portfolio and diary owner.
 * Set in .env as VITE_OWNER_UID.
 */
export const OWNER_UID = import.meta.env.VITE_OWNER_UID || '';

/**
 * Returns true if Firebase config is present with required keys.
 */
export const isFirebaseConfigured = () => {
    return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
};

/**
 * Checks if the current authenticated user matches the owner UID.
 */
export const isOwner = (user) => {
    if (!user || !OWNER_UID) return false;
    return user.uid === OWNER_UID;
};
