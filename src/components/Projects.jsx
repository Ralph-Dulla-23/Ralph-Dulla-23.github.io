import React from 'react';

const projects = [
    {
        title: 'Counseling Management System',
        description: 'Developed a role-based web application designed to streamline student counseling processes.',
        link: 'https://github.com/Ralph-Dulla-23/CMSW',
        tags: ['Tailwind', 'JavaScript', 'HTML', 'Firebase']
    },
    {
        title: 'Gear Guard',
        description: 'Developed a web based application designed to streamline the efficiency of equipment borrowing.',
        link: 'https://github.com/Ralph-Dulla-23/GearGuard',
        tags: ['HTML + CSS', 'Xampp', 'MySQL']
    },
    {
        title: 'PReDiCT',
        description: 'Built a web-based clinical decision support system that predicts HIV seroconversion risk using SVM/XGBoost models.',
        link: 'https://github.com/Ralph-Dulla-23/PReDiCT',
        tags: ['Python', 'Flask', 'React', 'Firebase']
    }
];

const Projects = () => {
    return (
        <section className="py-12 border-b border-border">
            <h2 className="text-lg font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-8">Projects</h2>

            <div className="grid grid-cols-1 gap-6">
                {projects.map((project, index) => (
                    <div
                        key={index}
                        className="group block p-6 rounded-lg bg-white dark:bg-gray-900 border border-border dark:border-gray-800 hover:border-black/30 dark:hover:border-gray-500 transition-all shadow-sm hover:shadow-md dark:shadow-none"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-medium text-primary dark:text-gray-100">
                                {project.title}
                            </h3>
                            <span className="text-black dark:text-white group-hover:opacity-70 transition-opacity">↗</span>
                        </div>
                        <p className="text-secondary dark:text-gray-400 text-sm mb-6">
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
