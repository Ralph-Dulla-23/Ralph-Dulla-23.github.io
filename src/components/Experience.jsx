import React from 'react';
import {
    SiPython, SiDart, SiJavascript, SiMysql, // Languages
    SiNodedotjs, SiFirebase, // Backend
    SiGit, SiGithub, // Tools
    SiReact, SiTailwindcss, SiFlutter, SiFlask // Frameworks
} from 'react-icons/si';


import { FaJava } from "react-icons/fa";
import { VscCode, VscTerminal } from "react-icons/vsc"; // VS Code
import { BiLogoAndroid } from "react-icons/bi"; // Android Studio alternative

const skills = {
    Languages: [
        { name: 'Python', icon: SiPython, color: 'text-blue-500' },
        { name: 'Java', icon: FaJava, color: 'text-red-500' },
        { name: 'Dart', icon: SiDart, color: 'text-blue-400' },
        { name: 'JavaScript', icon: SiJavascript, color: 'text-yellow-400' },
        { name: 'SQL', icon: SiMysql, color: 'text-blue-600' }
    ],
    Backend: [
        { name: 'Node.js', icon: SiNodedotjs, color: 'text-green-500' },
        { name: 'Firebase', icon: SiFirebase, color: 'text-orange-500' },
        { name: 'Flask', icon: SiFlask, color: 'text-white' }
    ],
    Tools: [
        { name: 'VS Code', icon: VscCode, color: 'text-blue-500' },
        { name: 'Git', icon: SiGit, color: 'text-orange-600' },
        { name: 'Android Studio', icon: BiLogoAndroid, color: 'text-green-400' },
        { name: 'Xampp', icon: VscTerminal, color: 'text-orange-400' },
        { name: 'GitHub', icon: SiGithub, color: 'text-white' }
    ],
    Frameworks: [
        { name: 'React', icon: SiReact, color: 'text-cyan-400' },
        { name: 'Tailwind', icon: SiTailwindcss, color: 'text-cyan-500' },
        { name: 'Flutter', icon: SiFlutter, color: 'text-blue-400' }
    ]
};

const experience = [
    {
        role: 'Virtual Initiative for Building Engagement (VIBE)',
        title: 'Core Member',
        period: '2024 – 2025',
        location: 'Davao City, Philippines',
        description: 'Aimed to help and guide other junior members within the club.'
    },
    {
        role: 'Society of Information Technology Education Students (SITES)',
        title: 'Property Custodian',
        period: '2024 – 2024',
        location: 'Davao City, Philippines',
        description: 'With the responsibility in with-guarding properties and aimed to help the members within with any tasks.'
    },
    {
        role: 'University of Immaculate Conception',
        title: 'Bachelor of Science in Computer Science',
        period: 'July 2022 – Present',
        location: 'Davao City, Philippines',
        description: 'Current student.'
    }
];

const Experience = () => {
    return (
        <section className="py-12 border-b border-border dark:border-gray-800">
            <div className="grid grid-cols-1 md:grid-cols-1 gap-10">
                {/* Core Skills Column */}
                <div>
                    <h2 className="text-lg font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-8">Core Skills</h2>
                    <div className="space-y-6">
                        {Object.entries(skills).map(([category, items]) => (
                            <div key={category}>
                                <h3 className="text-sm font-medium text-secondary dark:text-gray-400 mb-3 flex items-center gap-2">
                                    {/* Small line indicator */}
                                    <span className="w-4 h-0.5 bg-border dark:bg-gray-700 inline-block"></span>
                                    {category}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {items.map(skill => (
                                        <span
                                            key={skill.name}
                                            className="text-xs font-medium px-3 py-1.5 bg-gray-100/50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 text-primary dark:text-gray-200 rounded-full border border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-1.5"
                                        >
                                            <skill.icon className={`w-3.5 h-3.5 ${skill.color}`} />
                                            {skill.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Experience Column */}
                <div>
                    <h2 className="text-lg font-semibold text-primary dark:text-gray-100 uppercase tracking-wider mb-8">Experience</h2>
                    <div className="relative border-l border-border dark:border-gray-800 ml- space-y-10 pl-7">
                        {experience.map((item, index) => (
                            <div key={index} className="relative">
                                {/* Timeline Dot */}
                                <span className="absolute -left-[37px] top-1.5 w-4 h-4 rounded-full bg-border dark:bg-gray-700 border-2 border-white dark:border-gray-900 ring-1 ring-white dark:ring-gray-800"></span>

                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-1">
                                    <h3 className="text-base font-semibold text-primary dark:text-gray-100">{item.role}</h3>
                                    <span className="text-xs text-secondary dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-700">{item.period}</span>
                                </div>

                                <div className="text-sm font-medium text-primary/80 dark:text-gray-300 mb-2 italic">
                                    {item.title}
                                </div>

                                <p className="text-sm text-secondary dark:text-gray-400 leading-relaxed">
                                    {item.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Experience;
