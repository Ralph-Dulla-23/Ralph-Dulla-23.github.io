import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import BottomTabs from '../../components/navigation/BottomTabs';
import { useAuth } from '../../context/AuthContext';
import {
    saveGame,
    deleteGame,
    watchPublicGames,
    getGamePrivateNotes,
    calculateGameStats,
} from '../../lib/db';
import { searchGames } from '../../lib/rawg';
import {
    BsPlusLg,
    BsStarFill,
    BsClock,
    BsController,
    BsTrash3,
    BsPencilSquare,
    BsSearch,
    BsLockFill,
} from 'react-icons/bs';

const GamesPage = ({ darkMode, setDarkMode }) => {
    const { user } = useAuth();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGame, setEditingGame] = useState(null);
    const [title, setTitle] = useState('');
    const [platform, setPlatform] = useState('PC');
    const [hoursPlayed, setHoursPlayed] = useState('');
    const [rating, setRating] = useState('8');
    const [finishedOn, setFinishedOn] = useState(new Date().toISOString().split('T')[0]);
    const [cover, setCover] = useState('');
    const [privateReview, setPrivateReview] = useState('');
    const [saving, setSaving] = useState(false);

    // RAWG Search in Modal
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    useEffect(() => {
        if (!user) return;
        const unsubscribe = watchPublicGames(user.uid, (data) => {
            setGames(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    const stats = calculateGameStats(games);

    const openAddModal = () => {
        setEditingGame(null);
        setTitle('');
        setPlatform('PC');
        setHoursPlayed('');
        setRating('8');
        setFinishedOn(new Date().toISOString().split('T')[0]);
        setCover('');
        setPrivateReview('');
        setSearchQuery('');
        setSearchResults([]);
        setIsModalOpen(true);
    };

    const openEditModal = async (game) => {
        setEditingGame(game);
        setTitle(game.title || '');
        setPlatform(game.platform || 'PC');
        setHoursPlayed(String(game.hoursPlayed || ''));
        setRating(String(game.rating || '8'));
        setFinishedOn(game.finishedOn || '');
        setCover(game.cover || '');
        setSearchQuery('');
        setSearchResults([]);

        // Load private review from private subcollection
        try {
            const review = await getGamePrivateNotes(user.uid, game.id);
            setPrivateReview(review);
        } catch {
            setPrivateReview('');
        }
        setIsModalOpen(true);
    };

    const handleSearchRAWG = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const results = await searchGames(searchQuery);
            setSearchResults(results);
        } catch (err) {
            console.error('RAWG search error:', err);
        } finally {
            setSearching(false);
        }
    };

    const selectRAWGGame = (game) => {
        setTitle(game.title);
        if (game.cover) setCover(game.cover);
        if (game.platforms?.length) setPlatform(game.platforms[0]);
        setSearchResults([]);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);

        try {
            await saveGame(
                user.uid,
                {
                    id: editingGame?.id,
                    title: title.trim(),
                    platform,
                    hoursPlayed: Number(hoursPlayed) || 0,
                    rating: Number(rating) || 0,
                    finishedOn,
                    cover: cover.trim(),
                    status: 'finished',
                },
                privateReview
            );
            setIsModalOpen(false);
        } catch (err) {
            console.error('Failed to save game:', err);
            alert('Failed to save game: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (gameId) => {
        if (!window.confirm('Are you sure you want to delete this game entry?')) return;
        try {
            await deleteGame(user.uid, gameId);
        } catch (err) {
            alert('Failed to delete game: ' + err.message);
        }
    };

    return (
        <BottomTabs title="Games Diary" darkMode={darkMode} setDarkMode={setDarkMode}>
            {/* Header & Stats Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-display font-bold text-primary dark:text-gray-100">
                        Games Logged
                    </h1>
                    <p className="text-xs text-secondary dark:text-gray-400 mt-0.5">
                        Log completed games and track your personal ratings
                    </p>
                </div>

                <button
                    onClick={openAddModal}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 font-semibold text-sm hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                >
                    <BsPlusLg className="w-4 h-4" />
                    Log Game
                </button>
            </div>

            {/* Stat Tiles */}
            <div className="grid grid-cols-3 gap-3 mb-8">
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-display font-bold text-primary dark:text-gray-100">
                        {stats.totalFinished}
                    </p>
                    <p className="text-[11px] text-secondary dark:text-gray-400 mt-1 uppercase tracking-wider">
                        Finished
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-display font-bold text-primary dark:text-gray-100">
                        {stats.totalHours}
                    </p>
                    <p className="text-[11px] text-secondary dark:text-gray-400 mt-1 uppercase tracking-wider">
                        Hours
                    </p>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-display font-bold text-amber-500">
                        {stats.avgRating}
                    </p>
                    <p className="text-[11px] text-secondary dark:text-gray-400 mt-1 uppercase tracking-wider">
                        Avg / 10
                    </p>
                </div>
            </div>

            {/* Games Grid / List */}
            {loading ? (
                <div className="py-20 text-center">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary dark:border-gray-700 dark:border-t-gray-100 rounded-full animate-spin mx-auto" />
                </div>
            ) : games.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-900 border border-dashed border-border dark:border-gray-800 rounded-2xl p-8">
                    <BsController className="w-10 h-10 text-secondary dark:text-gray-600 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-primary dark:text-gray-200">
                        No games logged yet
                    </h3>
                    <p className="text-xs text-secondary dark:text-gray-400 max-w-sm mx-auto mt-1 mb-5">
                        Log your first completed game to see your stats, ratings, and gaming history.
                    </p>
                    <button
                        onClick={openAddModal}
                        className="px-4 py-2 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold cursor-pointer"
                    >
                        + Log Your First Game
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {games.map((game) => (
                        <div
                            key={game.id}
                            className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between group"
                        >
                            <div>
                                <div className="relative aspect-[16/9] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                    {game.cover ? (
                                        <img
                                            src={game.cover}
                                            alt={game.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <BsController className="w-8 h-8 text-secondary dark:text-gray-600" />
                                        </div>
                                    )}
                                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-gray-900 shadow-sm flex items-center gap-1">
                                        <BsStarFill className="w-3 h-3" />
                                        {game.rating}
                                    </span>
                                </div>

                                <div className="p-4">
                                    <h3 className="font-semibold text-sm text-primary dark:text-gray-100 truncate">
                                        {game.title}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-secondary dark:text-gray-400 mt-1">
                                        <span>{game.platform || 'General'}</span>
                                        {game.hoursPlayed > 0 && (
                                            <>
                                                <span>&middot;</span>
                                                <span className="flex items-center gap-1">
                                                    <BsClock className="w-3 h-3" />
                                                    {game.hoursPlayed}h
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    {game.finishedOn && (
                                        <p className="text-[11px] text-secondary dark:text-gray-500 mt-1">
                                            Finished: {game.finishedOn}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="px-4 pb-3 pt-1 border-t border-border/50 dark:border-gray-800/50 flex items-center justify-end gap-2">
                                <button
                                    onClick={() => openEditModal(game)}
                                    className="p-1.5 text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 cursor-pointer"
                                    title="Edit Game"
                                >
                                    <BsPencilSquare className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(game.id)}
                                    className="p-1.5 text-secondary dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                    title="Delete Game"
                                >
                                    <BsTrash3 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add / Edit Game Modal */}
            {isModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
                    onClick={() => setIsModalOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl my-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-display font-bold text-primary dark:text-gray-100 mb-4">
                            {editingGame ? 'Edit Game Log' : 'Log a Finished Game'}
                        </h2>

                        {/* Optional RAWG Search */}
                        <form onSubmit={handleSearchRAWG} className="mb-4">
                            <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                Search RAWG (Optional)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search title..."
                                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-xs"
                                />
                                <button
                                    type="submit"
                                    disabled={searching}
                                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                                >
                                    <BsSearch className="w-3 h-3" />
                                    {searching ? '...' : 'Search'}
                                </button>
                            </div>

                            {searchResults.length > 0 && (
                                <div className="mt-2 max-h-40 overflow-y-auto border border-border dark:border-gray-800 rounded-lg p-1 space-y-1">
                                    {searchResults.map((r) => (
                                        <div
                                            key={r.rawgId}
                                            onClick={() => selectRAWGGame(r)}
                                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer flex items-center gap-2 text-xs"
                                        >
                                            {r.cover && <img src={r.cover} alt="" className="w-8 h-8 rounded object-cover" />}
                                            <span className="truncate">{r.title}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </form>

                        <form onSubmit={handleSave} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Game Title *
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                    placeholder="e.g. Elden Ring"
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                        Platform
                                    </label>
                                    <input
                                        type="text"
                                        value={platform}
                                        onChange={(e) => setPlatform(e.target.value)}
                                        placeholder="PC, PS5, Switch..."
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                        Hours Played
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={hoursPlayed}
                                        onChange={(e) => setHoursPlayed(e.target.value)}
                                        placeholder="e.g. 45"
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                        Rating (0 - 10)
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        step="0.5"
                                        value={rating}
                                        onChange={(e) => setRating(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                        Date Finished
                                    </label>
                                    <input
                                        type="date"
                                        value={finishedOn}
                                        onChange={(e) => setFinishedOn(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Cover Image URL
                                </label>
                                <input
                                    type="url"
                                    value={cover}
                                    onChange={(e) => setCover(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                />
                            </div>

                            {/* Private Review (Owner Only) */}
                            <div className="pt-2 border-t border-border dark:border-gray-800">
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-secondary dark:text-gray-400 mb-1">
                                    <BsLockFill className="w-3 h-3 text-amber-500" />
                                    Private Review / Personal Notes (Hidden from Public Website)
                                </label>
                                <textarea
                                    rows="3"
                                    value={privateReview}
                                    onChange={(e) => setPrivateReview(e.target.value)}
                                    placeholder="Write your honest review or thoughts. Stored in your private subcollection..."
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-xs resize-none"
                                />
                            </div>

                            <div className="flex gap-2 justify-end pt-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-primary dark:text-gray-400 dark:hover:text-gray-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold cursor-pointer disabled:opacity-60"
                                >
                                    {saving ? 'Saving...' : 'Save Game'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </BottomTabs>
    );
};

GamesPage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};

export default GamesPage;
