import { initializeApp, getApps, getApp } from 'firebase/app';
import {
    initializeAuth,
    browserLocalPersistence,
    indexedDBLocalPersistence,
    getAuth,
} from 'firebase/auth';
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    getFirestore,
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './config.js';

let app = null;
let auth = null;
let db = null;

if (isFirebaseConfigured()) {
    try {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

        try {
            db = initializeFirestore(app, {
                localCache: persistentLocalCache({
                    tabManager: persistentMultipleTabManager(),
                }),
            });
        } catch {
            // Fallback if multiple tab persistence was already initialized
            db = getFirestore(app);
        }

        try {
            auth = initializeAuth(app, {
                persistence: [browserLocalPersistence, indexedDBLocalPersistence],
            });
        } catch {
            auth = getAuth(app);
        }
    } catch (err) {
        console.error('Failed to initialize Firebase:', err);
    }
} else {
    console.info(
        'Firebase is not yet configured. Add your Firebase credentials to .env (see .env.example).'
    );
}

export { app, auth, db };
