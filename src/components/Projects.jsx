import React from 'react';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const projects = [
    {
        title: 'PReDiCT',
        description: 'Built a web-based clinical decision support system that predicts HIV seroconversion risk using ML models (SVM, XGBoost) achieving up to 97% accuracy. Features a Flask application for healthcare workers to input patient data, generate intervention recommendations, and view encrypted analytics dashboards — all compliant with the HIV Policy Act and Data Privacy Act.',
        link: 'https://github.com/Ralph-Dulla-23/PReDiCT',
        tags: ['Python', 'Flask', 'React', 'Firebase']
    },
    {
        title: 'Counseling Management System',
        description: 'Developed a role-based web application designed to streamline student counseling processes.',
        link: 'https://github.com/Ralph-Dulla-23/CMSW',
        tags: ['Tailwind', 'JavaScript', 'HTML', 'Firebase']
    },
    {
        title: 'Gear Guard',
        description: 'Developed a web-based application to streamline the process of equipment borrowing and tracking.',
        link: 'https://github.com/Ralph-Dulla-23/GearGuard',
        tags: ['HTML + CSS', 'Xampp', 'MySQL']
    }

];

const Projects = () => {
    const animRef = useScrollAnimation();

    return (
        <section id="projects" className="py-12 border-b border-border dark:border-gray-800" ref={animRef} data-animate>
            <h2 className="text-lg font-display font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-8">Projects</h2>

            <div className="grid grid-cols-1 gap-6">
                {projects.map((project, index) => (
                    <a
                        key={index}
                        href={project.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block p-6 rounded-lg bg-white dark:bg-gray-900 border border-border dark:border-gray-800 hover:border-black/30 dark:hover:border-gray-500 transition-all duration-200 shadow-sm hover:shadow-md dark:shadow-none cursor-pointer hover:-translate-y-0.5"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-display font-medium text-primary dark:text-gray-100">
                                {project.title}
                            </h3>
                            <span className="text-black dark:text-white group-hover:opacity-70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200">↗</span>
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
                    </a>
                ))}
            </div>
        </section>
    );
};

export default Projects;
