import DiarySelect from '../../components/ui/DiarySelect';
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { DiaryShell } from '../../components/diary/DiaryShell';
import { useAuth } from '../../context/AuthContext';
import { useTimer } from '../../context/TimerContext';
import {
    watchPublicGames,
    saveGame,
    deleteGame,
    getGamePrivateNotes,
    publishLibraryItem,
    unpublishLibraryItem,
    watchPublicShelf,
} from '../../lib/db';
import { useDiarySessions } from '../../hooks/useDiarySessions';
import {
    BsArrowLeft,
    BsStarFill,
    BsClock,
    BsController,
    BsTrash3,
    BsPencilSquare,
    BsJournalText,
    BsGlobe,
} from 'react-icons/bs';

export default function GameDetailPage({ darkMode, setDarkMode }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { startTimer } = useTimer();

    const [game, setGame] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'sessions' | 'notes' | 'playthroughs'

    const [privateNotes, setPrivateNotes] = useState('');
    const [loadingNotes, setLoadingNotes] = useState(true);

    const { sessions: gameSessions, loading: loadingGameSessions } = useDiarySessions({
        libraryItemId: id,
        mediaType: 'game',
    });

    // Update playtime modal
    const [isPlaytimeModalOpen, setIsPlaytimeModalOpen] = useState(false);
    const [newHours, setNewHours] = useState('');
    const [newStatus, setNewStatus] = useState('finished');
    const [savingPlaytime, setSavingPlaytime] = useState(false);

    useEffect(() => {
        if (!user || !id) return;
        const unsubscribe = watchPublicGames(user.uid, (data) => {
            const found = data.find((g) => {
                const gameId = String(g.id || g.rawgId || g.title);
                return gameId === id || String(g.id) === id;
            });
            if (found) {
                const safeId = String(found.id || found.rawgId || found.title);
                setGame({ ...found, id: safeId });
                setNewHours(String(found.hoursPlayed || '0'));
                setNewStatus(found.status || (found.finishedOn ? 'finished' : 'playing'));
            } else {
                setGame(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user, id]);

    useEffect(() => {
        if (!user || !game?.id) return;
        let active = true;
        (async () => {
            try {
                const notes = await getGamePrivateNotes(user.uid, game.id);
                if (active) setPrivateNotes(notes || '');
            } catch (err) {
                console.error('Error fetching game notes:', err);
            } finally {
                if (active) setLoadingNotes(false);
            }
        })();

        return () => {
            active = false;
        };
    }, [user, game?.id]);

    const [isPublished, setIsPublished] = useState(false);

    // Subscribe to public shelf updates
    useEffect(() => {
        if (!user || !game?.id) return;
        const unsub = watchPublicShelf(user.uid, (shelf) => {
            setIsPublished(shelf.some((item) => String(item.id) === String(game.id)));
        });
        return () => unsub();
    }, [user, game?.id]);

    const handleTogglePublish = async () => {
        if (!user || !game) return;
        try {
            if (isPublished) {
                await unpublishLibraryItem(user.uid, game.id);
                setIsPublished(false);
            } else {
                await publishLibraryItem(user.uid, { ...game, mediaType: 'game' });
                setIsPublished(true);
            }
        } catch (err) {
            alert('Failed to update publication: ' + err.message);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Are you sure you want to delete "${game.title}"? This cannot be undone.`)) return;
        try {
            await deleteGame(user.uid, game.id);
            navigate('/app/library/games');
        } catch (err) {
            alert('Failed to delete game: ' + err.message);
        }
    };

    const handleSavePlaytime = async (e) => {
        e.preventDefault();
        if (!user || !game) return;
        setSavingPlaytime(true);

        try {
            const hours = Math.max(0, parseFloat(newHours) || 0);
            const isFinished = newStatus === 'finished';

            const updated = {
                ...game,
                hoursPlayed: hours,
                status: newStatus,
                finishedOn: isFinished ? (game.finishedOn || new Date().toISOString().split('T')[0]) : '',
            };

            await saveGame(user.uid, updated, privateNotes);

            // Cumulative corrections are baseline edits, not dated play sessions.
            // Creating a synthetic session here double-counts time in Insights.

            setIsPlaytimeModalOpen(false);
        } catch (err) {
            alert('Failed to update playtime: ' + err.message);
        } finally {
            setSavingPlaytime(false);
        }
    };

    if (loading) {
        return (
            <DiaryShell title="Game Detail" darkMode={darkMode} setDarkMode={setDarkMode}>
                <div className="py-24 text-center">
                    <div className="w-8 h-8 border-2 border-primary/20 border-t-primary dark:border-gray-700 dark:border-t-gray-100 rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-secondary dark:text-gray-400 mt-3">Loading game details...</p>
                </div>
            </DiaryShell>
        );
    }

    if (!game) {
        return (
            <DiaryShell title="Game Not Found" darkMode={darkMode} setDarkMode={setDarkMode}>
                <div className="py-20 text-center max-w-md mx-auto">
                    <BsController className="w-12 h-12 text-secondary dark:text-gray-600 mx-auto mb-4" />
                    <h2 className="text-lg font-bold text-primary dark:text-gray-100">Game Not Found</h2>
                    <p className="text-xs text-secondary dark:text-gray-400 mt-1 mb-6">
                        The requested game does not exist or has been removed.
                    </p>
                    <Link
                        to="/app/library/games"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold"
                    >
                        <BsArrowLeft className="w-3.5 h-3.5" /> Back to Games
                    </Link>
                </div>
            </DiaryShell>
        );
    }

    const gameStatus = game.status || (game.finishedOn ? 'finished' : 'playing');

    return (
        <DiaryShell title={game.title} darkMode={darkMode} setDarkMode={setDarkMode}>
            {/* Top Navigation */}
            <div className="mb-6 flex items-center justify-between">
                <Link
                    to="/app/library/games"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 transition-colors"
                >
                    <BsArrowLeft className="w-4 h-4" /> Back to Games
                </Link>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleTogglePublish}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isPublished
                                ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-600 dark:text-purple-400'
                                : 'bg-white dark:bg-gray-900 border-border dark:border-gray-800 text-secondary dark:text-gray-400 hover:text-purple-600'
                        }`}
                        title={isPublished ? 'Published to Public Shelf (Click to unpublish)' : 'Publish to Public Shelf'}
                    >
                        <BsGlobe className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{isPublished ? 'Published' : 'Publish to Shelf'}</span>
                    </button>
                    <button
                        onClick={handleDelete}
                        className="p-2 rounded-xl bg-white dark:bg-gray-900 border border-border dark:border-gray-800 text-secondary dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete game"
                    >
                        <BsTrash3 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Game Header Card */}
            <div className="diary-feature-card rounded-3xl p-6 sm:p-8 mb-6">
                <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 items-start">
                    {/* Cover Art */}
                    <div className="diary-detail-cover w-full sm:w-56 shrink-0 aspect-[16/9] rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-border/50 dark:border-gray-800 shadow-md">
                        {game.cover ? (
                            <img
                                src={game.cover}
                                alt={game.title}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                                <BsController className="w-8 h-8 text-secondary dark:text-gray-600 mb-2" />
                                <span className="text-[11px] font-medium text-secondary">{game.title}</span>
                            </div>
                        )}
                    </div>

                    {/* Game Metadata */}
                    <div className="flex-1 w-full text-center sm:text-left">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200/50 dark:border-purple-900/50">
                                {gameStatus}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50">
                                <BsStarFill className="w-2.5 h-2.5" />
                                {game.rating} / 10
                            </span>
                        </div>

                        <h1 className="text-xl sm:text-2xl font-display font-bold text-primary dark:text-gray-100">
                            {game.title}
                        </h1>
                        <p className="text-sm font-medium text-secondary dark:text-gray-300 mt-1">
                            {game.platform || 'General Platform'}
                        </p>

                        {/* Playtime Section */}
                        <div className="mt-6 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-border/50 dark:border-gray-800">
                            <div className="flex items-center justify-between text-xs font-semibold mb-3">
                                <span className="text-primary dark:text-gray-200">Tracked Playtime</span>
                                <span className="text-primary dark:text-gray-100 font-bold">
                                    {game.hoursPlayed ? `${game.hoursPlayed} hours` : '0 hours'}
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    onClick={() => {
                                        startTimer({
                                            mediaType: 'game',
                                            itemId: game.id,
                                            itemTitle: game.title,
                                            itemCover: game.cover || '',
                                            fromHours: game.hoursPlayed || 0,
                                        });
                                    }}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-semibold shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                                >
                                    <BsClock className="w-3.5 h-3.5" /> Start Play Timer
                                </button>
                                <button
                                    onClick={() => setIsPlaytimeModalOpen(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-gray-900 border border-border dark:border-gray-700 text-primary dark:text-gray-200 text-xs font-semibold shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                >
                                    Log Playtime Manually
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section Tabs */}
            <div className="flex border-b border-border dark:border-gray-800 mb-6 gap-6 text-xs font-semibold">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`pb-3 border-b-2 cursor-pointer transition-colors ${
                        activeTab === 'overview'
                            ? 'border-primary dark:border-gray-100 text-primary dark:text-gray-100'
                            : 'border-transparent text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                    }`}
                >
                    Overview
                </button>
                <button
                    onClick={() => setActiveTab('sessions')}
                    className={`pb-3 border-b-2 cursor-pointer transition-colors ${
                        activeTab === 'sessions'
                            ? 'border-primary dark:border-gray-100 text-primary dark:text-gray-100'
                            : 'border-transparent text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                    }`}
                >
                    Play Sessions
                </button>
                <button
                    onClick={() => setActiveTab('notes')}
                    className={`pb-3 border-b-2 cursor-pointer transition-colors ${
                        activeTab === 'notes'
                            ? 'border-primary dark:border-gray-100 text-primary dark:text-gray-100'
                            : 'border-transparent text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                    }`}
                >
                    Notes &amp; Review
                </button>
                <button
                    onClick={() => setActiveTab('playthroughs')}
                    className={`pb-3 border-b-2 cursor-pointer transition-colors ${
                        activeTab === 'playthroughs'
                            ? 'border-primary dark:border-gray-100 text-primary dark:text-gray-100'
                            : 'border-transparent text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-200'
                    }`}
                >
                    Playthroughs
                </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'overview' && (
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                            <p className="text-[11px] text-secondary dark:text-gray-400 uppercase tracking-wider">Finished Date</p>
                            <p className="text-xs font-semibold text-primary dark:text-gray-200 mt-0.5">
                                {game.finishedOn || '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] text-secondary dark:text-gray-400 uppercase tracking-wider">Release Date</p>
                            <p className="text-xs font-semibold text-primary dark:text-gray-200 mt-0.5">
                                {game.released || '—'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] text-secondary dark:text-gray-400 uppercase tracking-wider">Platform</p>
                            <p className="text-xs font-semibold text-primary dark:text-gray-200 mt-0.5">
                                {game.platform || 'General'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] text-secondary dark:text-gray-400 uppercase tracking-wider">Database ID</p>
                            <p className="text-xs font-semibold text-primary dark:text-gray-200 mt-0.5 truncate">
                                {game.rawgId ? `RAWG #${game.rawgId}` : 'Manual'}
                            </p>
                        </div>
                    </div>

                    {game.genres && (
                        <div className="pt-4 border-t border-border/50 dark:border-gray-800">
                            <p className="text-[11px] text-secondary dark:text-gray-400 uppercase tracking-wider mb-2">Genres</p>
                            <div className="flex flex-wrap gap-1.5">
                                {(Array.isArray(game.genres) ? game.genres : [game.genres]).map((g, idx) => (
                                    <span
                                        key={idx}
                                        className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-secondary dark:text-gray-300"
                                    >
                                        {g}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'sessions' && (
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                    {loadingGameSessions ? (
                        <div className="py-8 text-center text-xs text-secondary">Loading play sessions...</div>
                    ) : gameSessions.length === 0 ? (
                        <div className="py-12 text-center">
                            <BsClock className="w-8 h-8 text-secondary dark:text-gray-600 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-primary dark:text-gray-200">No play sessions recorded yet</p>
                            <p className="text-[11px] text-secondary dark:text-gray-400 mt-1">
                                Use Start Play Timer or Log Playtime Manually to record sessions.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {gameSessions.map((sess, idx) => (
                                <div
                                    key={sess.id || idx}
                                    className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-border/50 dark:border-gray-800 flex items-center justify-between text-xs"
                                >
                                    <div>
                                        <p className="font-semibold text-primary dark:text-gray-200">
                                            {sess.date || sess.startedAt?.split('T')[0] || 'Unknown Date'}
                                        </p>
                                        <p className="text-[11px] text-secondary dark:text-gray-400 mt-0.5">
                                            Playtime: {sess.activeSeconds ? `${Math.floor(sess.activeSeconds / 60)} mins` : `${sess.minutes || 0} mins`}
                                            {sess.notes ? ` • ${sess.notes}` : ''}
                                        </p>
                                    </div>
                                    <span className="font-bold text-primary dark:text-gray-100">
                                        {sess.activeSeconds ? `${(sess.activeSeconds / 3600).toFixed(1)} hrs` : `${((sess.minutes || 0) / 60).toFixed(1)} hrs`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'notes' && (
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                    {loadingNotes ? (
                        <div className="py-8 text-center text-xs text-secondary">Loading notes...</div>
                    ) : !privateNotes ? (
                        <div className="py-12 text-center">
                            <BsJournalText className="w-8 h-8 text-secondary dark:text-gray-600 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-primary dark:text-gray-200">No private review or notes</p>
                            <p className="text-[11px] text-secondary dark:text-gray-400 mt-1">
                                Private notes and playthrough thoughts remain completely private.
                            </p>
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap text-xs text-primary dark:text-gray-200 leading-relaxed font-sans bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-border/50 dark:border-gray-800">
                            {privateNotes}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'playthroughs' && (
                <div className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-6 shadow-sm">
                    <div className="space-y-3">
                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-border/50 dark:border-gray-800 flex items-center justify-between text-xs">
                            <div>
                                <span className="font-semibold text-primary dark:text-gray-200">
                                    Playthrough #1 ({gameStatus})
                                </span>
                                <p className="text-[11px] text-secondary dark:text-gray-400 mt-0.5">
                                    Finished: {game.finishedOn || 'In progress'} &bull; Hours: {game.hoursPlayed || 0}h
                                </p>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                                {gameStatus}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Playtime Modal */}
            {isPlaytimeModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={() => setIsPlaytimeModalOpen(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-base font-bold text-primary dark:text-gray-100 mb-4">
                            Log Playtime
                        </h3>

                        <form onSubmit={handleSavePlaytime} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Total Hours Played
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={newHours}
                                    onChange={(e) => setNewHours(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl text-xs bg-gray-50 dark:bg-gray-800 border border-border dark:border-gray-700 text-primary dark:text-gray-100"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-secondary dark:text-gray-400 mb-1">
                                    Status
                                </label>
                                <DiarySelect label="Status" value={newStatus} onChange={setNewStatus} options={[{ value: 'finished', label: 'Finished' },{ value: 'playing', label: 'Playing' },{ value: 'backlog', label: 'Backlog' },{ value: 'paused', label: 'Paused' },{ value: 'dropped', label: 'Dropped' },{ value: 'replaying', label: 'Replaying' }]} />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsPlaytimeModalOpen(false)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-secondary hover:text-primary dark:hover:text-gray-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingPlaytime}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary dark:bg-gray-100 text-white dark:text-gray-900 cursor-pointer disabled:opacity-60"
                                >
                                    {savingPlaytime ? 'Saving...' : 'Save Playtime'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DiaryShell>
    );
}

GameDetailPage.propTypes = {
    darkMode: PropTypes.bool.isRequired,
    setDarkMode: PropTypes.func.isRequired,
};
