import React from 'react';
import PropTypes from 'prop-types';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Route protection wrapper.
 * Ensures the user is signed in and is the designated owner.
 */
export const RequireAuth = ({ children }) => {
    const { user, loading, isOwner, ownerUid, logout } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background dark:bg-gray-950 transition-colors">
                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary dark:border-gray-700 dark:border-t-gray-100 rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (!isOwner) {
        // If OWNER_UID is not configured in environment, fail closed with clear actionable guidance
        if (!ownerUid) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-background dark:bg-gray-950 px-6 py-12 transition-colors">
                    <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-6 text-center shadow-lg">
                        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                            !
                        </div>
                        <h2 className="text-xl font-display font-bold text-primary dark:text-gray-100 mb-2">
                            Owner UID Not Configured
                        </h2>
                        <p className="text-sm text-secondary dark:text-gray-400 mb-6 leading-relaxed">
                            Diary write access is fail-closed. Please set <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-xs font-mono">VITE_OWNER_UID</code> in your environment configuration to enable owner access.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={logout}
                                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-medium text-primary dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                            >
                                Sign Out
                            </button>
                            <Link
                                to="/portfolio"
                                className="px-4 py-2 rounded-lg bg-primary dark:bg-gray-100 text-sm font-medium text-white dark:text-gray-900 hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center"
                            >
                                Back to Portfolio
                            </Link>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen flex items-center justify-center bg-background dark:bg-gray-950 px-6 py-12 transition-colors">
                <div className="max-w-md w-full bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-6 text-center shadow-lg">
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                        !
                    </div>
                    <h2 className="text-xl font-display font-bold text-primary dark:text-gray-100 mb-2">
                        Owner Access Only
                    </h2>
                    <p className="text-sm text-secondary dark:text-gray-400 mb-6 leading-relaxed">
                        You are signed in as <span className="font-mono text-xs">{user.email}</span>, but write access to this diary is reserved for the owner account.
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={logout}
                            className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm font-medium text-primary dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                        >
                            Sign Out
                        </button>
                        <Link
                            to="/portfolio"
                            className="px-4 py-2 rounded-lg bg-primary dark:bg-gray-100 text-sm font-medium text-white dark:text-gray-900 hover:opacity-90 transition-opacity cursor-pointer inline-flex items-center"
                        >
                            Back to Portfolio
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return children;
};


RequireAuth.propTypes = {
    children: PropTypes.node.isRequired,
};

export default RequireAuth;
