import React, { createContext, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { OWNER_UID, isOwner } from '../lib/config';

const AUTH_CACHE_KEY = 'diary_cached_owner_user';

function getCachedUser() {
    try {
        const raw = localStorage.getItem(AUTH_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && parsed.uid) {
            return { uid: parsed.uid, email: parsed.email || '' };
        }
    } catch {
        // Ignore storage parse errors
    }
    return null;
}

function saveCachedUser(u) {
    try {
        if (!u || !u.uid) return;
        localStorage.setItem(
            AUTH_CACHE_KEY,
            JSON.stringify({
                uid: u.uid,
                email: u.email || '',
            })
        );
    } catch {
        // Ignore storage write errors
    }
}

function clearCachedUser() {
    try {
        localStorage.removeItem(AUTH_CACHE_KEY);
    } catch {
        // Ignore storage errors
    }
}

const AuthContext = createContext({
    user: null,
    loading: true,
    isOwner: false,
    login: async () => {},
    logout: async () => {},
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => getCachedUser());
    const [loading, setLoading] = useState(() => {
        if (getCachedUser()) return false;
        return Boolean(auth);
    });

    useEffect(() => {
        if (!auth) return;

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                saveCachedUser(currentUser);
                setUser(currentUser);
            } else {
                const cached = getCachedUser();
                if (cached) {
                    setUser({ uid: cached.uid, email: cached.email });
                } else {
                    setUser(null);
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email, password) => {
        if (!auth) {
            throw new Error('Firebase Auth is not initialized. Please check your .env configuration.');
        }
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        if (cred?.user) {
            saveCachedUser(cred.user);
            setUser(cred.user);
        }
        return cred;
    };

    const logout = async () => {
        clearCachedUser();
        setUser(null);
        if (!auth) return;
        return firebaseSignOut(auth);
    };

    const value = {
        user,
        loading,
        isOwner: Boolean(user && (isOwner(user) || !OWNER_UID)),
        ownerUid: OWNER_UID || user?.uid || '',
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired,
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
export default AuthContext;
