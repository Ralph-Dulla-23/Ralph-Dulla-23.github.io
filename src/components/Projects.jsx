import React from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const projects = [
    {
        title: 'TonyWrites — Copywriter Portfolio',
        description: 'Built a conversion-focused portfolio website for Franz Abadia (TonyWrites), a copywriter specializing in psychology-driven copy and strategic brand narratives. Features a clean editorial layout designed to showcase writing samples and drive client inquiries.',
        demo: 'https://tonywrites.work',
        tags: ['Client Project', 'React', 'Tailwind CSS', 'Vercel'],
        isClient: true,
    },
    {
        title: 'Echoverse Digital Marketing',
        description: 'Built a premium agency website for Echoverse Digital Marketing — a full-stack, cinematic web experience featuring immersive animated backgrounds, adaptive video streaming, interactive case studies, and a streamlined client booking flow designed to convert high-value leads.',
        github: 'https://github.com/Ralph-Dulla-23/Echoverse',
        isPrivate: true,
        demo: 'https://www.echoversedigital.marketing',
        tags: ['NextJS', 'Tailwind CSS', 'Framer Motion, Vercel']
    },
    {
        title: 'PReDiCT',
        description: 'Built a web-based clinical decision support system that predicts HIV seroconversion risk using ML models (SVM, XGBoost) achieving up to 97% accuracy. Features a Flask application for healthcare workers to input patient data, generate intervention recommendations, and view encrypted analytics dashboards — all compliant with the HIV Policy Act and Data Privacy Act.',
        github: 'https://github.com/Ralph-Dulla-23/PReDiCT',
        isPrivate: true,
        demo: 'predict-wheat.vercel.app', // Add deployed link here
        tags: ['Python', 'Flask', 'React', 'Firebase']
    },
    {
        title: 'Counseling Management System',
        description: 'Developed a role-based web application designed to streamline student counseling processes.',
        github: 'https://github.com/Ralph-Dulla-23/CMSW',
        isPrivate: false,
        demo: 'https://modern-cms-one.vercel.app',
        tags: ['Tailwind', 'JavaScript', 'HTML', 'Firebase']
    },
    {
        title: 'Gear Guard',
        description: 'Developed a web-based application to streamline the process of equipment borrowing and tracking. GearGuard is a comprehensive equipment tracking and management system designed for educational institutions. It streamlines the process of borrowing, returning, and managing equipment inventory with role-based access control and AI-powered analytics.',
        github: 'https://github.com/Ralph-Dulla-23/GearGuard',
        isPrivate: true,
        demo: 'https://gearguards.netlify.app/',
        tags: ['React + Vite', 'Django + DRF', 'Supabase']
    }
];

const Projects = () => {
    const animRef = useScrollAnimation();

    return (
        <section id="projects" className="py-8 border-b border-border dark:border-gray-800" ref={animRef} data-animate>
            <h2 className="text-lg font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-8">Projects</h2>

            <div className="grid grid-cols-1 gap-6">
                {projects.map((project, index) => (
                    <div
                        key={index}
                        className="group block p-6 rounded-lg bg-white dark:bg-gray-900 border border-border dark:border-gray-800 transition-all duration-200 shadow-sm hover:shadow-md dark:shadow-none hover:-translate-y-0.5"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-display font-medium text-primary dark:text-gray-100">
                                {project.title}
                            </h3>
                            <div className="flex gap-4 items-center">
                                {project.github && (
                                    <a href={project.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-secondary hover:text-primary dark:hover:text-gray-300 transition-colors" aria-label="GitHub Repository" title={project.isPrivate ? "Private Repository" : "View Source Code"}>
                                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                                        {project.isPrivate && (
                                            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold bg-gray-100 dark:bg-gray-800/80 px-1.5 py-0.5 rounded text-secondary dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                                </svg>
                                                Private
                                            </span>
                                        )}
                                    </a>
                                )}
                                {project.demo && (
                                    <a href={project.demo} target="_blank" rel="noopener noreferrer" className="text-secondary hover:text-primary dark:hover:text-gray-300 transition-colors flex items-center gap-1.5" aria-label="Live Demo" title="View Live Site">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    </a>
                                )}
                            </div>
                        </div>
                        <p className="text-secondary dark:text-gray-400 text-sm mb-6 leading-relaxed">
                            {project.description}
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            {project.tags.map(tag => (
                                <span key={tag} className="text-xs font-medium px-2 py-1 bg-gray-100 dark:bg-gray-800 text-secondary dark:text-gray-300 rounded-full border border-gray-200 dark:border-gray-700">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Projects;
