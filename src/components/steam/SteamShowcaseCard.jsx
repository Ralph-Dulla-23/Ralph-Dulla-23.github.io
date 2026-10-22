import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { BsSteam, BsBoxArrowUpRight, BsClock, BsController, BsCalendar3 } from 'react-icons/bs';
import { loadSteamStats, getSteamOnlineStatusConfig, DEFAULT_PROFILE_URL } from '../../lib/steam';

export default function SteamShowcaseCard({ className = '' }) {
    const [steam, setSteam] = useState(null);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        return (
            <div className={`bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-6 animate-pulse ${className}`}>
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-800" />
                    <div className="space-y-2 flex-1">
                        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
                        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-800 rounded" />
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

    return (
        <section
            aria-label="Steam Gaming Profile"
            className={`relative overflow-hidden bg-white dark:bg-gray-900 border border-border dark:border-gray-800 rounded-2xl p-5 sm:p-6 shadow-sm transition-all duration-300 hover:shadow-md ${className}`}
        >
            {/* Top Row: Profile, Persona, Status and Steam Link */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
                <div className="flex items-center gap-3.5">
                    {/* Avatar with Online Glow Ring */}
                    <div className="relative flex-shrink-0">
                        {steam.avatarUrl ? (
                            <img
                                src={steam.avatarUrl}
                                alt={steam.personaName}
                                className="w-13 h-13 rounded-full object-cover ring-2 ring-border dark:ring-gray-700"
                                loading="lazy"
                            />
                        ) : (
                            <div className="w-13 h-13 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                                <BsSteam className="w-7 h-7 text-secondary dark:text-gray-400" />
                            </div>
                        )}
                        <span
                            className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-gray-900 ${statusConfig.dotClass}`}
                            title={`Status: ${statusConfig.label}`}
                        />
                    </div>

                    {/* Persona info */}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-display font-bold text-base sm:text-lg text-primary dark:text-gray-100 truncate">
                                {steam.personaName}
                            </h3>
                            <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusConfig.badgeClass}`}
                            >
                                {statusConfig.label}
                            </span>
                        </div>
                        <p className="text-xs text-secondary dark:text-gray-400 truncate mt-0.5">
                            {steam.realName ? `${steam.realName} · ` : ''}
                            {steam.stateMessage || 'Steam Account'}
                        </p>
                    </div>
                </div>

                {/* Direct Steam profile button */}
                <a
                    href={profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center self-start sm:self-auto gap-2 px-3.5 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-[#171a21] hover:text-white dark:hover:bg-primary dark:hover:text-gray-900 text-secondary dark:text-gray-300 text-xs font-semibold transition-all duration-200 group cursor-pointer"
                >
                    <BsSteam className="w-3.5 h-3.5 text-[#1b2838] dark:text-gray-300 group-hover:text-white dark:group-hover:text-gray-900 transition-colors" />
                    <span>Steam Profile</span>
                    <BsBoxArrowUpRight className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                </a>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
                <div className="bg-gray-50/70 dark:bg-gray-800/40 border border-border/70 dark:border-gray-800/80 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-secondary dark:text-gray-400 font-medium flex items-center justify-center gap-1">
                        <BsController className="w-3 h-3 text-purple-500" />
                        Games
                    </span>
                    <p className="font-display font-bold text-sm sm:text-base text-primary dark:text-gray-100 mt-0.5">
                        {steam.totalGames}
                    </p>
                </div>

                <div className="bg-gray-50/70 dark:bg-gray-800/40 border border-border/70 dark:border-gray-800/80 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-secondary dark:text-gray-400 font-medium flex items-center justify-center gap-1">
                        <BsClock className="w-3 h-3 text-blue-500" />
                        Playtime
                    </span>
                    <p className="font-display font-bold text-sm sm:text-base text-primary dark:text-gray-100 mt-0.5">
                        {steam.totalHours} hrs
                    </p>
                </div>

                <div className="bg-gray-50/70 dark:bg-gray-800/40 border border-border/70 dark:border-gray-800/80 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-secondary dark:text-gray-400 font-medium flex items-center justify-center gap-1">
                        <BsClock className="w-3 h-3 text-emerald-500" />
                        Last 2 Weeks
                    </span>
                    <p className="font-display font-bold text-sm sm:text-base text-primary dark:text-gray-100 mt-0.5">
                        {steam.hoursPlayed2Wk || 0} hrs
                    </p>
                </div>

                <div className="bg-gray-50/70 dark:bg-gray-800/40 border border-border/70 dark:border-gray-800/80 rounded-xl p-2.5 text-center">
                    <span className="text-[10px] uppercase tracking-wider text-secondary dark:text-gray-400 font-medium flex items-center justify-center gap-1">
                        <BsCalendar3 className="w-3 h-3 text-amber-500" />
                        Member Since
                    </span>
                    <p className="font-display font-bold text-xs sm:text-sm text-primary dark:text-gray-100 mt-1 truncate">
                        {steam.memberSince ? steam.memberSince.replace(/(\w+)\s+\d+,\s+(\d+)/, '$1 $2') : '2017'}
                    </p>
                </div>
            </div>

            {/* Recent / Most Played Games */}
            {Array.isArray(steam.recentGames) && steam.recentGames.length > 0 && (
                <div>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-secondary dark:text-gray-400 mb-2.5">
                        Recent Steam Activity
                    </h4>
                    <div className="space-y-2">
                        {steam.recentGames.map((game) => (
                            <div
                                key={game.appId || game.name}
                                className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-800/60 border border-border/50 dark:border-gray-800/60 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {game.logoUrl ? (
                                        <img
                                            src={game.logoUrl}
                                            alt={game.name}
                                            className="w-16 h-8 sm:w-20 sm:h-9 object-cover rounded-md flex-shrink-0 bg-gray-200 dark:bg-gray-700"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-16 h-8 sm:w-20 sm:h-9 rounded-md bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                            <BsController className="w-4 h-4 text-secondary" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-xs sm:text-sm font-semibold text-primary dark:text-gray-100 truncate">
                                            {game.name}
                                        </p>
                                        <div className="flex items-center gap-2 text-[11px] text-secondary dark:text-gray-400">
                                            <span>{game.playtimeForeverHours} hrs on record</span>
                                            {game.playtime2WkHours > 0 && (
                                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                                    · {game.playtime2WkHours}h past 2 wks
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {game.storeUrl && (
                                    <a
                                        href={game.storeUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[11px] font-medium text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors flex-shrink-0 cursor-pointer"
                                    >
                                        <span>Store</span>
                                        <BsBoxArrowUpRight className="w-2.5 h-2.5" />
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
}

SteamShowcaseCard.propTypes = {
    className: PropTypes.string,
};
