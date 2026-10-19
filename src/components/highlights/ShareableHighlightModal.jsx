import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
    BsX,
    BsQuote,
    BsCheck2,
    BsClipboard,
    BsShare,
    BsGlobe,
    BsBook,
    BsController,
} from 'react-icons/bs';

export default function ShareableHighlightModal({
    isOpen,
    onClose,
    highlight,
    isPublished = false,
    onTogglePublish,
}) {
    const [copied, setCopied] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    if (!isOpen || !highlight) return null;

    const quoteText = highlight.body || highlight.quote || '';
    const itemTitle = highlight.mediaTitle || highlight.itemTitle || highlight.title || 'Untitled';
    const itemCover = highlight.mediaCover || highlight.itemCover || highlight.cover || '';
    const mediaType = highlight.mediaType || highlight.linkedMediaType || 'book';

    const handleCopy = async () => {
        const textToCopy = `“${quoteText}”\n— ${itemTitle}`;
        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy highlight:', err);
        }
    };

    const handlePublishToggle = async () => {
        if (!onTogglePublish) return;
        setActionLoading(true);
        try {
            await onTogglePublish(highlight);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Share Highlight Dialog"
                className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col animate-scale-up"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="text-base font-bold font-display text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <BsShare className="w-4 h-4 text-amber-500" />
                        Shareable Highlight
                    </h3>
                    <button
                        type="button"
                        aria-label="Close modal"
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                        <BsX className="w-5 h-5" />
                    </button>
                </div>

                {/* Highlight Quote Card */}
                <div className="my-6 p-6 rounded-2xl bg-gradient-to-br from-amber-50/60 via-amber-100/30 to-amber-50/20 dark:from-amber-950/30 dark:via-gray-900 dark:to-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 relative shadow-sm">
                    <BsQuote className="w-10 h-10 text-amber-400/50 dark:text-amber-500/30 absolute top-3 left-3 -scale-x-100" />

                    <div className="relative z-10 pt-4">
                        <blockquote className="text-gray-900 dark:text-gray-100 font-serif italic text-base sm:text-lg leading-relaxed mb-5">
                            &ldquo;{quoteText}&rdquo;
                        </blockquote>

                        {/* Attribution */}
                        <div className="flex items-center gap-3 pt-3 border-t border-amber-200/50 dark:border-amber-800/30">
                            <div className="w-8 h-11 rounded-md overflow-hidden bg-gray-200 dark:bg-gray-800 shrink-0 border border-amber-200 dark:border-amber-900">
                                {itemCover ? (
                                    <img
                                        src={itemCover}
                                        alt={itemTitle}
                                        className="w-full h-full object-cover"
                                    />
                                ) : mediaType === 'book' ? (
                                    <div className="w-full h-full flex items-center justify-center text-emerald-500">
                                        <BsBook className="w-4 h-4" />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-indigo-500">
                                        <BsController className="w-4 h-4" />
                                    </div>
                                )}
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                                    {itemTitle}
                                </p>
                                <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                                    {mediaType === 'book' ? 'Book Quote' : 'Game Moment'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between gap-2 pt-2">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                        {copied ? (
                            <>
                                <BsCheck2 className="w-4 h-4 text-emerald-500" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <BsClipboard className="w-3.5 h-3.5" />
                                Copy
                            </>
                        )}
                    </button>

                    {onTogglePublish && (
                        <button
                            type="button"
                            disabled={actionLoading}
                            onClick={handlePublishToggle}
                            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                                isPublished
                                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 hover:bg-rose-100'
                                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                            }`}
                        >
                            <BsGlobe className="w-3.5 h-3.5" />
                            {isPublished ? 'Unpublish from Public' : 'Publish to Highlights'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

ShareableHighlightModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    highlight: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        body: PropTypes.string,
        quote: PropTypes.string,
        mediaTitle: PropTypes.string,
        itemTitle: PropTypes.string,
        title: PropTypes.string,
        mediaCover: PropTypes.string,
        itemCover: PropTypes.string,
        cover: PropTypes.string,
        mediaType: PropTypes.string,
        linkedMediaType: PropTypes.string,
    }),
    isPublished: PropTypes.bool,
    onTogglePublish: PropTypes.func,
};
