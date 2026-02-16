import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const certificates = [
    {
        title: 'AWS Cloud Solutions',
        issuer: 'Amazon Web Services',
        file: '/assets/certificates/aws-cloud-solutions.pdf',
        type: 'pdf',
    },
    {
        title: 'Frontend Development using React',
        issuer: 'Coursera',
        file: '/assets/certificates/coursera-frontend-react.pdf',
        type: 'pdf',
    },
    {
        title: 'English for Effective Business Speaking',
        issuer: 'Professional Development',
        file: '/assets/certificates/english-business-speaking.pdf',
        type: 'pdf',
    },
    {
        title: 'Introduction to Cybersecurity',
        issuer: 'Cisco / Networking Academy',
        file: '/assets/certificates/intro-cybersecurity.pdf',
        type: 'pdf',
    },
    {
        title: 'JavaScript for Web Development',
        issuer: 'Online Course',
        file: '/assets/certificates/javascript-web-dev.pdf',
        type: 'pdf',
    },
    {
        title: 'UXPH Conference',
        issuer: 'UX Philippines',
        file: '/assets/certificates/uxph-participation.png',
        type: 'image',
    },
    {
        title: 'VJAL Institute Certificate',
        issuer: 'VJAL Institute',
        file: '/assets/certificates/vjal-institute.pdf',
        type: 'pdf',
    },
];

const INITIAL_COUNT = 2;

const Certificates = () => {
    const animRef = useScrollAnimation();
    const [selectedCert, setSelectedCert] = useState(null);
    const [showAll, setShowAll] = useState(false);

    const openModal = (cert) => setSelectedCert(cert);
    const closeModal = () => setSelectedCert(null);

    const visibleCerts = showAll ? certificates : certificates.slice(0, INITIAL_COUNT);
    const hasMore = certificates.length > INITIAL_COUNT;

    return (
        <>
            <section id="certificates" className="py-12 border-b border-border dark:border-gray-800" ref={animRef} data-animate>
                <h2 className="text-lg font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-8">
                    Certificates
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {visibleCerts.map((cert, index) => (
                        <button
                            key={index}
                            onClick={() => openModal(cert)}
                            className="group text-left p-5 rounded-lg bg-white dark:bg-gray-900 border border-border dark:border-gray-800 hover:border-black/30 dark:hover:border-gray-500 transition-all duration-200 shadow-sm hover:shadow-md dark:shadow-none cursor-pointer hover:-translate-y-0.5"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold text-primary dark:text-gray-100 truncate">
                                        {cert.title}
                                    </h3>
                                    <p className="text-xs text-secondary dark:text-gray-400 mt-1">
                                        {cert.issuer}
                                    </p>
                                </div>
                                <span className="text-secondary dark:text-gray-500 group-hover:text-primary dark:group-hover:text-gray-200 transition-colors flex-shrink-0 mt-0.5">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                </span>
                            </div>
                            <div className="mt-3 flex items-center gap-1.5">
                                <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
                                <span className="text-[11px] text-secondary dark:text-gray-500 uppercase tracking-wide">
                                    {cert.type === 'pdf' ? 'PDF' : 'Image'}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                {hasMore && (
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className="mt-6 text-sm font-medium text-secondary dark:text-gray-400 hover:text-primary dark:hover:text-gray-100 transition-colors cursor-pointer flex items-center gap-1.5 mx-auto"
                    >
                        {showAll ? 'Show Less' : `View All Certificates (${certificates.length})`}
                        <svg
                            className={`w-4 h-4 transition-transform duration-200 ${showAll ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                )}
            </section>

            {/* Modal Viewer — rendered via portal to escape main container */}
            {selectedCert && createPortal(
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
                    onClick={closeModal}
                >
                    <div
                        className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-border dark:border-gray-700 animate-fade-in-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border dark:border-gray-800">
                            <div>
                                <h3 className="text-base font-display font-semibold text-primary dark:text-gray-100">
                                    {selectedCert.title}
                                </h3>
                                <p className="text-xs text-secondary dark:text-gray-400 mt-0.5">
                                    {selectedCert.issuer}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={selectedCert.file}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium px-3 py-1.5 rounded-md bg-gray-100 dark:bg-gray-800 text-primary dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                >
                                    Open ↗
                                </a>
                                <button
                                    onClick={closeModal}
                                    className="p-1.5 rounded-md text-secondary dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                                    aria-label="Close modal"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="overflow-auto max-h-[calc(90vh-80px)]">
                            {selectedCert.type === 'image' ? (
                                <img
                                    src={selectedCert.file}
                                    alt={selectedCert.title}
                                    className="w-full h-auto"
                                />
                            ) : (
                                <iframe
                                    src={selectedCert.file}
                                    title={selectedCert.title}
                                    className="w-full h-[75vh]"
                                />
                            )}
                        </div>
                    </div>
                </div>
                , document.body)}
        </>
    );
};

export default Certificates;
