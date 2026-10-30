import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BsArrowLeft, BsSun, BsMoonStars } from 'react-icons/bs';

const LoginPage = ({ darkMode, setDarkMode }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { user, isOwner, login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || '/app/home';

    // If already signed in as owner, redirect
    React.useEffect(() => {
        if (user && isOwner) {
            navigate(from, { replace: true });
        }
    }, [user, isOwner, navigate, from]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);

        try {
            await login(email, password);
            navigate(from, { replace: true });
        } catch (err) {
            console.error('Login error:', err);
            let message = 'Failed to sign in. Please check your email and password.';
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                message = 'Invalid email or password.';
            } else if (err.code === 'auth/too-many-requests') {
                message = 'Too many failed login attempts. Please try again later.';
            } else if (err.code === 'auth/network-request-failed') {
                message = 'Network error. Please check your internet connection.';
            }
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`min-h-screen flex flex-col justify-between transition-colors ${darkMode ? 'dark bg-gray-950 text-gray-100' : 'bg-background text-primary'}`}>
            {/* Top Bar */}
            <header className="max-w-md w-full mx-auto px-6 pt-8 flex items-center justify-between">
                <Link
                    to="/portfolio"
                    className="inline-flex items-center gap-2 text-sm text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 transition-colors"
                >
                    <BsArrowLeft className="w-4 h-4" />
                    Back to Portfolio
                </Link>

                <button
                    onClick={() => setDarkMode(!darkMode)}
                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-yellow-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all cursor-pointer"
                    aria-label="Toggle Dark Mode"
                >
                    {darkMode ? <BsMoonStars className="w-4 h-4" /> : <BsSun className="w-4 h-4" />}
                </button>
            </header>

            {/* Login Card */}
            <main className="max-w-md w-full mx-auto px-6 py-12">
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-8 shadow-sm">
                    <div className="text-center mb-8">
                        <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3 text-lg font-bold font-display text-primary dark:text-gray-100">
                            RD
                        </div>
                        <h1 className="text-2xl font-display font-bold text-primary dark:text-gray-100">
                            Diary Sign In
                        </h1>
                        <p className="text-xs text-secondary dark:text-gray-400 mt-1">
                            Private logging access for games &amp; books
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-xs">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1.5" htmlFor="login-email">
                                Email Address
                            </label>
                            <input
                                id="login-email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                placeholder="you@example.com"
                                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-border dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:ring-gray-500/20 dark:focus:border-gray-500 text-primary dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1.5" htmlFor="login-password">
                                Password
                            </label>
                            <input
                                id="login-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/60 border border-border dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary dark:focus:ring-gray-500/20 dark:focus:border-gray-500 text-primary dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full mt-2 py-2.5 px-4 rounded-lg bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-semibold hover:bg-black/90 dark:hover:bg-gray-200 transition-all disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/20 border-t-white dark:border-gray-900/20 dark:border-t-gray-900 rounded-full animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>
                </div>
            </main>

            {/* Footer */}
            <footer className="text-center py-6 text-xs text-secondary dark:text-gray-500">
                Ralph Dulla &middot; Private Diary
            </footer>
        </div>
    );
};

LoginPage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};

export default LoginPage;
