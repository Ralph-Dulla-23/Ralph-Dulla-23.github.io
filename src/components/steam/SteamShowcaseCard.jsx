import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { BsSteam, BsBoxArrowUpRight, BsClock, BsController, BsCalendar3 } from 'react-icons/bs';
import { loadSteamStats, getSteamOnlineStatusConfig, DEFAULT_PROFILE_URL } from '../../lib/steam';

export default function SteamShowcaseCard({ className = '', onFilterSteam = null }) {
    const [steam, setSteam] = useState(null);
    const [loading, setLoading] = useState(true);
    const [imageErrors, setImageErrors] = useState({});

    useEffect(() => {
        let mounted = true;
        loadSteamStats().then((data) => {
            if (mounted) {
                setSteam(data);
                setLoading(false);
            }
        });
        return () => {
            mounted = false;
        };
    }, []);

    const handleImageError = (appId) => {
        setImageErrors((prev) => ({ ...prev, [appId]: true }));
    };

    if (loading) {
        return (
            <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 animate-pulse ${className}`}>
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800" />
                    <div className="space-y-2 flex-1">
                        <div className="h-5 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg" />
                        <div className="h-3.5 w-24 bg-gray-200 dark:bg-gray-800 rounded-lg" />
                    </div>
                </div>
            </div>
        );
    }

    if (!steam) {
        return null;
    }

    const statusConfig = getSteamOnlineStatusConfig(steam.onlineState);
    const profileUrl = steam.profileUrl || DEFAULT_PROFILE_URL;

    // Filter out internal tools or utility IDs like 480 (Spacewar)
    const validRecentGames = (steam.recentGames || []).filter(
        (g) => g.appId !== '480' && g.name && g.name !== 'Spacewar'
    );

    return (
        <section
            aria-label="Steam Gaming Profile"
            className={`overflow-hidden bg-white dark:bg-gray-900 border border-gray-200/90 dark:border-gray-800 rounded-2xl p-6 shadow-sm transition-all duration-300 hover:shadow-md ${className}`}
        >
            {/* Header: Avatar, Name, Status, and Steam Profile Link */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    {/* Fixed 64x64 Avatar with precisely anchored status dot */}
                    <div className="relative w-16 h-16 flex-shrink-0">
                        {steam.avatarUrl ? (
                            <img
                                src={steam.avatarUrl}
                                alt={steam.personaName}
                                className="w-16 h-16 rounded-full object-cover ring-2 ring-gray-100 dark:ring-gray-800 shadow-sm"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                <BsSteam className="w-8 h-8 text-secondary dark:text-gray-400" />
                            </div>
                        )}
                        <span
                            className={`absolute bottom-0 right-0 w-4 h-4 rounded-full ring-2 ring-white dark:ring-gray-900 ${statusConfig.dotClass}`}
                            title={`Status: ${statusConfig.label}`}
                        />
                    </div>

                    {/* Persona info */}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-display font-bold text-lg text-primary dark:text-gray-100 truncate">
                                {steam.personaName}
                            </h3>
                            <span
                                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusConfig.badgeClass}`}
                            >
                                {statusConfig.label}
                            </span>
                        </div>
                        <p className="text-xs text-secondary dark:text-gray-400 truncate mt-0.5">
                            {steam.realName ? `${steam.realName} · ` : ''}
                            {steam.stateMessage || 'Steam Player'}
                        </p>
                    </div>
                </div>

                {/* Profile actions */}
                <div className="flex items-center gap-2">
                    {onFilterSteam && (
                        <button
                            type="button"
                            onClick={onFilterSteam}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600 text-xs font-semibold text-secondary dark:text-gray-200 transition-colors cursor-pointer"
                        >
                            <BsController className="w-3.5 h-3.5 text-purple-500" />
                            <span>View Steam Shelf</span>
                        </button>
                    )}
                    <a
                        href={profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#171a21] hover:bg-[#222936] text-white text-xs font-semibold transition-all duration-200 shadow-sm cursor-pointer group"
                    >
                        <BsSteam className="w-3.5 h-3.5 text-blue-300 group-hover:scale-110 transition-transform" />
                        <span>Steam Profile</span>
                        <BsBoxArrowUpRight className="w-2.5 h-2.5 opacity-70 group-hover:opacity-100" />
                    </a>
                </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div
                    onClick={onFilterSteam}
                    className={`bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl p-3 text-center transition-all ${
                        onFilterSteam ? 'cursor-pointer hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-sm' : ''
                    }`}
                >
                    <span className="text-[11px] font-medium text-secondary dark:text-gray-400 flex items-center justify-center gap-1.5">
                        <BsController className="w-3 h-3 text-purple-500" />
                        Steam Games
                    </span>
                    <p className="font-display font-bold text-lg text-primary dark:text-gray-100 mt-0.5">
                        {steam.totalGames}
                    </p>
                </div>

                <div className="bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl p-3 text-center">
                    <span className="text-[11px] font-medium text-secondary dark:text-gray-400 flex items-center justify-center gap-1.5">
                        <BsClock className="w-3 h-3 text-blue-500" />
                        Playtime
                    </span>
                    <p className="font-display font-bold text-lg text-primary dark:text-gray-100 mt-0.5">
                        {steam.totalHours} hrs
                    </p>
                </div>

                <div className="bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl p-3 text-center">
                    <span className="text-[11px] font-medium text-secondary dark:text-gray-400 flex items-center justify-center gap-1.5">
                        <BsClock className="w-3 h-3 text-emerald-500" />
                        Past 2 Weeks
                    </span>
                    <p className="font-display font-bold text-lg text-primary dark:text-gray-100 mt-0.5">
                        {steam.hoursPlayed2Wk || 0} hrs
                    </p>
                </div>

                <div className="bg-gray-50/80 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 rounded-xl p-3 text-center">
                    <span className="text-[11px] font-medium text-secondary dark:text-gray-400 flex items-center justify-center gap-1.5">
                        <BsCalendar3 className="w-3 h-3 text-amber-500" />
                        Member Since
                    </span>
                    <p className="font-display font-bold text-xs sm:text-sm text-primary dark:text-gray-100 mt-1 truncate">
                        {steam.memberSince || 'September 2017'}
                    </p>
                </div>
            </div>

            {/* Recent Steam Activity Rows with reliable imagery */}
            {validRecentGames.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-primary dark:text-gray-200">
                            Recent Steam Activity
                        </h4>
                        <span className="text-[11px] text-secondary dark:text-gray-400">
                            Synced via Steam Web API
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {validRecentGames.map((game) => {
                            const hasError = imageErrors[game.appId];
                            const headerSrc =
                                game.logoUrl ||
                                (game.appId
                                    ? `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.appId}/header.jpg`
                                    : '');

                            return (
                                <div
                                    key={game.appId || game.name}
                                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-gray-50/60 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800/70 border border-gray-100 dark:border-gray-800/80 transition-colors group"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        {headerSrc && !hasError ? (
                                            <img
                                                src={headerSrc}
                                                alt={game.name}
                                                onError={() => handleImageError(game.appId)}
                                                className="w-14 h-8 object-cover rounded-md flex-shrink-0 bg-gray-200 dark:bg-gray-700 shadow-xs"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="w-14 h-8 rounded-md bg-[#1b2838] flex items-center justify-center flex-shrink-0 text-white">
                                                <BsSteam className="w-4 h-4 text-blue-300" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-primary dark:text-gray-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                                {game.name}
                                            </p>
                                            <p className="text-[10px] text-secondary dark:text-gray-400 truncate">
                                                {game.playtimeForeverHours} hrs on record
                                                {game.playtime2WkHours > 0 && (
                                                    <span className="text-emerald-600 dark:text-emerald-400 ml-1 font-medium">
                                                        · {game.playtime2WkHours}h recent
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {game.storeUrl && (
                                        <a
                                            href={game.storeUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[11px] font-medium text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white dark:hover:bg-gray-700 transition-colors flex-shrink-0 cursor-pointer"
                                            title="View on Steam Store"
                                        >
                                            <span>Store</span>
                                            <BsBoxArrowUpRight className="w-2.5 h-2.5" />
                                        </a>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </section>
    );
}

SteamShowcaseCard.propTypes = {
    className: PropTypes.string,
    onFilterSteam: PropTypes.func,
};
