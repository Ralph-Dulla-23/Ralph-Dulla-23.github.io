import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import DiaryEditorModal from '../../components/ui/DiaryEditorModal';
import DiarySelect from '../../components/ui/DiarySelect';
import ConfirmDiscardDialog from '../../components/ui/ConfirmDiscardDialog';
import { useEditorDraftGuard } from '../../hooks/useEditorDraftGuard';
import { Link, useSearchParams } from 'react-router-dom';
import BottomTabs from '../../components/navigation/BottomTabs';
import LibrarySegmentedSwitch from '../../components/library/LibrarySegmentedSwitch';
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

const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'finished', label: 'Finished' },
    { key: 'playing', label: 'Playing' },
    { key: 'backlog', label: 'Backlog' },
    { key: 'paused', label: 'Paused' },
    { key: 'dropped', label: 'Dropped' },
    { key: 'replaying', label: 'Replaying' },
];

const GamesPage = ({ darkMode, setDarkMode }) => {
    const { user } = useAuth();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchParams, setSearchParams] = useSearchParams();

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGame, setEditingGame] = useState(null);
    const [title, setTitle] = useState('');
    const [platform, setPlatform] = useState('PC');
    const [status, setStatus] = useState('finished');
    const [genres, setGenres] = useState('');
    const [rawgId, setRawgId] = useState(null);
    const [released, setReleased] = useState('');
    const [platforms, setPlatforms] = useState([]);
    const [hoursPlayed, setHoursPlayed] = useState('');
    const [rating, setRating] = useState('8');
    const [finishedOn, setFinishedOn] = useState(new Date().toISOString().split('T')[0]);
    const [cover, setCover] = useState('');
    const [privateReview, setPrivateReview] = useState('');
    const [saving, setSaving] = useState(false);
    const editSignature = JSON.stringify([title, platform, status, genres, hoursPlayed, rating, finishedOn, cover, privateReview]);
    const closeEditorNow = useCallback(() => setIsModalOpen(false), []);
    const draftGuard = useEditorDraftGuard(isModalOpen, editSignature, closeEditorNow);

    // Auto-Search in Modal
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    useEffect(() => {
        if (!user) return;
        const unsubscribe = watchPublicGames(user.uid, (data) => {
            setGames(data);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    // Live debounced auto-search (350ms)
    useEffect(() => {
        if (!isModalOpen) return;
        const q = searchQuery.trim();
        if (q.length < 2) return;

        let cancelled = false;

        const timer = setTimeout(async () => {
            setSearching(true);
            try {
                const results = await searchGames(q);
                if (!cancelled) {
                    setSearchResults(results);
                    setHasSearched(true);
                }
            } catch (err) {
                console.error('Game auto-search error:', err);
                if (!cancelled) {
                    setSearchResults([]);
                    setHasSearched(true);
                }
            } finally {
                if (!cancelled) {
                    setSearching(false);
                }
            }
        }, 350);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [searchQuery, isModalOpen]);

    const handleSearchQueryChange = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        if (val.trim().length < 2) {
            setSearchResults([]);
            setSearching(false);
            setHasSearched(false);
        } else {
            setSearching(true);
        }
    };

    const stats = calculateGameStats(games);

    const openAddModal = useCallback(() => {
        setEditingGame(null);
        setTitle('');
        setPlatform('PC');
        setStatus('finished');
        setGenres('');
        setRawgId(null);
        setReleased('');
        setPlatforms([]);
        setHoursPlayed('');
        setRating('8');
        setFinishedOn(new Date().toISOString().split('T')[0]);
        setCover('');
        setPrivateReview('');
        setSearchQuery('');
        setSearchResults([]);
        setHasSearched(false);
        setIsModalOpen(true);
    }, []);

    const openEditModal = useCallback(async (game) => {
        const safeGameId = String(game.id || game.rawgId || game.title);
        setEditingGame({ ...game, id: safeGameId });
        setTitle(game.title || '');
        setPlatform(game.platform || 'PC');
        setStatus(game.status || (game.finishedOn ? 'finished' : 'playing'));
        setGenres(Array.isArray(game.genres) ? game.genres.join(', ') : (game.genres || ''));
        setRawgId(game.rawgId || null);
        setReleased(game.released || '');
        setPlatforms(Array.isArray(game.platforms) ? game.platforms : (game.platform ? [game.platform] : []));
        setHoursPlayed(String(game.hoursPlayed || ''));
        setRating(String(game.rating || '8'));
        setFinishedOn(game.finishedOn || '');
        setCover(game.cover || '');
        setSearchQuery('');
        setSearchResults([]);
        setHasSearched(false);

        // Load private review from private subcollection
        if (user) {
            try {
                const review = await getGamePrivateNotes(user.uid, safeGameId);
                setPrivateReview(review);
            } catch {
                setPrivateReview('');
            }
        }
        setIsModalOpen(true);
    }, [user]);

    // Query-based quick action consumption (UX-01)
    const consumedActionRef = useRef(null);
    useEffect(() => {
        const action = searchParams.get('action');
        if (!action || consumedActionRef.current === action) return;
        consumedActionRef.current = action;

        const timer = setTimeout(() => {
            if (action === 'add') {
                openAddModal();
            } else if (action === 'log') {
                const playingGame = games.find((g) => g.status === 'playing') || games[0];
                if (playingGame) {
                    openEditModal(playingGame);
                } else {
                    openAddModal();
                }
            }
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('action');
                return next;
            }, { replace: true });
        }, 0);

        return () => clearTimeout(timer);
    }, [searchParams, setSearchParams, games, openAddModal, openEditModal]);

    const handleSearchRAWG = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const results = await searchGames(searchQuery.trim());
            setSearchResults(results);
            setHasSearched(true);
        } catch (err) {
            console.error('Game search error:', err);
            setHasSearched(true);
        } finally {
            setSearching(false);
        }
    };

    const selectRAWGGame = (game) => {
        setTitle(game.title || '');
        if (game.cover) setCover(game.cover);
        if (game.platforms?.length) {
            setPlatform(game.platforms[0]);
            setPlatforms(game.platforms);
        } else {
            setPlatform('PC');
            setPlatforms(['PC']);
        }
        if (game.rawgId) setRawgId(game.rawgId);
        if (game.released) setReleased(game.released);
        if (game.genres?.length) {
            setGenres(game.genres.join(', '));
        }
        setSearchQuery('');
        setSearchResults([]);
        setHasSearched(false);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);

        try {
            const genresArray = typeof genres === 'string'
                ? genres.split(',').map(s => s.trim()).filter(Boolean)
                : (Array.isArray(genres) ? genres : []);

            const platformsArray = platforms.length > 0
                ? platforms
                : (platform ? [platform] : []);

            await saveGame(
                user.uid,
                {
                    id: editingGame?.id,
                    mediaType: 'game',
                    title: title.trim(),
                    platform,
                    status,
                    hoursPlayed: Number(hoursPlayed) || 0,
                    rating: Number(rating) || 0,
                    finishedOn: status === 'finished' ? (finishedOn || new Date().toISOString().split('T')[0]) : '',
                    cover: cover.trim(),
                    rawgId: rawgId || editingGame?.rawgId || null,
                    released: released || editingGame?.released || '',
                    genres: genresArray.length > 0 ? genresArray : (editingGame?.genres || []),
                    platforms: platformsArray.length > 0 ? platformsArray : (editingGame?.platforms || []),
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
            await deleteGame(user.uid, String(gameId));
        } catch (err) {
            alert('Failed to delete game: ' + err.message);
        }
    };

    const filteredGames = games.filter((g) => {
        if (filter === 'all') return true;
        const gameStatus = g.status || (g.finishedOn ? 'finished' : 'playing');
        return gameStatus === filter;
    });

    return (
        <BottomTabs title="Games Diary" darkMode={darkMode} setDarkMode={setDarkMode}>
            {/* Library Switch */}
            <LibrarySegmentedSwitch />

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

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={openAddModal}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 font-semibold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
                    >
                        <BsPlusLg className="w-3.5 h-3.5" />
                        Log Game
                    </button>
                </div>
            </div>


            {/* Stat Tiles */}
            <div className="grid grid-cols-3 gap-3 mb-6">
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

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {statusTabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                            filter === tab.key
                                ? 'bg-primary text-white dark:bg-gray-100 dark:text-gray-900'
                                : 'bg-white dark:bg-gray-900 text-secondary dark:text-gray-400 border border-border dark:border-gray-800 hover:border-gray-400'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Games Grid / List */}
            {loading ? (
                <div className="py-20 text-center">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary dark:border-gray-700 dark:border-t-gray-100 rounded-full animate-spin mx-auto" />
                </div>
            ) : filteredGames.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-gray-900 border border-dashed border-border dark:border-gray-800 rounded-2xl p-8">
                    <BsController className="w-10 h-10 text-secondary dark:text-gray-600 mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-primary dark:text-gray-200">
                        {games.length === 0 ? 'No games logged yet' : 'No games in this tab'}
                    </h3>
                    <p className="text-xs text-secondary dark:text-gray-400 max-w-sm mx-auto mt-1 mb-5">
                        {games.length === 0
                            ? 'Log your first completed game to see your stats, ratings, and gaming history.'
                            : `No games currently found in "${filter}".`}
                    </p>
                    <button
                        onClick={games.length === 0 ? openAddModal : () => setFilter('all')}
                        className="px-4 py-2 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold cursor-pointer"
                    >
                        {games.length === 0 ? '+ Log Game' : 'Clear filter'}
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredGames.map((game) => {
                        const gameId = String(game.id || game.rawgId || game.title);
                        const gameStatus = game.status || (game.finishedOn ? 'finished' : 'playing');
                        return (
                            <div
                                key={gameId}
                                className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between group hover:border-primary/40 dark:hover:border-gray-700 transition-colors"
                            >
                                <Link to={`/app/games/${gameId}`} className="block flex-1 cursor-pointer">
                                    <div className="relative aspect-[16/9] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                                        {game.cover ? (
                                            <img
                                                src={game.cover}
                                                alt={game.title}
                                                className="w-full h-full object-cover group-hover:scale-[1.025] transition-transform duration-300"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <BsController className="w-8 h-8 text-secondary dark:text-gray-600" />
                                            </div>
                                        )}
                                        {gameStatus && gameStatus !== 'finished' && (
                                            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur-sm">
                                                {gameStatus}
                                            </span>
                                        )}
                                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-gray-900 shadow-sm flex items-center gap-1">
                                            <BsStarFill className="w-3 h-3" />
                                            {game.rating}
                                        </span>
                                    </div>

                                    <div className="p-4">
                                        <h3 className="font-semibold text-sm text-primary dark:text-gray-100 line-clamp-2 min-h-[2.5rem] group-hover:text-blue-500 transition-colors">
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
                                        {game.genres && game.genres.length > 0 && (
                                            <p className="text-[11px] text-secondary dark:text-gray-500 mt-1 truncate">
                                                {Array.isArray(game.genres) ? game.genres.slice(0, 3).join(', ') : game.genres}
                                            </p>
                                        )}
                                        {game.finishedOn && (
                                            <p className="text-[11px] text-secondary dark:text-gray-500 mt-1">
                                                Finished: {game.finishedOn}
                                            </p>
                                        )}
                                    </div>
                                </Link>

                                <div className="px-4 pb-3 pt-1 border-t border-border/50 dark:border-gray-800/50 flex items-center justify-end gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openEditModal({ ...game, id: gameId });
                                        }}
                                        className="p-1.5 text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 cursor-pointer"
                                        title="Edit Game"
                                    >
                                        <BsPencilSquare className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(gameId);
                                        }}
                                        className="p-1.5 text-secondary dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                                        title="Delete Game"
                                    >
                                        <BsTrash3 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add / Edit Game Modal */}
            {isModalOpen && (
                <DiaryEditorModal title={editingGame ? 'Edit Game' : 'Log Game'} onClose={draftGuard.requestClose} busy={saving} footer={<>
                    <button type="button" onClick={draftGuard.requestClose} disabled={saving} className="min-h-11 rounded-xl px-5 text-sm font-semibold text-gray-600 dark:text-gray-300">Cancel</button>
                    <button type="submit" form="game-editor-form" disabled={saving} className="min-h-11 rounded-xl bg-sky-600 px-6 text-sm font-bold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save Game'}</button>
                </>}>

                        {/* Auto-Search Games (Free Wikipedia + CheapShark + RAWG) */}
                        <form onSubmit={handleSearchRAWG} className="mb-4">
                            <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                Auto-Fill Game Info (Type to search games automatically)
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={handleSearchQueryChange}
                                    placeholder="Type game title (e.g. Elden Ring, Hollow Knight)..."
                                    className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-xs"
                                />
                                <button
                                    type="submit"
                                    disabled={searching}
                                    className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                                >
                                    <BsSearch className="w-3 h-3" />
                                    {searching ? 'Searching...' : 'Search'}
                                </button>
                            </div>

                            {searching && (
                                <div className="mt-2 p-2.5 text-xs text-secondary dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60 rounded-lg flex items-center gap-2">
                                    <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary dark:border-gray-600 dark:border-t-gray-200 rounded-full animate-spin" />
                                    Searching game database...
                                </div>
                            )}

                            {!searching && searchResults.length > 0 && (
                                <div className="mt-2 max-h-48 overflow-y-auto border border-border dark:border-gray-800 rounded-lg p-1 space-y-1 bg-white dark:bg-gray-900 shadow-inner">
                                    {searchResults.map((r, idx) => (
                                        <div
                                            key={r.rawgId || idx}
                                            onClick={() => selectRAWGGame(r)}
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer flex items-center gap-2.5 text-xs transition-colors"
                                        >
                                            {r.cover ? (
                                                <img
                                                    src={r.cover}
                                                    alt=""
                                                    className="w-10 h-10 rounded object-cover flex-shrink-0 bg-gray-200 dark:bg-gray-700"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0">
                                                    <BsController className="w-4 h-4 text-secondary" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-primary dark:text-gray-100 truncate">
                                                    {r.title}
                                                    {r.released && (
                                                        <span className="ml-1.5 font-normal text-secondary dark:text-gray-400">
                                                            ({r.released.slice(0, 4)})
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-[10px] text-secondary dark:text-gray-400 truncate">
                                                    {[
                                                        r.platforms?.slice(0, 3).join(', '),
                                                        r.genres?.slice(0, 3).join(', '),
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!searching && hasSearched && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                                <p className="mt-2 text-xs text-secondary dark:text-gray-400 italic px-1">
                                    No matches found for &ldquo;{searchQuery.trim()}&rdquo; &mdash; you can still enter details manually below.
                                </p>
                            )}
                        </form>

                        <form id="game-editor-form" onSubmit={handleSave} className="space-y-3">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-medium text-secondary dark:text-gray-400">
                                        Game Title *
                                    </label>
                                    {released && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-secondary dark:text-gray-400">
                                            Released: {released.slice(0, 4)}
                                        </span>
                                    )}
                                </div>
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
                                        Status
                                    </label>
                                    <DiarySelect label="Game status" value={status} onChange={setStatus} options={[{ value: 'finished', label: 'Finished' },{ value: 'playing', label: 'Playing' },{ value: 'backlog', label: 'Backlog' }]} />
                                </div>
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

                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Date Finished {status !== 'finished' && '(Optional)'}
                                </label>
                                <input
                                    type="date"
                                    value={finishedOn}
                                    onChange={(e) => setFinishedOn(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Genres (comma separated)
                                </label>
                                <input
                                    type="text"
                                    value={genres}
                                    onChange={(e) => setGenres(e.target.value)}
                                    placeholder="Action, RPG, Open World..."
                                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Cover Image URL
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="url"
                                        value={cover}
                                        onChange={(e) => setCover(e.target.value)}
                                        placeholder="https://..."
                                        className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 rounded-lg text-sm"
                                    />
                                    {cover && (
                                        <img
                                            src={cover}
                                            alt="Cover preview"
                                            className="w-12 h-10 rounded-lg object-cover border border-border dark:border-gray-700 flex-shrink-0 bg-gray-100 dark:bg-gray-800"
                                        />
                                    )}
                                </div>
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
                        </form>
                </DiaryEditorModal>
            )}
            {draftGuard.confirmDiscard && <ConfirmDiscardDialog onStay={draftGuard.keepEditing} onDiscard={draftGuard.discard}/>}
        </BottomTabs>
    );
};

GamesPage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};

export default GamesPage;
