import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
    BsBook,
    BsController,
    BsClockHistory,
    BsJournalPlus,
    BsX,
} from 'react-icons/bs';
import { QUICK_ACTIONS } from './navigationConfig';

const iconMap = {
    BsBook,
    BsController,
    BsClockHistory,
    BsJournalPlus,
};

export function QuickActionModal({ isOpen, onClose }) {
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSelectAction = (action) => {
        onClose();
        if (action.target) {
            navigate(action.target);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-actions-title"
        >
            <div
                className="w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-800 transform transition-transform"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                    <div>
                        <h2 id="quick-actions-title" className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            Quick Log & Add
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Choose an activity to record in your diary
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        aria-label="Close Quick Actions"
                    >
                        <BsX className="w-6 h-6" />
                    </button>
                </div>

                {/* Action Options */}
                <div className="mt-4 space-y-2">
                    {QUICK_ACTIONS.map((action) => {
                        const IconComponent = iconMap[action.iconName] || BsJournalPlus;
                        return (
                            <button
                                key={action.id}
                                onClick={() => handleSelectAction(action)}
                                className="w-full min-h-[44px] flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all text-left cursor-pointer group"
                                aria-label={action.title}
                            >
                                <div className="w-10 h-10 rounded-xl bg-primary/5 dark:bg-gray-800 flex items-center justify-center text-primary dark:text-gray-200 group-hover:scale-105 transition-transform">
                                    <IconComponent className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        {action.title}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {action.description}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

QuickActionModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
};
