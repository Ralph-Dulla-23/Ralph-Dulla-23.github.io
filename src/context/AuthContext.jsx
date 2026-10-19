import React, { createContext, useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { OWNER_UID, isOwner } from '../lib/config';

const AuthContext = createContext({
    user: null,
    loading: true,
    isOwner: false,
    ownerUid: '',
    login: async () => {},
    logout: async () => {},
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(Boolean(auth));

    useEffect(() => {
        if (!auth) return;

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser ?? null);
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
            setUser(cred.user);
        }
        return cred;
    };

    const logout = async () => {
        setUser(null);
        if (!auth) return;
        return firebaseSignOut(auth);
    };

    const value = {
        user,
        loading,
        isOwner: Boolean(user && isOwner(user)),
        ownerUid: OWNER_UID,
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

